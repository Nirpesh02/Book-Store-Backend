import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: true,
    },
    bookTitle: {
      type: String,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      default: 1,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    orderDate: {
      type: String,
      default: () => new Date().toISOString().split('T')[0],
    },
    status: {
      type: String,
      enum: ['Purchased', 'Pending Refund', 'Refunded', 'Refund Rejected', 'Pending Payment', 'Payment Failed'],
      default: 'Purchased',
    },
    activity: {
      type: String,
      enum: ['Purchase', 'Refund'],
      default: 'Purchase',
    },
    adminComment: {
      type: String,
      default: '',
    },
    membershipIdUsed: {
      type: String,
      default: null,
    },
    deliveryPhone: {
      type: String,
      default: '',
    },
    deliveryZone: {
      type: String,
      enum: ['Gauradaha Bajar', 'Gauradaha Outside Bajar', 'Outside Gauradaha', 'Store Pickup'],
      default: 'Store Pickup',
    },
    deliveryStatus: {
      type: String,
      enum: ['Pending', 'Delivered', 'Not Applicable'],
      default: 'Not Applicable',
    },
    deliveryAddressDetail: {
      type: String,
      default: '',
    },
    deliveryCharge: {
      type: Number,
      default: 0,
    },
    estimatedDeliveryHours: {
      type: Number,
      default: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['eSewa', 'Khalti', 'Cash'],
      default: 'Cash',
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Completed', 'Failed'],
      default: 'Completed',
    },
    paymentId: {
      type: String,
      default: '',
    },
    transactionUuid: {
      type: String,
      default: '',
    },
    discountApplied: {
      type: Number,
      default: 0,
    },
    pointsEarned: {
      type: Number,
      default: 0,
    },
    pointsRedeemed: {
      type: Number,
      default: 0,
    }
  },
  { timestamps: true }
);

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
