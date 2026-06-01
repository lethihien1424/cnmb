// Backend/services/vector.service.js
// RAG (Retrieval-Augmented Generation) — Semantic Search using Qdrant Vector DB
// Thay thế hoàn toàn mảng RAM bằng Qdrant Cloud API

const { QdrantClient } = require("@qdrant/js-client-rest");
const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const { v5: uuidv5 } = require("uuid");
const { Product, Store } = require("../models");

// Namespace cố định để chuyển đổi UUID sản phẩm thành UUID v5 hợp lệ cho Qdrant
const QDRANT_NAMESPACE = "1b671a64-40d5-491e-99b0-da01ff1f3341";

// ─── Cấu hình Qdrant ────────────────────────────────────────────────────────
const COLLECTION_NAME = "shophub_products_v3"; // Đổi tên để ép Qdrant tạo kho mới
const VECTOR_SIZE = 3072; // Google Gemini embeddings trả về 3072 chiều
const SCORE_THRESHOLD = 0.7; // Chỉ trả về sản phẩm có độ liên quan cao (≥70%)
const MAX_RESULTS = 5; // Số kết quả tối đa mỗi lần tìm

/**
 * Khởi tạo Qdrant Client từ biến môi trường.
 */
const getQdrantClient = () => {
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;

  if (!url) {
    throw new Error("QDRANT_URL chưa được cấu hình trong .env!");
  }

  const config = { url };
  if (apiKey) {
    config.apiKey = apiKey;
  }

  return new QdrantClient(config);
};

/**
 * Khởi tạo bộ chuyển đổi ngôn ngữ thành Vector (Google AI Embeddings).
 */
const getEmbeddings = () => {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY chưa được cấu hình trong .env!");
  }
  return new GoogleGenerativeAIEmbeddings({
    apiKey,
    model: "gemini-embedding-001",
  });
};

/**
 * Kiểm tra và tạo Collection trên Qdrant nếu chưa tồn tại.
 */
const initCollection = async () => {
  try {
    const client = getQdrantClient();

    // Kiểm tra collection đã tồn tại chưa
    const collections = await client.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === COLLECTION_NAME,
    );

    if (!exists) {
      console.log(
        `[Qdrant] Collection "${COLLECTION_NAME}" chưa tồn tại. Đang tạo mới...`,
      );
      await client.createCollection(COLLECTION_NAME, {
        vectors: {
          size: VECTOR_SIZE,
          distance: "Cosine",
        },
      });
      console.log(
        `[Qdrant] Đã tạo collection "${COLLECTION_NAME}" thành công (size=${VECTOR_SIZE}, distance=Cosine).`,
      );
    } else {
      console.log(
        `[Qdrant] Collection "${COLLECTION_NAME}" đã tồn tại. Bỏ qua tạo mới.`,
      );
    }

    return true;
  } catch (error) {
    console.error("[Qdrant] Lỗi khởi tạo collection:", error.message);
    return false;
  }
};

/**
 * Tạo payload text để embed từ một sản phẩm.
 */
const buildProductText = (product) => {
  return `Sản phẩm: ${product.name}. Mô tả chi tiết: ${product.description || "Không có"}. Cửa hàng: ${product.store?.store_name || "Không rõ"}. Giá: ${Number(product.price)}đ.`;
};

/**
 * Parse imageUrl từ trường images của product.
 */
const parseImageUrl = (product) => {
  let imageUrl = "";
  try {
    const raw = product.images;

    // Handle all possible formats:
    // 1. PostgreSQL ARRAY → already a JS array
    // 2. JSON string like '["url1","url2"]'
    // 3. Plain string like '/uploads/img.jpg'
    // 4. Null/undefined
    let imgs;
    if (Array.isArray(raw)) {
      imgs = raw;
    } else if (typeof raw === "string") {
      // Try JSON parse first
      try {
        imgs = JSON.parse(raw);
      } catch {
        // If not JSON, treat as single image URL
        imgs = [raw];
      }
    } else {
      imgs = [];
    }

    if (Array.isArray(imgs) && imgs.length > 0) {
      imageUrl = imgs[0];
      if (typeof imageUrl === "string" && imageUrl.startsWith("/")) {
        imageUrl = `http://localhost:5000${imageUrl}`;
      }
    }
  } catch (err) {
    console.warn(
      `[parseImageUrl] Error for product ${product.id}:`,
      err.message,
    );
    imageUrl = "";
  }
  return imageUrl;
};

/**
 * Đồng bộ toàn bộ dữ liệu sản phẩm từ PostgreSQL lên Qdrant.
 * Chạy 1 lần khi server khởi động.
 */
const syncProductsToVectorDB = async () => {
  const apiKey = process.env.GOOGLE_API_KEY;
  const qdrantUrl = process.env.QDRANT_URL;

  if (!apiKey) {
    console.log("[Vector DB] Bỏ qua đồng bộ — GOOGLE_API_KEY chưa cấu hình.");
    return;
  }
  if (!qdrantUrl) {
    console.log("[Vector DB] Bỏ qua đồng bộ — QDRANT_URL chưa cấu hình.");
    return;
  }

  try {
    console.log("[Vector DB] Đang đồng bộ sản phẩm lên Qdrant...");

    // Đảm bảo collection tồn tại
    const collectionReady = await initCollection();
    if (!collectionReady) {
      console.error(
        "[Vector DB] Không thể khởi tạo collection. Bỏ qua đồng bộ.",
      );
      return;
    }

    const products = await Product.findAll({
      paranoid: false,
      include: [{ model: Store, as: "store", attributes: ["store_name"] }],
    });

    if (products.length === 0) {
      console.log("[Vector DB] Không có sản phẩm nào để đồng bộ.");
      return;
    }

    const embeddings = getEmbeddings();
    const client = getQdrantClient();

    // Chuẩn bị text để tạo vector
    const texts = products.map((p) => buildProductText(p));

    // Tạo embeddings theo batch (Google API có giới hạn)
    const batchSize = 20;
    let totalUpserted = 0;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batchTexts = texts.slice(i, i + batchSize);
      const batchProducts = products.slice(i, i + batchSize);

      const embeddingVectors = await embeddings.embedDocuments(batchTexts);

      // Debug: Kiểm tra vector dimensions
      if (i === 0 && embeddingVectors.length > 0) {
        const firstVec = embeddingVectors[0];
        console.log(
          `[Vector DB] ✅ Embedding model trả về ${firstVec.length} chiều (mong đợi: ${VECTOR_SIZE})`,
        );
        if (firstVec.length !== VECTOR_SIZE) {
          console.error(
            `[Vector DB] ❌ CẢNH BÁO: Vector size ${firstVec.length} ≠ VECTOR_SIZE ${VECTOR_SIZE}! Collection sẽ bị lỗi khi upsert.`,
          );
        }
      }

      // Tạo mảng points cho Qdrant
      const points = batchProducts.map((p, j) => ({
        id: uuidv5(p.id.toString(), QDRANT_NAMESPACE),
        vector: embeddingVectors[j],
        payload: {
          productId: p.id, // Giữ lại UUID gốc để dùng trong kết quả tìm kiếm
          name: p.name,
          price: Number(p.price),
          imageUrl: parseImageUrl(p),
          storeName: p.store?.store_name || "",
        },
      }));

      // Gọi API Qdrant upsert
      await client.upsert(COLLECTION_NAME, {
        wait: true,
        points,
      });

      totalUpserted += points.length;

      console.log(
        `[Vector DB] Đã upsert ${Math.min(i + batchSize, products.length)}/${products.length} sản phẩm lên Qdrant...`,
      );
    }

    console.log(
      `[Vector DB] Đồng bộ thành công! Đã đẩy ${totalUpserted} sản phẩm lên Qdrant collection "${COLLECTION_NAME}".`,
    );
  } catch (error) {
    console.error("================= LỖI QDRANT =================");
    console.error(error.message);
    console.error(error); // In ra toàn bộ cục lỗi để biết chính xác nó cấm cái gì
    console.error("==============================================");
  }
};

/**
 * Tìm kiếm sản phẩm theo ngữ nghĩa (Semantic Search) sử dụng Qdrant API.
 * Trả về format khớp 100% với cấu trúc cũ để chat.service.js không bị lỗi.
 */
const semanticSearch = async (contextQuery) => {
  const apiKey = process.env.GOOGLE_API_KEY;
  const qdrantUrl = process.env.QDRANT_URL;

  if (!apiKey) {
    return {
      error:
        "Tính năng tìm kiếm ngữ nghĩa chưa khả thi (thiếu GOOGLE_API_KEY). Hãy thử dùng searchProducts với từ khóa khác.",
    };
  }
  if (!qdrantUrl) {
    return {
      error:
        "Tính năng tìm kiếm ngữ nghĩa chưa khả thi (thiếu QDRANT_URL). Hãy thử dùng searchProducts với từ khóa khác.",
    };
  }

  try {
    console.log(`[Vector Search] Đang tìm ngữ nghĩa cho: "${contextQuery}"`);

    const embeddings = getEmbeddings();
    const client = getQdrantClient();

    // Tạo vector cho câu query
    const queryVector = await embeddings.embedQuery(contextQuery);

    // Debug: Kiểm tra query vector có hợp lệ không
    if (
      !queryVector ||
      !Array.isArray(queryVector) ||
      queryVector.length === 0
    ) {
      console.error("[Vector Search] ❌ Query vector rỗng hoặc không hợp lệ!");
      return {
        error: "Không thể tạo vector cho từ khóa tìm kiếm. Vui lòng thử lại.",
      };
    }
    console.log(
      `[Vector Search] ✅ Query vector hợp lệ — ${queryVector.length} chiều, mẫu đầu: [${queryVector
        .slice(0, 5)
        .map((v) => v.toFixed(6))
        .join(", ")}...]`,
    );

    // ── PASS 1: Tìm kiếm với score_threshold ─────────────────────────────
    let searchResults = await client.search(COLLECTION_NAME, {
      vector: queryVector,
      limit: MAX_RESULTS,
      score_threshold: SCORE_THRESHOLD,
      with_payload: true,
    });

    // Debug: In điểm tương đồng ra terminal
    console.log(
      `[Vector Search] PASS 1 (threshold=${SCORE_THRESHOLD}): ${searchResults.length} kết quả`,
      searchResults.map((r) => ({
        name: r.payload?.name,
        score: r.score?.toFixed(4),
      })),
    );

    // ── PASS 2: Fallback — nếu PASS 1 rỗng, thử lại KHÔNG có threshold ──
    if (searchResults.length === 0) {
      console.log(
        "[Vector Search] PASS 1 rỗng → Fallback: tìm WITHOUT score_threshold...",
      );
      searchResults = await client.search(COLLECTION_NAME, {
        vector: queryVector,
        limit: MAX_RESULTS,
        with_payload: true,
      });

      console.log(
        `[Vector Search] PASS 2 (no threshold): ${searchResults.length} kết quả`,
        searchResults.map((r) => ({
          name: r.payload?.name,
          score: r.score?.toFixed(4),
        })),
      );

      // Nếu vẫn rỗng → collection trống hoặc vector bị lỗi
      if (searchResults.length === 0) {
        // Kiểm tra collection có dữ liệu không
        try {
          const collectionInfo = await client.getCollection(COLLECTION_NAME);
          console.log(
            `[Vector Search] Collection "${COLLECTION_NAME}" có ${collectionInfo.points_count} điểm, status: ${collectionInfo.status}`,
          );
        } catch (infoErr) {
          console.error(
            "[Vector Search] Không thể lấy thông tin collection:",
            infoErr.message,
          );
        }

        return {
          message: "Không tìm thấy sản phẩm phù hợp với ngữ cảnh này.",
        };
      }
    }

    const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    const formattedResults = searchResults.map((r) => {
      const productId = r.payload?.productId || r.id; // Ưu tiên UUID gốc từ payload
      return {
        id: productId,
        name: r.payload?.name || "",
        price: r.payload?.price || 0,
        priceFormatted: Number(r.payload?.price || 0).toLocaleString("vi-VN"),
        imageUrl: r.payload?.imageUrl || null,
        storeName: r.payload?.storeName || "",
        productUrl: `${frontendBaseUrl}/product/${productId}`, // URL chi tiết sản phẩm
        score: Math.round(r.score * 100), // % độ tương đồng
      };
    });

    return {
      message: "Đây là các sản phẩm phù hợp với ngữ cảnh bạn tìm.",
      results: formattedResults,
      total: formattedResults.length,
    };
  } catch (error) {
    console.error("[Vector Search Error]:", error.message);
    return {
      error: "Lỗi tìm kiếm ngữ nghĩa. Hãy thử lại sau.",
    };
  }
};

/**
 * Upsert 1 sản phẩm duy nhất lên Qdrant (Real-time sync).
 * Gọi sau khi Admin thêm/sửa sản phẩm.
 */
const upsertSingleProduct = async (product) => {
  const apiKey = process.env.GOOGLE_API_KEY;
  const qdrantUrl = process.env.QDRANT_URL;

  if (!apiKey || !qdrantUrl) {
    console.log(
      "[Vector DB] Bỏ qua upsertSingleProduct — thiếu GOOGLE_API_KEY hoặc QDRANT_URL.",
    );
    return;
  }

  try {
    // Lấy thông tin store nếu chưa có
    let storeName = "";
    if (product.store?.store_name) {
      storeName = product.store.store_name;
    } else if (product.store_id) {
      const store = await Store.findByPk(product.store_id);
      storeName = store?.store_name || "";
    }

    const embeddings = getEmbeddings();
    const client = getQdrantClient();

    // Đảm bảo collection tồn tại
    await initCollection();

    const text = `Sản phẩm: ${product.name}. Mô tả chi tiết: ${product.description || "Không có"}. Cửa hàng: ${storeName}. Giá: ${Number(product.price)}đ.`;

    const [vector] = await embeddings.embedDocuments([text]);

    const imageUrl = parseImageUrl(product);

    await client.upsert(COLLECTION_NAME, {
      wait: true,
      points: [
        {
          id: uuidv5(product.id.toString(), QDRANT_NAMESPACE),
          vector,
          payload: {
            productId: product.id, // Giữ lại UUID gốc
            name: product.name,
            price: Number(product.price),
            imageUrl,
            storeName,
          },
        },
      ],
    });

    console.log(
      `[Vector DB] Đã upsert sản phẩm "${product.name}" (id: ${product.id}) lên Qdrant.`,
    );
  } catch (error) {
    console.error("[Vector DB] Lỗi upsertSingleProduct:", error.message);
  }
};

/**
 * Xóa 1 sản phẩm khỏi Qdrant theo ID.
 * Gọi sau khi Admin xóa sản phẩm.
 */
const deleteProductVector = async (productId) => {
  const qdrantUrl = process.env.QDRANT_URL;

  if (!qdrantUrl) {
    console.log("[Vector DB] Bỏ qua deleteProductVector — thiếu QDRANT_URL.");
    return;
  }

  try {
    const client = getQdrantClient();

    await client.delete(COLLECTION_NAME, {
      wait: true,
      points: [uuidv5(productId.toString(), QDRANT_NAMESPACE)],
    });

    console.log(
      `[Vector DB] Đã xóa vector sản phẩm (id: ${productId}) khỏi Qdrant.`,
    );
  } catch (error) {
    console.error("[Vector DB] Lỗi deleteProductVector:", error.message);
  }
};

module.exports = {
  initCollection,
  syncProductsToVectorDB,
  semanticSearch,
  upsertSingleProduct,
  deleteProductVector,
};
