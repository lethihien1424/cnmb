//D:\CongNgheMoi_new\CongNgheMoi\Backend\models\index.js
const { Sequelize } = require("sequelize");
const createUserModel = require("./user.model");
const createStoreModel = require("./store.model");
const createCategoryModel = require("./category.model");
const createNotificationModel = require("./notification.model");
const createProductModel = require("./product.model");
const createOrderModel = require("./order.model");
const createOrderDetailModel = require("./orderDetail.model");
const createPaymentModel = require("./payment.model");
const createCartModel = require("./cart.model");
const createCartDetailModel = require("./cartDetail.model");
const createAddressModel = require("./address.model");
const createReviewModel = require("./review.model");
// ── THÊM 2 DÒNG NÀY ──
const createWalletModel = require("./wallet.model");
const createWalletTransactionModel = require("./walletTransaction.model");
// ── VOUCHER MODELS ──
const createVoucherModel = require("./voucher.model");
const createShopVoucherModel = require("./shopVoucher.model");
const createUserVoucherModel = require("./userVoucher.model");
// ── PASSWORD HISTORY MODEL ──
const createPasswordHistoryModel = require("./passwordHistory.model");

const dbName = (process.env.DB_NAME || "cnmoi").trim().replace(/\.sql$/i, "");

const sequelize = new Sequelize(
  dbName,
  process.env.DB_USER || "postgres",
  process.env.DB_PASSWORD || "postgres",
  {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    dialect: "postgres",
    logging: false,
    dialectOptions: {
      client_encoding: "UTF8",
      options: "-c client_encoding=UTF8",
    },
    define: {
      charset: "utf8",
    },
  },
);

const User = createUserModel(sequelize);
const Store = createStoreModel(sequelize);
const Category = createCategoryModel(sequelize);
const Notification = createNotificationModel(sequelize);
const Product = createProductModel(sequelize);
const Order = createOrderModel(sequelize);
const OrderDetail = createOrderDetailModel(sequelize);
const Payment = createPaymentModel(sequelize);
const Cart = createCartModel(sequelize);
const CartDetail = createCartDetailModel(sequelize);
const Address = createAddressModel(sequelize);
const Review = createReviewModel(sequelize);
// ── THÊM 2 DÒNG NÀY ──
const Wallet = createWalletModel(sequelize);
const WalletTransaction = createWalletTransactionModel(sequelize);
// ── VOUCHER INSTANCES ──
const Voucher = createVoucherModel(sequelize);
const ShopVoucher = createShopVoucherModel(sequelize);
const UserVoucher = createUserVoucherModel(sequelize);
const PasswordHistory = createPasswordHistoryModel(sequelize);

User.hasMany(Store, { foreignKey: "owner_id", as: "stores" });
Store.belongsTo(User, { foreignKey: "owner_id", as: "owner" });

Category.hasMany(Product, { foreignKey: "category_id", as: "products" });
Product.belongsTo(Category, { foreignKey: "category_id", as: "category" });

Store.hasMany(Product, { foreignKey: "store_id", as: "products" });
Product.belongsTo(Store, { foreignKey: "store_id", as: "store" });

User.hasMany(Notification, { foreignKey: "recipient_id", as: "notifications" });
Notification.belongsTo(User, { foreignKey: "recipient_id", as: "recipient" });

User.hasMany(Order, { foreignKey: "buyer_id", as: "orders" });
Order.belongsTo(User, { foreignKey: "buyer_id", as: "buyer" });
Store.hasMany(Order, { foreignKey: "store_id", as: "orders" });
Order.belongsTo(Store, { foreignKey: "store_id", as: "store" });

Order.hasMany(OrderDetail, { foreignKey: "order_id", as: "items" });
OrderDetail.belongsTo(Order, { foreignKey: "order_id", as: "order" });
Product.hasMany(OrderDetail, { foreignKey: "product_id", as: "order_details" });
OrderDetail.belongsTo(Product, { foreignKey: "product_id", as: "product" });

Order.hasMany(Payment, { foreignKey: "order_id", as: "payments" });
Payment.belongsTo(Order, { foreignKey: "order_id", as: "order" });
User.hasMany(Payment, { foreignKey: "user_id", as: "payments" });
Payment.belongsTo(User, { foreignKey: "user_id", as: "user" });

User.hasOne(Cart, { foreignKey: "user_id", as: "cart" });
Cart.belongsTo(User, { foreignKey: "user_id", as: "user" });
Cart.hasMany(CartDetail, { foreignKey: "cart_id", as: "items" });
CartDetail.belongsTo(Cart, { foreignKey: "cart_id", as: "cart" });
Product.hasMany(CartDetail, { foreignKey: "product_id", as: "cart_details" });
CartDetail.belongsTo(Product, { foreignKey: "product_id", as: "product" });

User.hasMany(Address, { foreignKey: "user_id", as: "addresses" });
Address.belongsTo(User, { foreignKey: "user_id", as: "user" });

User.hasMany(Review, { foreignKey: "buyer_id", as: "reviews" });
Review.belongsTo(User, { foreignKey: "buyer_id", as: "buyer" });
Product.hasMany(Review, { foreignKey: "product_id", as: "reviews" });
Review.belongsTo(Product, { foreignKey: "product_id", as: "product" });
Order.hasMany(Review, { foreignKey: "order_id", as: "reviews" });
Review.belongsTo(Order, { foreignKey: "order_id", as: "order" });

// ── THÊM ASSOCIATIONS CHO WALLET ──
User.hasOne(Wallet, { foreignKey: "user_id", as: "wallet" });
Wallet.belongsTo(User, { foreignKey: "user_id", as: "user" });
Wallet.hasMany(WalletTransaction, {
  foreignKey: "wallet_id",
  as: "transactions",
});
WalletTransaction.belongsTo(Wallet, { foreignKey: "wallet_id", as: "wallet" });

// ── ASSOCIATIONS CHO VOUCHER ──
User.hasMany(UserVoucher, { foreignKey: "user_id", as: "userVouchers" });
UserVoucher.belongsTo(User, { foreignKey: "user_id", as: "user" });
Voucher.hasMany(UserVoucher, { foreignKey: "voucher_id", as: "userVouchers" });
UserVoucher.belongsTo(Voucher, { foreignKey: "voucher_id", as: "voucher" });
Store.hasMany(ShopVoucher, { foreignKey: "store_id", as: "shopVouchers" });
ShopVoucher.belongsTo(Store, { foreignKey: "store_id", as: "store" });

// ── ASSOCIATIONS CHO PASSWORD HISTORY ──
User.hasMany(PasswordHistory, {
  foreignKey: "user_id",
  as: "passwordHistories",
});
PasswordHistory.belongsTo(User, { foreignKey: "user_id", as: "user" });

module.exports = {
  sequelize,
  User,
  Address,
  Store,
  Category,
  Product,
  Notification,
  Order,
  OrderDetail,
  Payment,
  Cart,
  CartDetail,
  Review,
  // ── THÊM 2 DÒNG NÀY ──
  Wallet,
  WalletTransaction,
  // ── VOUCHER ──
  Voucher,
  ShopVoucher,
  UserVoucher,
  // ── PASSWORD HISTORY ──
  PasswordHistory,
};
