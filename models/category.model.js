const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Category = sequelize.define(
    "Category",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
      },
      parent_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      tableName: "categories",
      timestamps: true,
      underscored: true, // Rất quan trọng để khớp với created_at, updated_at
      paranoid: true, // Khớp với cột deleted_at bạn đang có
      deletedAt: "deleted_at",
    },
  );

  return Category;
};
