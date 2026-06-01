//D:\CNM_cu\CongNgheMoi\Backend\server.js
require("dotenv").config();
const app = require("./app");
const http = require("http");
const { Server } = require("socket.io");
const { Op } = require("sequelize");
const { sequelize, Product, User } = require("./models");
const cron = require("node-cron");
const ghnRoutes = require("./routes/ghn.route");
app.use("/api/ghn", ghnRoutes);
const PORT = Number(process.env.PORT || 5000);
const AUTO_REPLY_MESSAGE =
  "Khách hàng vui lòng chờ trong giây lát, chúng tôi sẽ trả lời ngay.";

const ADDRESS_KEYWORDS = [
  "địa chỉ",
  "dia chi",
  "số nhà",
  "so nha",
  "đường",
  "duong",
  "phường",
  "phuong",
  "quận",
  "quan",
  "huyện",
  "huyen",
  "tỉnh",
  "tinh",
  "thành phố",
  "thanh pho",
  "address",
  "street",
  "district",
  "ward",
];

const PHONE_REGEX = /(\+?84|0)\d{8,10}|\b\d{9,11}\b/;
const customerNameCache = new Map();

const buildChatRoomId = (userId, storeId) => {
  return `chat:${String(userId)}:${String(storeId)}`;
};

const buildStoreInboxRoomId = (storeId) => {
  return `store_inbox:${String(storeId)}`;
};

const parseChatRoomId = (roomId) => {
  if (typeof roomId !== "string" || !roomId.startsWith("chat:")) {
    return null;
  }

  const roomParts = roomId.split(":");
  if (roomParts.length < 3) {
    return null;
  }

  return {
    userId: roomParts[1],
    storeId: roomParts.slice(2).join(":"),
  };
};

const getUnreadCount = (history) => {
  if (!Array.isArray(history) || history.length === 0) {
    return 0;
  }

  let lastStoreMessageIndex = -1;
  history.forEach((message, index) => {
    if (message?.sender === "STORE") {
      lastStoreMessageIndex = index;
    }
  });

  return history
    .slice(lastStoreMessageIndex + 1)
    .filter((message) => message?.sender === "USER").length;
};

const normalizeMessageForCheck = (message) => {
  return String(message || "")
    .toLowerCase()
    .replace(/[\n\t\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const isRestrictedMessage = (message) => {
  const normalized = normalizeMessageForCheck(message);
  if (!normalized) {
    return false;
  }

  if (PHONE_REGEX.test(normalized)) {
    return true;
  }

  return ADDRESS_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

const getCustomerDisplayName = async (userId) => {
  const normalizedUserId = String(userId);
  if (customerNameCache.has(normalizedUserId)) {
    return customerNameCache.get(normalizedUserId);
  }

  try {
    const customer = await User.findByPk(normalizedUserId, {
      attributes: ["id", "username", "email"],
    });

    const displayName =
      customer?.username?.trim() || customer?.email?.trim() || normalizedUserId;
    customerNameCache.set(normalizedUserId, displayName);
    return displayName;
  } catch {
    return normalizedUserId;
  }
};

const buildConversationSummary = async ({ userId, storeId, history }) => {
  if (!userId || !storeId || !Array.isArray(history) || history.length === 0) {
    return null;
  }

  const lastMessage = history[history.length - 1];
  const customerName = await getCustomerDisplayName(userId);

  return {
    userId: String(userId),
    customerName,
    storeId: String(storeId),
    lastMessage: String(lastMessage?.message || ""),
    lastSender: lastMessage?.sender === "STORE" ? "STORE" : "USER",
    updatedAt: lastMessage?.timestamp || new Date().toISOString(),
    unreadCount: getUnreadCount(history),
  };
};

const getStoreConversations = async (storeId) => {
  const normalizedStoreId = String(storeId);
  const summaryPromises = [];

  chatHistoryByRoom.forEach((history, roomId) => {
    const parsedRoom = parseChatRoomId(roomId);
    if (!parsedRoom || parsedRoom.storeId !== normalizedStoreId) {
      return;
    }

    summaryPromises.push(
      buildConversationSummary({
        userId: parsedRoom.userId,
        storeId: parsedRoom.storeId,
        history,
      }),
    );
  });

  const summaries = (await Promise.all(summaryPromises)).filter(Boolean);

  return summaries.sort((a, b) => {
    const timeA = new Date(a.updatedAt).getTime();
    const timeB = new Date(b.updatedAt).getTime();
    return timeB - timeA;
  });
};

const chatHistoryByRoom = new Map();

const startServer = async () => {
  try {
    await sequelize.sync();
    console.log("[DB] Database synced successfully.");

    // Đồng bộ sản phẩm sang Vector DB (RAG) — chạy nền, không block server
    const { syncProductsToVectorDB } = require("./services/vector.service");
    syncProductsToVectorDB().catch((err) =>
      console.error("[Vector DB] Lỗi đồng bộ:", err.message),
    );

    const server = http.createServer(app);
    const io = new Server(server, {
      cors: {
        origin: [
          process.env.FRONTEND_URL || "http://localhost:5173",
          "http://localhost:5174",
          "http://127.0.0.1:5173",
          "http://127.0.0.1:5174",
        ],
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    io.on("connection", (socket) => {
      socket.on("join_chat", ({ userId, storeId }) => {
        if (!userId || !storeId) {
          return;
        }

        const roomId = buildChatRoomId(userId, storeId);
        socket.join(roomId);
        const history = chatHistoryByRoom.get(roomId) || [];
        socket.emit("chat_history", history);
      });

      socket.on("join_store_inbox", async ({ storeId }) => {
        if (!storeId) {
          return;
        }

        const normalizedStoreId = String(storeId);
        socket.join(buildStoreInboxRoomId(normalizedStoreId));
        socket.emit(
          "store_conversations",
          await getStoreConversations(normalizedStoreId),
        );
      });

      socket.on("send_message", async (payload) => {
        const { userId, storeId, message, sender, timestamp } = payload || {};
        if (!userId || !storeId || !message) {
          return;
        }

        const normalizedText = String(message).trim();
        if (!normalizedText) {
          return;
        }

        if (isRestrictedMessage(normalizedText)) {
          socket.emit("chat_error", {
            message:
              "Tin nhắn không hợp lệ: không gửi nội dung liên quan đến địa chỉ hoặc số điện thoại.",
          });
          return;
        }

        const roomId = buildChatRoomId(userId, storeId);
        const normalizedMessage = {
          userId: String(userId),
          storeId: String(storeId),
          message: normalizedText,
          sender: sender === "STORE" ? "STORE" : "USER",
          timestamp: timestamp || new Date().toISOString(),
        };

        if (!normalizedMessage.message) {
          return;
        }

        const history = chatHistoryByRoom.get(roomId) || [];
        history.push(normalizedMessage);

        if (normalizedMessage.sender === "USER") {
          history.push({
            userId: String(userId),
            storeId: String(storeId),
            message: AUTO_REPLY_MESSAGE,
            sender: "STORE",
            timestamp: new Date().toISOString(),
          });
        }

        chatHistoryByRoom.set(roomId, history.slice(-200));

        const latestHistory = chatHistoryByRoom.get(roomId) || [];
        const latestMessage = latestHistory[latestHistory.length - 1];

        io.to(roomId).emit("receive_message", normalizedMessage);
        if (
          normalizedMessage.sender === "USER" &&
          latestMessage &&
          latestMessage !== normalizedMessage
        ) {
          io.to(roomId).emit("receive_message", latestMessage);
        }

        const summary = await buildConversationSummary({
          userId: String(userId),
          storeId: String(storeId),
          history: latestHistory,
        });

        if (summary) {
          io.to(buildStoreInboxRoomId(String(storeId))).emit(
            "store_conversation_updated",
            summary,
          );
        }
      });
    });

    server.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

// Run every minute to toggle flash sale by schedule window.
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    console.log("Cron đang chạy lúc:", now.toISOString());
    await Product.update(
      { is_flash_sale: true },
      {
        where: {
          flash_sale_start_time: { [Op.lte]: now },
          flash_sale_end_time: { [Op.gte]: now },
          is_flash_sale: false,
        },
      },
    );

    await Product.update(
      {
        is_flash_sale: false,
        flash_sale_price: null,
        flash_sale_start_time: null,
        flash_sale_end_time: null,
      },
      {
        where: {
          flash_sale_end_time: { [Op.lte]: now },
          is_flash_sale: true,
        },
      },
    );
  } catch (error) {
    console.error("Flash sale cron job failed:", error.message);
  }
});
startServer();
