import User from '../models/User.js';

// @desc    Get all temporary admins
// @route   GET /api/admins
// @access  Private/PermanentAdmin
export const getTemporaryAdmins = async (req, res) => {
  try {
    const subAdmins = await User.find({ role: 'admin', adminType: 'temporary' }).select('-password').sort({ createdAt: -1 });
    res.json(subAdmins);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a temporary admin
// @route   POST /api/admins
// @access  Private/PermanentAdmin
export const createTemporaryAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'A user with this email already exists' });
    }

    const subAdmin = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'admin',
      adminType: 'temporary',
      status: 'Active',
    });

    res.status(201).json({
      _id: subAdmin._id,
      name: subAdmin.name,
      email: subAdmin.email,
      role: subAdmin.role,
      adminType: subAdmin.adminType,
      status: subAdmin.status,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a temporary admin
// @route   DELETE /api/admins/:id
// @access  Private/PermanentAdmin
export const deleteTemporaryAdmin = async (req, res) => {
  try {
    const subAdmin = await User.findById(req.params.id);
    if (!subAdmin) {
      return res.status(404).json({ message: 'Sub-Admin not found' });
    }

    if (subAdmin.role !== 'admin' || subAdmin.adminType !== 'temporary') {
      return res.status(403).json({ message: 'You can only delete temporary admins from this route' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Sub-Admin removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
