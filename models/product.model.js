// //D:\CNM_cu\CongNgheMoi\Backend\models\product.model.js
// const { DataTypes } = require("sequelize");

// module.exports = (sequelize) => {
//   const Product = sequelize.define(
//     "Product",
//     {
//       id: {
//         type: DataTypes.UUID,
//         defaultValue: DataTypes.UUIDV4,
//         primaryKey: true,
//       },
//       store_id: {
//         type: DataTypes.UUID,
//         allowNull: true,
//       },
//       category_id: {
//         type: DataTypes.UUID,
//         allowNull: true,
//       },
//       name: {
//         type: DataTypes.STRING(255),
//         allowNull: false,
//       },
//       price: {
//         type: DataTypes.BIGINT,
//         allowNull: false,
//       },
//       description: {
//         type: DataTypes.TEXT,
//         allowNull: true,
//       },
//       images: {
//         type: DataTypes.ARRAY(DataTypes.TEXT),
//         allowNull: true,
//       },
//       stock_quantity: {
//         type: DataTypes.INTEGER,
//         defaultValue: 0,
//       },
//       condition: {
//         type: DataTypes.ENUM("NEW", "USED"),
//         allowNull: false,
//       },
//       status: {
//         type: DataTypes.STRING(20),
//         defaultValue: "AVAILABLE",
//       },
//       is_flash_sale: {
//         type: DataTypes.BOOLEAN,
//         defaultValue: false,
//       },
//       flash_sale_price: {
//         type: DataTypes.BIGINT,
//         allowNull: true,
//       },
//       flash_sale_sold: {
//         type: DataTypes.INTEGER,
//         defaultValue: 0,
//       },
//       flash_sale_stock: {
//         type: DataTypes.INTEGER,
//         defaultValue: 0,
//       },
//       flash_sale_start_time: {
//         type: DataTypes.DATE,
//         allowNull: true,
//       },
//       flash_sale_end_time: {
//         type: DataTypes.DATE,
//         allowNull: true,
//       },
//       deleted_at: {
//         type: DataTypes.DATE,
//         allowNull: true,
//       },
//     },
//     {
//       tableName: "products",
//       timestamps: true,
//       underscored: true,
//       paranoid: true,
//       deletedAt: "deleted_at",
//     },
//   );
//   return Product;
// };
// D:\CNM_cu\CongNgheMoi\Backend\models\product.model.js
const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Product = sequelize.define(
    "Product",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      store_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      category_id: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      price: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      images: {
        type: DataTypes.ARRAY(DataTypes.TEXT),
        allowNull: true,
      },
      // Thêm trường variants để lưu phân loại hàng hóa (linh hoạt các thuộc tính)
      // variants: {
      //   type: DataTypes.JSONB,
      //   allowNull: true,
      //   defaultValue: [],
      //   comment:
      //     "Lưu danh sách phân loại hàng linh hoạt (VD: size, color, dòng máy...)",
      // },
      // Trong file product.model.js
      variants: {
        type: DataTypes.JSON, // Rất quan trọng: Phải là JSON hoặc JSONB
        allowNull: true,
      },
      size: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      color: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      type: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      is_bulky: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      stock_quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      condition: {
        type: DataTypes.ENUM("NEW", "USED"),
        allowNull: false,
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: "AVAILABLE",
      },
      is_flash_sale: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      flash_sale_price: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      flash_sale_sold: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      flash_sale_stock: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
      },
      flash_sale_start_time: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      flash_sale_end_time: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "products",
      timestamps: true,
      underscored: true,
      paranoid: true,
      deletedAt: "deleted_at",
    },
  );
  return Product;
};
