// Backend/controllers/dashboard.controller.js
const dashboardService = require('../services/dashboard.service');

const getStoreOverview = async (req, res) => {
    try {
        const { storeId } = req.params;
        const data = await dashboardService.getStoreOverview(storeId, req.query);

        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Lỗi server'
        });
    }
};

module.exports = {
    getStoreOverview,
};