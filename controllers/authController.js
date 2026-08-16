import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import cloudinary from '../config/cloudinary.js';
import nodemailer from 'nodemailer';

// Helper to send Verification Email
const sendVerificationEmail = async (email, token) => {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use STARTTLS instead of implicit TLS (port 465) to fix ENETUNREACH in Render/some ISPs
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const verifyUrl = `https://book-store-backend-39qh.onrender.com/api/auth/verify/${token}`;

  const mailOptions = {
    from: process.env.EMAIL_USER || 'no-reply@bookverse.com',
    to: email,
    subject: 'Bookverse - Please verify your email',
    html: `
      <h2>Welcome to Bookverse!</h2>
      <p>Thank you for registering. Please click the link below to verify your email address.</p>
      <a href="${verifyUrl}" style="padding: 10px 20px; background-color: #7a9b83; color: white; text-decoration: none; border-radius: 5px; display: inline-block; margin: 10px 0;">Verify Email</a>
      <p>Or copy and paste this URL into your browser:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    `,
  };

  await transporter.sendMail(mailOptions);
};

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
      return res.status(400).json({ message: 'An account with this email address already exists!' });
    }

    // Generate Verification Token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create user
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'client',
      verificationToken,
      isVerified: false,
    });

    // Send verification email
    try {
      await sendVerificationEmail(user.email, verificationToken);
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      console.log('--- VERIFICATION BYPASS ---');
      console.log(`Render Free blocks SMTP. Auto-verifying user. Verification Link would be: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/?status=success`);
      
      // Since Render free blocks SMTP (ports 465/587), auto-verify if email fails
      // so the user can still login and test the platform.
      user.isVerified = true;
      await user.save();
    }

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

    if (!user.isVerified && user.role === 'client') {
      return res.status(403).json({ message: 'Please verify your email address before logging in. Check your inbox.' });
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

// @desc    Verify email
// @route   GET /api/auth/verify/:token
// @access  Public
export const verifyEmail = async (req, res) => {
  // Use frontend URL from .env or default to localhost:5173 (Vite standard)
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

  try {
    const { token } = req.params;

    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      // Redirect to frontend with error status
      return res.redirect(`${FRONTEND_URL}/?status=error`);
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    // Redirect to frontend with success status
    res.redirect(`${FRONTEND_URL}/?status=success`);
  } catch (error) {
    console.error('Verification error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/?status=error`);
  }
};
