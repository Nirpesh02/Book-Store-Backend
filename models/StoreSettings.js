import mongoose from 'mongoose';

const storeSettingsSchema = new mongoose.Schema(
  {
    membershipDiscountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    // We can add other global settings here in the future
  },
  { timestamps: true }
);

const StoreSettings = mongoose.model('StoreSettings', storeSettingsSchema);
export default StoreSettings;
