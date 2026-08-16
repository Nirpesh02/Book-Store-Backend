import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 1,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['admin', 'client'],
      default: 'client',
    },
    adminType: {
      type: String,
      enum: ['permanent', 'temporary'],
      default: 'permanent',
    },
    tier: {
      type: String,
      enum: ['Standard', 'Premium Member', 'Student'],
      default: 'Standard',
    },
    status: {
      type: String,
      enum: ['Active', 'Suspended'],
      default: 'Active',
    },
    avatar: {
      type: String,
      default: '',
    },
    pointsBalance: {
      type: Number,
      default: 0,
    },
    membershipRequestStatus: {
      type: String,
      enum: ['None', 'Pending', 'Approved', 'Rejected'],
      default: 'None',
    },
    membershipNumber: {
      type: String,
      default: null,
    },
    citizenshipFront: {
      type: String,
      default: '',
    },
    citizenshipBack: {
      type: String,
      default: '',
    },
    location: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
