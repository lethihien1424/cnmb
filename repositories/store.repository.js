// repositories/store.repository.js
const { Op } = require("sequelize");
const { Store, User } = require("../models");

const createStore = async (payload) => {
  return Store.create(payload);
};

const findPendingB2CStores = async () => {
  return Store.findAll({
    where: {
      status: "PENDING",
      // Thử cả hai trường hợp nếu bạn không chắc Model định nghĩa thế nào
      [Op.or]: [
        { store_type: "B2C" },
        { storeType: "B2C" }
      ]
    },
    include: [{ model: User, as: "owner", attributes: ["username", "email"] }],
    order: [["createdAt", "ASC"]],
  });
};

const findStoreById = async (id) => {
  return Store.findByPk(id);
};

const findApprovedStoreByOwner = async (ownerId) => {
  return Store.findOne({
    where: {
      owner_id: ownerId,
      status: "APPROVED",
    },
    order: [["created_at", "DESC"]],
  });
};

const findLatestStoreByOwner = async (ownerId, storeType) => {
  const where = {
    owner_id: ownerId,
  };

  if (storeType) {
    where.store_type = storeType;
  }

  return Store.findOne({
    where,
    order: [["created_at", "DESC"]],
  });
};

const countStoresByDossierKey = async (dossierKey) => {
  if (!dossierKey) {
    return 0;
  }

  return Store.count({
    where: {
      dossier_key: dossierKey,
    },
  });
};

module.exports = {
  createStore,
  findPendingB2CStores,
  findStoreById,
  findApprovedStoreByOwner,
  findLatestStoreByOwner,
  countStoresByDossierKey,
};
