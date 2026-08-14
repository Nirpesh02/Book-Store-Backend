import User from '../models/User.js';
import Transaction from '../models/Transaction.js';

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private/Admin
export const getCustomers = async (req, res) => {
  try {
    // Fetch clients and permanent admins
    const customers = await User.find({ 
      $or: [
        { role: 'client' },
        { role: 'admin', adminType: 'permanent' }
      ]
    }).select('-password').sort({ role: 1, createdAt: -1 }); // Sort by role to put admin at top

    // Get active orders count for each customer
    const customersWithOrders = await Promise.all(
      customers.map(async (customer) => {
        const activeOrders = await Transaction.countDocuments({
          userId: customer._id,
          status: 'Purchased',
        });
        return {
          _id: customer._id,
          name: customer.name,
          email: customer.email,
          role: customer.role,
          tier: customer.tier,
          status: customer.status,
          adminType: customer.adminType,
          membershipNumber: customer.membershipNumber,
          activeOrders,
        };
      })
    );

    res.json(customersWithOrders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Register a customer (by admin)
// @route   POST /api/customers
// @access  Private/Admin
export const addCustomer = async (req, res) => {
  try {
    const { name, email, password, tier } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'A user with this email already exists' });
    }

    const customer = await User.create({
      name,
      email: email.toLowerCase(),
      password: password || '123',
      role: 'client',
      tier: tier || 'Standard',
      status: 'Active',
    });

    res.status(201).json({
      _id: customer._id,
      name: customer.name,
      email: customer.email,
      role: customer.role,
      tier: customer.tier,
      status: customer.status,
      activeOrders: 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Toggle customer status (Active/Suspended)
// @route   PATCH /api/customers/:id/toggle-status
// @access  Private/Admin
export const toggleCustomerStatus = async (req, res) => {
  try {
    const customer = await User.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    customer.status = customer.status === 'Active' ? 'Suspended' : 'Active';
    await customer.save();

    res.json({
      _id: customer._id,
      name: customer.name,
      email: customer.email,
      status: customer.status,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a customer
// @route   DELETE /api/customers/:id
// @access  Private/Admin
export const deleteCustomer = async (req, res) => {
  try {
    const customer = await User.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    if (req.user.role === 'admin' && req.user.adminType === 'temporary') {
      return res.status(403).json({ message: 'Temporary admins cannot delete customers' });
    }

    if (customer.role === 'admin') {
      return res.status(403).json({ message: 'Cannot delete admins from this route' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Customer removed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
