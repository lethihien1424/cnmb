const { Notification } = require("../models");

const createNotification = async (payload) => {
  return Notification.create(payload);
};

module.exports = {
  createNotification,
};
