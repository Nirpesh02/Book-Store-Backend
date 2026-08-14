import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import User from './models/User.js';

dotenv.config();

const migrate = async () => {
  try {
    await connectDB();
    const result = await User.updateMany(
      { role: 'admin', adminType: { $exists: false } },
      { $set: { adminType: 'permanent' } }
    );
    
    // Also explicitly update any admin to permanent just in case the schema default didn't trigger retroactively
    await User.updateMany(
      { role: 'admin' },
      { $set: { adminType: 'permanent' } }
    );
    
    console.log('Successfully updated existing admins to Permanent Admins.');
    process.exit(0);
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
};

migrate();
