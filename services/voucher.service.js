const { Voucher, UserVoucher,Store } = require("../models");
const voucherRepo = require("../repositories/voucher.repository");

class VoucherService {
  // ======================
  // PLATFORM VOUCHER
  // ======================

  async createPlatformVoucher(data, adminId) {
    const existed = await voucherRepo.getPlatformVoucherByCode(
      data.code.toUpperCase()
    );
    if (existed) {
      throw new Error("Mã voucher đã tồn tại");
    }
    return voucherRepo.createPlatformVoucher({
      ...data,
      code: data.code.toUpperCase(),
      created_by: adminId,
    });
  }

  async getPlatformVouchers() {
    return voucherRepo.getPlatformVouchers();
  }


  // ======================
  // SHOP VOUCHER
  // ======================

  async createShopVoucher(storeId, data) {
    const existed = await voucherRepo.getShopVoucherByCode(
      storeId,
      data.code.toUpperCase(),
      

    );
    if (existed) {
      throw new Error("Mã voucher đã tồn tại");
    }
    const store = await Store.findByPk(storeId);

if (!store) {
  throw new Error(
    "Không tìm thấy cửa hàng"
  );
}

const storeType = store.store_type;
    // Kiểm tra giới hạn discount theo loại shop (C2C max 10%, MALL max 20%)
    if (data.voucher_type === "PERCENT") {
      const discountValue = Number(data.discount_value);

      if (storeType === "C2C" && discountValue > 10) {
        throw new Error("Shop C2C chỉ được giảm tối đa 10%");
      }
      if (storeType === "B2C" && discountValue > 20) {
        throw new Error("Shop MALL chỉ được giảm tối đa 20%");
      }
    }

    return voucherRepo.createShopVoucher({
  ...data,
  store_id: storeId,
  code: data.code.toUpperCase(),

  start_date:
    data.start_date ||
    new Date(),

  end_date:
    data.end_date ||
    new Date(
      Date.now() +
      365 * 24 * 60 * 60 * 1000
    )
});
  }

async getShopVouchers(storeId) {
    return voucherRepo.getShopVouchers(storeId);
}

  // ======================
  // USER VOUCHER
  // ======================

async getUserVouchers(userId) {
    return voucherRepo.getUserVouchers(userId);
}

async grantNewUserVouchers(userId) {
    // Dùng repo thay vì gọi model trực tiếp
    const vouchers = await voucherRepo.getPlatformVouchers();
    const newUserVouchers = vouchers.filter(
      (v) => v.target_audience === "NEW_USER" && v.is_active
    );

    for (const voucher of newUserVouchers) {
      try {
        let expiresAt = null;
        if (voucher.validity_hours_after_grant) {
          expiresAt = new Date(
            Date.now() +
              voucher.validity_hours_after_grant * 60 * 60 * 1000
          );
        }

        await UserVoucher.create({
          user_id: userId,
          voucher_id: voucher.id,
          expires_at: expiresAt,
        });
      } catch (err) {
        // Bỏ qua lỗi duplicate (đã có voucher này rồi)
        console.warn(`Không thể cấp voucher ${voucher.code} cho user ${userId}:`, err.message);
      }
    }
}

  // ======================
  // VALIDATE VOUCHER (dùng khi checkout)
  // ======================

  // ======================
  // VALIDATE VOUCHER (dùng khi checkout)
  // ======================
    async validateVoucher(userId, { platform_voucher_id, shop_voucher_id, subtotal }) {
    let shop_discount = 0;
    let platform_discount = 0;
    let freeship_discount = 0;

    console.log(`🔍 [VALIDATE] platform_id=${platform_voucher_id}, shop_id=${shop_voucher_id}, subtotal=${subtotal}`);

    // SHOP VOUCHER
    if (shop_voucher_id) {
      const shopVoucher = await voucherRepo.getShopVoucherById(shop_voucher_id);
      if (shopVoucher && shopVoucher.is_active) {
        if (Number(subtotal) >= Number(shopVoucher.min_order_value || 0)) {
          if (shopVoucher.voucher_type === 'PERCENT') {
            let disc = Math.round(subtotal * (Number(shopVoucher.discount_value) / 100));
            shop_discount = Math.min(disc, Number(shopVoucher.max_discount_amount || disc));
          } else if (shopVoucher.voucher_type === 'FIXED') {
            shop_discount = Number(shopVoucher.discount_value);
          }
        }
      }
    }

    // PLATFORM VOUCHER - FREESHIP (TẠM BỎ QUA KIỂM TRA USER_VOUCHER ĐỂ TEST)
    if (platform_voucher_id) {
      const voucher = await voucherRepo.getPlatformVoucherById(platform_voucher_id);

      if (voucher && voucher.is_active) {
        console.log(`📌 Platform voucher found: ${voucher.code} - ${voucher.voucher_type}`);

        if (voucher.voucher_type === 'FREESHIP') {
          freeship_discount = Number(voucher.freeship_discount_percent || 100);
          console.log(`🔥 FREESHIP ACTIVATED: ${freeship_discount}%`);
        } else if (voucher.voucher_type === 'PERCENT') {
          let disc = Math.round(subtotal * (Number(voucher.discount_value) / 100));
          platform_discount = Math.min(disc, Number(voucher.max_discount_amount || disc));
        } else if (voucher.voucher_type === 'FIXED') {
          platform_discount = Number(voucher.discount_value);
        }
      } else {
        console.log(`❌ Platform voucher not found or inactive`);
      }
    }

    console.log(`📊 FINAL RESULT → shop=${shop_discount}, platform=${platform_discount}, freeship=${freeship_discount}`);

    return {
      shop_discount,
      platform_discount,
      freeship_discount,
      total_discount: shop_discount + platform_discount,
    };
  }
async updatePlatformVoucher(
  id,
  data
) {

  const voucher =
    await voucherRepo.getPlatformVoucherById(
      id
    );

  if (!voucher) {
    throw new Error(
      "Voucher không tồn tại"
    );
  }

  await voucherRepo.updatePlatformVoucher(
    id,
    data
  );

  return voucherRepo.getPlatformVoucherById(
    id
  );
}
async updateShopVoucher(
  id,
  data
) {

  const voucher =
    await voucherRepo.getShopVoucherById(
      id
    );

  if (!voucher) {
    throw new Error(
      "Voucher không tồn tại"
    );
  }

  await voucherRepo.updateShopVoucher(
    id,
    data
  );

  return voucherRepo.getShopVoucherById(
    id
  );
}
async disableShopVoucher(
  id
){
  return voucherRepo.disableShopVoucher(
    id
  );
}
async disablePlatformVoucher(
  id
){
  return voucherRepo.disablePlatformVoucher(
    id
  );
}
async enableShopVoucher(id){

  const voucher =
    await voucherRepo.getShopVoucherById(
      id
    );

  if(!voucher){
    throw new Error(
      "Voucher không tồn tại"
    );
  }

  return voucherRepo.enableShopVoucher(
    id
  );
}
async enablePlatformVoucher(id){

  const voucher =
    await voucherRepo.getPlatformVoucherById(
      id
    );

  if(!voucher){
    throw new Error(
      "Voucher không tồn tại"
    );
  }

  return voucherRepo.enablePlatformVoucher(
    id
  );
}
async getPublicPlatformVouchers() {
    return voucherRepo.getPublicPlatformVouchers();
  }
 
  async saveVoucherForUser(userId, voucherId) {
    const voucher = await voucherRepo.getPlatformVoucherById(voucherId);
    if (!voucher || !voucher.is_active) {
      throw new Error('Voucher không tồn tại hoặc đã hết hạn');
    }
 
    // Kiểm tra đã lưu chưa
    const existing = await voucherRepo.getUserVoucher(userId, voucherId);
    if (existing) {
      throw new Error('Bạn đã lưu mã này rồi');
    }
 
    const expiresAt = voucher.validity_hours_after_grant
      ? new Date(Date.now() + voucher.validity_hours_after_grant * 60 * 60 * 1000)
      : null;
 
    return voucherRepo.createUserVoucher({
      user_id: userId,
      voucher_id: voucherId,
      expires_at: expiresAt,
      is_used: false,
    });
  }
async grantDefaultVouchers(userId, isNewUser = true) {
  return voucherRepo.grantDefaultVouchers(userId, isNewUser);
}
}

module.exports = new VoucherService();