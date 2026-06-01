-- ==========================================
-- SCRIPT KHỞI TẠO DATABASE E-COMMERCE (C2C & B2C)
-- Dành cho PostgreSQL
-- ==========================================
\encoding UTF8
-- USERS (Người dùng hệ thống: Admin, Customer, Business)
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(50),
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL, -- 'Admin', 'Customer', 'Business'
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

--addresses
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  recipient_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,

  province VARCHAR(100),
  district VARCHAR(100),
  ward VARCHAR(100),
  detail TEXT,

  is_default BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- STORES (Cửa hàng B2C hoặc gian hàng C2C)
-- CREATE TABLE stores (
--     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--     owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
--     store_type VARCHAR(10), -- 'C2C' hoặc 'B2C'
--     store_name VARCHAR(255) NOT NULL,
--     description TEXT,
--     business_license TEXT, -- Chỉ bắt buộc với B2C
--     status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
--     deleted_at TIMESTAMP NULL
-- );
CREATE TABLE stores (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    store_type VARCHAR(10), -- 'C2C' hoặc 'B2C'
    store_name VARCHAR(255) NOT NULL,
    description TEXT,
    business_license TEXT, -- Link ảnh/file giấy phép cho B2C
    status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITHOUT TIME ZONE NULL,
    
    -- Các cột bạn vừa bổ sung để khớp với hình ảnh:
    tax_code VARCHAR(50), 
    representative_name VARCHAR(255),
    identity_card VARCHAR(20)
);

-- Đừng quên tạo Index để tìm kiếm theo owner cho nhanh nhé
CREATE INDEX idx_stores_owner_id ON stores(owner_id);
-- CATEGORIES (Danh mục sản phẩm)
CREATE TABLE categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL, -- Cột bổ sung để làm danh mục cha-con
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- PRODUCTS (Sản phẩm)
CREATE TABLE products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    price BIGINT NOT NULL,
    description TEXT,
    
    -- Hình ảnh & Thuộc tính bổ sung
    images TEXT[],               -- Lưu mảng URL hình ảnh
    colors TEXT[],               -- Mảng các màu sắc (Đen, Trắng, RGB...)
    sizes TEXT[],                -- Mảng các kích thước (S, M, L hoặc 38, 39, 40)
    
    -- Trạng thái hàng hóa
    stock_quantity INT DEFAULT 0,
    condition VARCHAR(10),       -- 'NEW' (B2C), 'USED' (C2C)
    status VARCHAR(20) DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'OUT_OF_STOCK'

    -- Flash Sale
    is_flash_sale BOOLEAN DEFAULT FALSE,
    flash_sale_price BIGINT,
    flash_sale_sold INT DEFAULT 0,
    flash_sale_stock INT DEFAULT 0,
    
    -- Thời gian
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

-- Thêm Index để tìm kiếm sản phẩm theo cửa hàng nhanh hơn
CREATE INDEX idx_products_store_id ON products(store_id);

-- Nếu bảng products đã tồn tại trước đó, dùng các lệnh ALTER dưới đây để bổ sung cột Flash Sale
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_flash_sale BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS flash_sale_price BIGINT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS flash_sale_sold INT DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS flash_sale_stock INT DEFAULT 0;

-- CARTS (Giỏ hàng của người dùng)
CREATE TABLE carts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CART ITEMS (Chi tiết các sản phẩm trong giỏ hàng)
CREATE TABLE cart_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cart_id UUID REFERENCES carts(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ORDERS (Đơn đặt hàng)
CREATE TABLE orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    buyer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    total_amount BIGINT NOT NULL,
    shipping_fee BIGINT DEFAULT 0,
    subtotal_amount BIGINT DEFAULT 0,
    shipping_fee_original BIGINT DEFAULT 0,
    shipping_discount_amount BIGINT DEFAULT 0,
    shop_discount_amount BIGINT DEFAULT 0,
    platform_discount_amount BIGINT DEFAULT 0,
    platform_voucher_id UUID,
    shop_voucher_id UUID,
    discount_amount BIGINT DEFAULT 0,
    shipping_provider VARCHAR(20) NOT NULL DEFAULT 'GHN',
    shipping_service_type VARCHAR(20) NOT NULL DEFAULT 'STANDARD',
    shipping_address TEXT,
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'UNPAID',
    order_status VARCHAR(50) DEFAULT 'PENDING',
    distance_km FLOAT,
    estimated_delivery_time VARCHAR(255),
    cancelled_by_role VARCHAR(50),
    cancelled_by_name VARCHAR(255),
    cancel_reason VARCHAR(100),
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PAYMENTS (Giao dich thanh toan Sepay)
CREATE TABLE payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'SEPAY',
    amount BIGINT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    transaction_id VARCHAR(120),
    transfer_content VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255),
    sender_bank_name VARCHAR(120),
    sender_account_number VARCHAR(80),
    receiver_name VARCHAR(255),
    receiver_bank_name VARCHAR(120),
    receiver_account_number VARCHAR(80),
    paid_at TIMESTAMP,
    raw_webhook JSONB,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ORDER DETAILS (Chi tiết sản phẩm trong đơn hàng)
CREATE TABLE order_details (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    quantity INT NOT NULL,
    price_at_buy BIGINT NOT NULL, -- Lưu lại giá tại thời điểm mua
    size VARCHAR(255),
    color VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- REVIEWS (Đánh giá sản phẩm)
CREATE TABLE reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- NOTIFICATIONS (Hệ thống thông báo)
CREATE TABLE notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50), -- VD: 'SHOP_APPLICATION', 'ORDER_UPDATE'
    is_read BOOLEAN DEFAULT FALSE,
    related_id UUID, -- Chứa ID của Store hoặc Order để liên kết nhanh
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
