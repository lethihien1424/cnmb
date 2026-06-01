const {
  Voucher,
  ShopVoucher,
  UserVoucher,
  Order,
} = require("../models");

class VoucherRepository {
  // ======================
  // PLATFORM VOUCHER
  // ======================

  async createPlatformVoucher(data) {
    return Voucher.create(data);
  }

  async getPlatformVouchers() {
    return Voucher.findAll({
      order: [["created_at", "DESC"]],
    });
  }

  async getPlatformVoucherById(id) {
    return Voucher.findByPk(id);
  }

  async getPlatformVoucherByCode(code) {
    return Voucher.findOne({
      where: { code },
    });
  }

  async updatePlatformVoucher(id, data) {
    return Voucher.update(data, {
      where: { id },
    });
  }


  // ======================
  // SHOP VOUCHER
  // ======================

  async createShopVoucher(data) {
    return ShopVoucher.create(data);
  }

  async getShopVoucherById(id) {
    return ShopVoucher.findByPk(id);
  }

  async getShopVoucherByCode(
    storeId,
    code
  ) {
    return ShopVoucher.findOne({
      where: {
        store_id: storeId,
        code,
      },
    });
  }

  async getShopVouchers(storeId) {

  const vouchers =
    await ShopVoucher.findAll({
      where: {
        store_id: storeId,
        is_active: true
      },
      order: [
        ["created_at", "DESC"]
      ]
    });

  return vouchers.filter(
    voucher =>
      voucher.quantity === null ||
      voucher.used_count <
      voucher.quantity
  );
}
  async updateShopVoucher(id, data) {
    return ShopVoucher.update(data, {
      where: { id },
    });
  }

  // ======================
  // USER VOUCHER
  // ======================

  async createUserVoucher(data) {
    return UserVoucher.create(data);
  }

  async getUserVoucher(
    userId,
    voucherId
  ) {
    return UserVoucher.findOne({
      where: {
        user_id: userId,
        voucher_id: voucherId,
      },
    });
  }

  async getUserVouchers(userId) {
    return UserVoucher.findAll({
      where: {
        user_id: userId,
      },
      include: [
        {
          model: Voucher,
          as: "voucher",
        },
      ],
      order: [["created_at", "DESC"]],
    });
  }
  async getActivePlatformVoucher(
    voucherId
    ) {
    return Voucher.findOne({
        where: {
        id: voucherId,
        is_active: true,
        },
    });
    }

    async getActiveShopVoucher(
    voucherId
    ) {
    return ShopVoucher.findOne({
        where: {
        id: voucherId,
        is_active: true,
        },
    });
    }
    async incrementPlatformVoucherUsedCount(
  voucherId
) {
  return Voucher.increment(
    "used_count",
    {
      by: 1,
      where: {
        id: voucherId,
      },
    }
  );
}

async incrementShopVoucherUsedCount(
  voucherId
) {
  return ShopVoucher.increment(
    "used_count",
    {
      by: 1,
      where: {
        id: voucherId,
      },
    }
  );
}
async markUserVoucherUsed(
  userId,
  voucherId,
  orderId
) {
  return UserVoucher.update(
    {
      is_used: true,
      used_at: new Date(),
      used_on_order_id:
        orderId,
    },
    {
      where: {
        user_id: userId,
        voucher_id: voucherId,
      },
    }
  );
}
async countPlatformVoucherUsage(
  userId,
  voucherId
) {
  return Order.count({
    where: {
      buyer_id: userId,
      platform_voucher_id:
        voucherId,
    },
  });
}

async countShopVoucherUsage(
  userId,
  voucherId
) {
  return Order.count({
    where: {
      buyer_id: userId,
      shop_voucher_id:
        voucherId,
    },
  });
}

async disableShopVoucher(
  id
){
  return ShopVoucher.update(
    {
      is_active:false
    },
    {
      where:{id}
    }
  );
}

async disablePlatformVoucher(
  id
){
  return Voucher.update(
    {
      is_active:false
    },
    {
      where:{id}
    }
  );
}
async enableShopVoucher(id){
  return ShopVoucher.update(
    {
      is_active:true
    },
    {
      where:{ id }
    }
  );
}
async enablePlatformVoucher(id){
  return Voucher.update(
    {
      is_active: true
    },
    {
      where: { id }
    }
  );
}
async getPublicPlatformVouchers() {
    const { Op } = require('sequelize');
    return Voucher.findAll({
      where: {
        is_active: true,
        target_audience: { [Op.in]: ['ALL'] },
      },
      order: [['created_at', 'DESC']],
    });
  }
async grantDefaultVouchers(userId, isNewUser = true) {
  try {
    const { Op } = require('sequelize');

    const whereCondition = {
    is_active: true,
    target_audience: 'NEW_USER'
    };

    const defaultVouchers = await Voucher.findAll({
      where: whereCondition
    });

    const grantedVouchers = [];

    for (const v of defaultVouchers) {
      // Chỉ cấp voucher đặc biệt: Freeship, giảm >=30%, giảm >=80k
      const shouldGrant = 
        v.voucher_type === 'FREESHIP' ||
        (v.voucher_type === 'PERCENT' && Number(v.discount_value) >= 30) ||
        (v.voucher_type === 'FIXED' && Number(v.discount_value) >= 80000);

      if (shouldGrant) {
        const expiresAt = v.validity_hours_after_grant 
          ? new Date(Date.now() + v.validity_hours_after_grant * 60 * 60 * 1000)
          : null;

        const userVoucher = await UserVoucher.create({
          user_id: userId,
          voucher_id: v.id,
          expires_at: expiresAt,
          is_used: false,
        });

        grantedVouchers.push(userVoucher);
      }
    }

    return grantedVouchers;
  } catch (error) {
    console.error('Grant default vouchers error:', error);
    throw error;
  }
}
}
module.exports = new VoucherRepository();