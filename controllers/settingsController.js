import StoreSettings from '../models/StoreSettings.js';

// Helper: Ensure settings exist
const getOrCreateSettings = async () => {
  let settings = await StoreSettings.findOne();
  if (!settings) {
    settings = await StoreSettings.create({
      membershipDiscountPercentage: 0,
    });
  }
  return settings;
};

// @desc    Get store settings
// @route   GET /api/settings
// @access  Public
export const getSettings = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update store settings
// @route   PUT /api/settings
// @access  Private/Admin
export const updateSettings = async (req, res) => {
  try {
    if (req.user.adminType !== 'permanent') {
      return res.status(403).json({ message: 'Access denied. Only main admins can update store settings.' });
    }

    const { membershipDiscountPercentage } = req.body;

    const settings = await getOrCreateSettings();

    if (membershipDiscountPercentage !== undefined) {
      settings.membershipDiscountPercentage = membershipDiscountPercentage;
    }

    const updatedSettings = await settings.save();
    res.json(updatedSettings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
