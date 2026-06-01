//D:\CNM_new6\CongNgheMoi\Backend\app.js
require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth.route");
const adminStoreRoutes = require("./routes/admin.store.route");
const productRoutes = require("./routes/product.route");
const orderRoutes = require("./routes/order.route");
const categoryRoutes = require("./routes/category.route");
const cartRoutes = require("./routes/cart.route");
const notificationRoutes = require("./routes/notification.route");
const paymentRoutes = require("./routes/payment.route");
const reviewRoutes = require("./routes/review.route");
const userRoutes = require("./routes/user.route"); // 🔥 THÊM
const addressRoutes = require("./routes/address.route");
const ghnRoutes = require("./routes/ghn.route");
// Thêm dòng này ở phần require
const shippingRoutes = require("./routes/shipping.route");
const storeRoutes = require("./routes/store.route");
const geocodeRoute = require("./routes/geocode.route");
const dashboardRoutes = require("./routes/dashboard.route");

const chatRoutes = require("./routes/chat.route");

const voucherRoutes = require("./routes/voucher.route");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/notifications", notificationRoutes);
app.use("/api/stores", adminStoreRoutes);
app.use("/api/stores", storeRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminStoreRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/categories", categoryRoutes); //
app.use("/api/cart", cartRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/sepay", paymentRoutes);
app.use("/sepay", paymentRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/users", userRoutes); // 🔥 THÊM
app.use("/api/addresses", addressRoutes);
app.use("/api/ghn", ghnRoutes);

// ==================== THÊM DÒNG NÀY VÀO CUỐI PHẦN ROUTES ====================
app.use("/api/shipping", shippingRoutes);
app.use("/api/geocode", geocodeRoute);
app.get("/health", (req, res) => {
  res.status(200).json({ message: "Backend is running" });
});
app.use("/api/dashboard", require("./routes/dashboard.route"));

app.use("/api/chat", chatRoutes);

app.use("/api/vouchers", voucherRoutes);

// GLOBAL ERROR HANDLER
app.use((err, req, res, next) => {
  console.error(err);

  return res.status(500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

module.exports = app;
