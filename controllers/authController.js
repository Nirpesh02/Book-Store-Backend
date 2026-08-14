import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import cloudinary from '../config/cloudinary.js';

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// @desc    Register new user (customer)
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide name, email, and password' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      if (existingUser.status === 'Pending') {
        return res.status(400).json({ message: 'This email verification is going on. Please wait for admin approval.' });
      }
      return res.status(400).json({ message: 'An account with this email address already exists!' });
    }

    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'client',
      status: 'Pending',
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      adminType: user.adminType,
      tier: user.tier,
      status: user.status,
      avatar: user.avatar,
      membershipRequestStatus: user.membershipRequestStatus,
      membershipNumber: user.membershipNumber,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, password, roleFilter } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password!' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password!' });
    }

    // Role filter check (admin tab should only allow admin users)
    if (roleFilter === 'admin' && user.role !== 'admin') {
      return res.status(403).json({
        message: 'Access Denied: This account is a Customer and cannot access Admin Panel.',
      });
    }

    if (roleFilter === 'client' && user.role !== 'client') {
      return res.status(403).json({
        message: 'Access Denied: This account is an Admin and cannot login via the Customer portal.',
      });
    }

    if (user.status === 'Pending') {
      return res.status(403).json({ message: 'Unable to login. Your account is not verified yet. Please wait for admin approval.' });
    }

    if (user.status === 'Suspended') {
      return res.status(403).json({ message: 'Account is suspended. Contact admin.' });
    }

    const token = generateToken(user._id);

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      adminType: user.adminType,
      tier: user.tier,
      status: user.status,
      avatar: user.avatar,
      membershipRequestStatus: user.membershipRequestStatus,
      membershipNumber: user.membershipNumber,
      token,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      // Only admins can update their name and email
      if (user.role === 'admin') {
        user.name = req.body.name || user.name;
        user.email = req.body.email ? req.body.email.toLowerCase() : user.email;
      }

      if (req.body.password) {
        user.password = req.body.password;
      }

      if (req.body.avatar && req.body.avatar !== user.avatar) {
        // Delete old avatar from Cloudinary if it exists
        if (user.avatar && user.avatar.includes('cloudinary.com')) {
          try {
            const parts = user.avatar.split('/upload/');
            if (parts.length === 2) {
              const urlWithoutVersion = parts[1].replace(/v\d+\//, '');
              // Cloudinary URLs encode spaces as %20, we need to decode it for the publicId
              const publicId = decodeURIComponent(urlWithoutVersion.substring(0, urlWithoutVersion.lastIndexOf('.')));
              
              const deleteResult = await cloudinary.uploader.destroy(publicId, { invalidate: true });
              console.log(`Deleted old avatar: ${publicId}, Status:`, deleteResult.result);
            }
          } catch (cloudinaryError) {
            console.error('Failed to delete old avatar from Cloudinary:', cloudinaryError);
          }
        }
        
        user.avatar = req.body.avatar;
      }

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        adminType: updatedUser.adminType,
        tier: updatedUser.tier,
        status: updatedUser.status,
        avatar: updatedUser.avatar,
        membershipRequestStatus: updatedUser.membershipRequestStatus,
        membershipNumber: updatedUser.membershipNumber,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Forgot password — reset to a random temp password
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Please provide your email address' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: 'No account found with that email address.' });
    }

    // Generate a random 8-character temporary password
    const tempPassword = crypto.randomBytes(4).toString('hex'); // e.g. "a3f1b9c2"

    user.password = tempPassword;
    await user.save();

    res.json({
      message: 'Password has been reset successfully!',
      tempPassword,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Public
export const logout = (req, res) => {
  res.cookie('token', '', { httpOnly: true, expires: new Date(0) });
  res.json({ message: 'Logged out successfully' });
};
