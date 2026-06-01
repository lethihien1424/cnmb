const adminStoreService = require("../services/admin.store.service");

const getPendingStores = async (req, res) => {
  try {
    const stores = await adminStoreService.getPendingB2CStores();
    return res.status(200).json({
      message: "Get pending stores success",
      data: stores,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};

const updateStoreStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    const store = await adminStoreService.updateStoreStatus(id, status, reason);

    return res.status(200).json({
      message: "Update store status success",
      data: store,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};

const getMyStoreStatus = async (req, res) => {
  try {
    const data = await adminStoreService.getCurrentUserStoreStatus(
      req.user.userId,
      req.user.role,
    );

    return res.status(200).json({
      message: "Get my store status success",
      data,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};

const getDashboardStats = async (req, res) => {
  try {
    const stats = await adminStoreService.getAdminDashboardStats();

    return res.status(200).json({
      message: "Get admin dashboard stats success",
      data: stats,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};

const getPlatformIncomeSummary = async (req, res) => {
  try {
    const summary = await adminStoreService.getAdminPlatformIncomeSummary();

    return res.status(200).json({
      message: "Get platform income summary success",
      data: summary,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};

const getPlatformIncomeReport = async (req, res) => {
  try {
    const { period, from, to } = req.query;
    const report = await adminStoreService.getAdminPlatformIncomeReport({
      period,
      from,
      to,
    });

    return res.status(200).json({
      message: "Get platform income report success",
      data: report,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};

const getStoreDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const store = await adminStoreService.getAdminStoreDetail(id);

    return res.status(200).json({
      message: "Get store detail success",
      data: store,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};

const getStoresDetails = async (req, res) => {
  try {
    const stores = await adminStoreService.getAdminStoresWithDetails();

    return res.status(200).json({
      message: "Get stores detail success",
      data: stores,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};

const getCustomersDetails = async (req, res) => {
  try {
    const customers = await adminStoreService.getAdminCustomersWithDetails();

    return res.status(200).json({
      message: "Get customers detail success",
      data: customers,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};

const getCustomerDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await adminStoreService.getAdminCustomerDetail(id);

    return res.status(200).json({
      message: "Get customer detail success",
      data: customer,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};

const getUsersDetails = async (req, res) => {
  try {
    const users = await adminStoreService.getAdminUsersWithDetails();

    return res.status(200).json({
      message: "Get users detail success",
      data: users,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};

const getUserDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await adminStoreService.getAdminUserDetail(id);

    return res.status(200).json({
      message: "Get user detail success",
      data: user,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      message: error.message || "Internal server error",
    });
  }
};

module.exports = {
  getPendingStores,
  updateStoreStatus,
  getMyStoreStatus,
  getDashboardStats,
  getPlatformIncomeSummary,
  getPlatformIncomeReport,
  getStoreDetails,
  getStoresDetails,
  getCustomersDetails,
  getCustomerDetail,
  getUsersDetails,
  getUserDetail,
};
