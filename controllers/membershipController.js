import User from '../models/User.js';
import cloudinary from '../config/cloudinary.js';

// Helper: extract Cloudinary public_id from a secure_url
const extractPublicId = (url) => {
  if (!url || !url.includes('cloudinary.com')) return null;
  const parts = url.split('/upload/');
  if (parts.length !== 2) return null;
  const withoutVersion = parts[1].replace(/v\d+\//, '');
  return decodeURIComponent(withoutVersion.substring(0, withoutVersion.lastIndexOf('.')));
};

// @desc    Apply for membership (Client) — requires citizenship images + location
// @route   POST /api/membership/apply
// @access  Private
export const applyForMembership = async (req, res) => {
  try {
    const { citizenshipFront, citizenshipBack, location } = req.body;

    // Validate required fields
    if (!citizenshipFront || !citizenshipBack) {
      return res.status(400).json({ message: 'Please upload both front and back of your Citizenship document.' });
    }

    if (!location || !location.trim()) {
      return res.status(400).json({ message: 'Please provide your exact location.' });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.membershipRequestStatus === 'Pending') {
      return res.status(400).json({ message: 'You already have a pending membership request.' });
    }

    if (user.membershipRequestStatus === 'Approved' || user.membershipNumber) {
      return res.status(400).json({ message: 'You are already a member.' });
    }

    user.citizenshipFront = citizenshipFront;
    user.citizenshipBack = citizenshipBack;
    user.location = location.trim();
    user.membershipRequestStatus = 'Pending';

    const updatedUser = await user.save();

    res.json({
      message: 'Membership request submitted successfully',
      membershipRequestStatus: updatedUser.membershipRequestStatus,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all pending membership requests (Admin)
// @route   GET /api/membership/requests
// @access  Private/Admin
export const getPendingRequests = async (req, res) => {
  try {
    // Only permanent admins should fetch this
    if (req.user.adminType !== 'permanent') {
      return res.status(403).json({ message: 'Access denied. Only main admins can view membership requests.' });
    }

    const requests = await User.find({ membershipRequestStatus: 'Pending' }).select('-password').sort({ updatedAt: -1 });

    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Helper function to generate membership ID
const generateMembershipId = () => {
  const chars = '0123456789';
  let result = 'KB-';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// @desc    Approve a membership request (Admin)
// @route   POST /api/membership/approve/:userId
// @access  Private/Admin
export const approveRequest = async (req, res) => {
  try {
    if (req.user.adminType !== 'permanent') {
      return res.status(403).json({ message: 'Access denied. Only main admins can approve membership requests.' });
    }

    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.membershipRequestStatus !== 'Pending') {
      return res.status(400).json({ message: 'This user does not have a pending request.' });
    }

    // Generate unique membership ID
    let unique = false;
    let newId = '';
    while (!unique) {
      newId = generateMembershipId();
      const exists = await User.findOne({ membershipNumber: newId });
      if (!exists) {
        unique = true;
      }
    }

    user.membershipRequestStatus = 'Approved';
    user.membershipNumber = newId;
    user.tier = 'Premium Member'; // Automatically upgrade tier

    await user.save();

    res.json({ message: 'Membership approved successfully', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reject a membership request (Admin)
// @route   POST /api/membership/reject/:userId
// @access  Private/Admin
export const rejectRequest = async (req, res) => {
  try {
    if (req.user.adminType !== 'permanent') {
      return res.status(403).json({ message: 'Access denied. Only main admins can reject membership requests.' });
    }

    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.membershipRequestStatus !== 'Pending') {
      return res.status(400).json({ message: 'This user does not have a pending request.' });
    }

    // Clean up citizenship images from Cloudinary to save storage
    for (const url of [user.citizenshipFront, user.citizenshipBack]) {
      const publicId = extractPublicId(url);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId, { invalidate: true });
          console.log(`Deleted citizenship image: ${publicId}`);
        } catch (err) {
          console.error('Failed to delete citizenship image:', err);
        }
      }
    }

    user.membershipRequestStatus = 'Rejected';
    user.citizenshipFront = '';
    user.citizenshipBack = '';
    user.location = '';
    await user.save();

    res.json({ message: 'Membership request rejected.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Remove membership from a user (Admin) — keeps the account, only strips membership
// @route   POST /api/membership/remove/:userId
// @access  Private/Admin
export const removeMembership = async (req, res) => {
  try {
    if (req.user.adminType !== 'permanent') {
      return res.status(403).json({ message: 'Access denied. Only main admins can remove memberships.' });
    }

    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.membershipNumber && user.membershipRequestStatus !== 'Pending' && user.membershipRequestStatus !== 'Approved') {
      return res.status(400).json({ message: 'This user does not have an active membership.' });
    }

    // Clean up citizenship images from Cloudinary to save storage
    for (const url of [user.citizenshipFront, user.citizenshipBack]) {
      const publicId = extractPublicId(url);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId, { invalidate: true });
          console.log(`Deleted citizenship image: ${publicId}`);
        } catch (err) {
          console.error('Failed to delete citizenship image:', err);
        }
      }
    }

    // Reset all membership-related fields
    user.membershipRequestStatus = 'None';
    user.membershipNumber = '';
    user.tier = 'Standard';
    user.citizenshipFront = '';
    user.citizenshipBack = '';
    user.location = '';

    await user.save();

    res.json({
      message: 'Membership removed successfully. Account is still active.',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        tier: user.tier,
        membershipNumber: user.membershipNumber,
        membershipRequestStatus: user.membershipRequestStatus,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
