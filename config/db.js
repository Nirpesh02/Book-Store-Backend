import mongoose from 'mongoose';

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

export const connectDB = async () => {
  if (!mongoUri) {
    throw new Error('MongoDB connection string is missing. Set MONGO_URI or MONGODB_URI in backend/.env');
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log(`MongoDB Connection Established Successfully`);
    return conn;
  } catch (error) {
    console.error(`Database Connection Error: ${error.message}`);
    throw error;
  }
};