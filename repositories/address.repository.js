// D:\CNM_cu\CongNgheMoi\Backend\repositories\address.repository.js

const { Address } = require("../models");

const createAddress = async (data) => {
  return await Address.create(data);
};

const getByUser = async (userId) => {
  return await Address.findAll({
    where: { user_id: userId },
    order: [["is_default", "DESC"]],
  });
};

const getAddressById = async (id) => {
  return await Address.findByPk(id);
};

const resetDefault = async (userId) => {
  return await Address.update(
    { is_default: false },
    { where: { user_id: userId } }
  );
};

module.exports = {
  createAddress,
  getByUser,
  getAddressById, 
  resetDefault,
};