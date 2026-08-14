import Transaction from '../models/Transaction.js';
import Book from '../models/Book.js';
import crypto from 'crypto';
import User from '../models/User.js';
import StoreSettings from '../models/StoreSettings.js';
import { sendRefundEmail } from '../utils/emailService.js';

const getTierMultiplier = (tier) => {
  if (tier === 'Premium Member') return 0.02;
  if (tier === 'Student') return 0.015;
  return 0.01;
};

// @desc    Get all transactions (admin gets all, client gets own)
// @route   GET /api/transactions
// @access  Private
export const getTransactions = async (req, res) => {
  try {
    let transactions;
    const filter = { status: { $nin: ['Pending Payment', 'Payment Failed'] } };
    
    if (req.user.role === 'admin') {
      transactions = await Transaction.find(filter).sort({ createdAt: -1 }).populate('userId', 'name email');
    } else {
      transactions = await Transaction.find({ ...filter, userId: req.user._id }).sort({ createdAt: -1 }).populate('userId', 'name email');
    }
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Purchase a book
// @route   POST /api/transactions/purchase
// @access  Private
export const purchaseBook = async (req, res) => {
  try {
    const { bookId, quantity = 1, paymentMethod = 'Cash', paymentId = '', pointsToRedeem = 0, providedMembershipId = null, deliveryData = null } = req.body;

    let deliveryCharge = 0;
    let estimatedDeliveryHours = 0;
    let deliveryPhone = '';
    let deliveryZone = 'Store Pickup';
    let deliveryAddressDetail = '';

    if (deliveryData && deliveryData.deliveryZone !== 'Store Pickup') {
      deliveryPhone = deliveryData.deliveryPhone || '';
      deliveryZone = deliveryData.deliveryZone;
      deliveryAddressDetail = deliveryData.deliveryAddressDetail || '';

      if (!/^\d{10}$/.test(deliveryPhone)) {
        return res.status(400).json({ message: 'Phone number must be exactly 10 digits.' });
      }

      if (quantity >= 3 && deliveryZone !== 'Outside Gauradaha') {
        deliveryCharge = 0;
      } else {
        if (deliveryZone === 'Gauradaha Bajar') deliveryCharge = 50;
        else if (deliveryZone === 'Gauradaha Outside Bajar') deliveryCharge = 150;
        else if (deliveryZone === 'Outside Gauradaha') deliveryCharge = 100 * quantity;
      }

      if (deliveryZone === 'Outside Gauradaha') estimatedDeliveryHours = 24;
      else estimatedDeliveryHours = 12;
    }

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    if (book.available < quantity) {
      return res.status(400).json({ message: 'Not enough books in stock' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const settings = await StoreSettings.findOne();
    const discountActive = settings && settings.membershipDiscountPercentage > 0;
    const isVerificationRequired = user.membershipNumber && discountActive;

    if (isVerificationRequired) {
      if (!providedMembershipId) {
        return res.status(400).json({ message: 'Membership ID is required for Premium Members to checkout.' });
      }
      if (providedMembershipId !== user.membershipNumber) {
        return res.status(400).json({ message: 'Invalid Membership ID provided.' });
      }
    }

    if (pointsToRedeem > 0) {
      if (!user.membershipNumber) {
        return res.status(403).json({ message: 'Only active members can redeem points.' });
      }
      if (user.pointsBalance < pointsToRedeem) {
        return res.status(400).json({ message: 'Insufficient points balance' });
      }
    }

    const isEsewa = paymentMethod === 'eSewa';

    if (!isEsewa) {
      // Atomically decrease available count to prevent race conditions
      const updatedBook = await Book.findOneAndUpdate(
        { _id: bookId, available: { $gte: quantity } },
        { $inc: { available: -quantity } },
        { new: true }
      );

      if (!updatedBook) {
        return res.status(400).json({ message: 'Due to high demand, this book just went out of stock!' });
      }
    }

    const pricePerItem = book.price * (1 - (book.discount || 0) / 100);
    let totalAmount = pricePerItem * quantity;

    // Apply global membership discount if applicable
    let memberDiscountApplied = 0;
    if (user.membershipNumber) {
      const settings = await StoreSettings.findOne();
      if (settings && settings.membershipDiscountPercentage > 0) {
        memberDiscountApplied = settings.membershipDiscountPercentage;
        totalAmount = totalAmount * (1 - memberDiscountApplied / 100);
      }
    }

    const discountFromPoints = pointsToRedeem * 2;
    totalAmount = Math.max(0, totalAmount - discountFromPoints);
    totalAmount += deliveryCharge;

    const pointsEarned = user.membershipNumber ? Math.floor(totalAmount * getTierMultiplier(user.tier)) : 0;

    const transactionUuid = crypto.randomUUID();

    // Create transaction
    const transaction = await Transaction.create({
      bookId: book._id,
      bookTitle: book.title,
      userId: req.user._id,
      customerName: req.user.name,
      orderDate: new Date().toISOString().split('T')[0],
      status: isEsewa ? 'Pending Payment' : 'Purchased',
      activity: 'Purchase',
      quantity,
      totalAmount,
      paymentMethod,
      paymentStatus: isEsewa ? 'Pending' : 'Completed',
      paymentId,
      transactionUuid,
      discountApplied: book.discount || 0,
      pointsRedeemed: pointsToRedeem,
      pointsEarned,
      membershipIdUsed: user.membershipNumber && providedMembershipId === user.membershipNumber ? providedMembershipId : null,
      deliveryPhone,
      deliveryZone,
      deliveryAddressDetail,
      deliveryCharge,
      estimatedDeliveryHours,
      deliveryStatus: deliveryZone && deliveryZone !== 'Store Pickup' ? 'Pending' : 'Not Applicable',
    });

    if (!isEsewa) {
      user.pointsBalance = user.pointsBalance - pointsToRedeem + pointsEarned;
      await user.save();
    }

    if (isEsewa) {
      // eSewa requires HMAC SHA256 signature
      const signatureString = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=EPAYTEST`;
      const secretKey = '8gBm/:&EnhH.1/q';
      const hash = crypto.createHmac('sha256', secretKey).update(signatureString).digest('base64');

      return res.status(201).json({
        transaction,
        esewaData: {
          amount: totalAmount - deliveryCharge,
          tax_amount: 0,
          total_amount: totalAmount,
          transaction_uuid: transactionUuid,
          product_code: 'EPAYTEST',
          product_service_charge: 0,
          product_delivery_charge: deliveryCharge,
          success_url: 'http://localhost:5173/payment-success',
          failure_url: 'http://localhost:5173/payment-failure',
          signed_field_names: 'total_amount,transaction_uuid,product_code',
          signature: hash
        }
      });
    }

    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Purchase multiple books (Cart)
// @route   POST /api/transactions/purchase-cart
// @access  Private
export const purchaseCart = async (req, res) => {
  try {
    const { items, paymentMethod = 'Cash', paymentId = '', pointsToRedeem = 0, providedMembershipId = null, deliveryData = null } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const settings = await StoreSettings.findOne();
    const discountActive = settings && settings.membershipDiscountPercentage > 0;
    const isVerificationRequired = user.membershipNumber && discountActive;

    if (isVerificationRequired) {
      if (!providedMembershipId) {
        return res.status(400).json({ message: 'Membership ID is required for Premium Members to checkout.' });
      }
      if (providedMembershipId !== user.membershipNumber) {
        return res.status(400).json({ message: 'Invalid Membership ID provided.' });
      }
    }

    if (pointsToRedeem > 0) {
      if (!user.membershipNumber) {
        return res.status(403).json({ message: 'Only active members can redeem points.' });
      }
      if (user.pointsBalance < pointsToRedeem) {
        return res.status(400).json({ message: 'Insufficient points balance' });
      }
    }

    const transactionUuid = crypto.randomUUID();
    const isEsewa = paymentMethod === 'eSewa';
    let cartTotalAmount = 0;
    let totalQuantity = 0;
    
    // First, verify stock and calculate total before points
    const verifiedItems = [];
    for (const item of items) {
      const book = await Book.findById(item.bookId);
      if (!book) throw new Error(`Book not found: ${item.bookId}`);
      if (book.available < item.quantity) {
        throw new Error(`Not enough stock for ${book.title}. Available: ${book.available}`);
      }
      
      const pricePerItem = book.price * (1 - (book.discount || 0) / 100);
      const itemTotal = parseFloat((pricePerItem * item.quantity).toFixed(2));
      cartTotalAmount += itemTotal;
      totalQuantity += item.quantity;
      verifiedItems.push({ book, quantity: item.quantity, itemTotal });
    }

    // Apply global membership discount if applicable
    let memberDiscountApplied = 0;
    if (user.membershipNumber) {
      const settings = await StoreSettings.findOne();
      if (settings && settings.membershipDiscountPercentage > 0) {
        memberDiscountApplied = settings.membershipDiscountPercentage;
        cartTotalAmount = cartTotalAmount * (1 - memberDiscountApplied / 100);
      }
    }

    const discountFromPoints = pointsToRedeem * 2;
    const finalCartTotalAmount = Math.max(0, cartTotalAmount - discountFromPoints);
    const totalPointsEarned = user.membershipNumber ? Math.floor(finalCartTotalAmount * getTierMultiplier(user.tier)) : 0;

    let deliveryCharge = 0;
    let estimatedDeliveryHours = 0;
    let deliveryPhone = '';
    let deliveryZone = 'Store Pickup';
    let deliveryAddressDetail = '';

    if (deliveryData && deliveryData.deliveryZone !== 'Store Pickup') {
      deliveryPhone = deliveryData.deliveryPhone || '';
      deliveryZone = deliveryData.deliveryZone;
      deliveryAddressDetail = deliveryData.deliveryAddressDetail || '';

      if (!/^\d{10}$/.test(deliveryPhone)) {
        return res.status(400).json({ message: 'Phone number must be exactly 10 digits.' });
      }

      if (totalQuantity >= 3 && deliveryZone !== 'Outside Gauradaha') {
        deliveryCharge = 0;
      } else {
        if (deliveryZone === 'Gauradaha Bajar') deliveryCharge = 50;
        else if (deliveryZone === 'Gauradaha Outside Bajar') deliveryCharge = 150;
        else if (deliveryZone === 'Outside Gauradaha') deliveryCharge = 100 * totalQuantity;
      }

      if (deliveryZone === 'Outside Gauradaha') estimatedDeliveryHours = 24;
      else estimatedDeliveryHours = 12;
    }

    cartTotalAmount = finalCartTotalAmount + deliveryCharge;


    const createdTransactions = [];

    for (let i = 0; i < verifiedItems.length; i++) {
      const { book, quantity, itemTotal } = verifiedItems[i];

      if (!isEsewa) {
        book.available -= quantity;
        await book.save();
      }

      // We assign points entirely to the first transaction for simplicity, 
      // but distribute totalAmount proportionally if needed (we'll just use itemTotal here)
      const transaction = await Transaction.create({
        bookId: book._id,
        bookTitle: book.title,
        userId: req.user._id,
        customerName: req.user.name,
        orderDate: new Date().toISOString().split('T')[0],
        status: isEsewa ? 'Pending Payment' : 'Purchased',
        activity: 'Purchase',
        quantity,
        totalAmount: itemTotal, 
        paymentMethod,
        paymentStatus: isEsewa ? 'Pending' : 'Completed',
        paymentId,
        transactionUuid,
        discountApplied: book.discount || 0,
        pointsRedeemed: i === 0 ? pointsToRedeem : 0,
        pointsEarned: i === 0 ? totalPointsEarned : 0,
        membershipIdUsed: user.membershipNumber && providedMembershipId === user.membershipNumber ? providedMembershipId : null,
        deliveryPhone,
        deliveryZone,
        deliveryAddressDetail,
        deliveryCharge: i === 0 ? deliveryCharge : 0,
        estimatedDeliveryHours,
        deliveryStatus: deliveryZone && deliveryZone !== 'Store Pickup' ? 'Pending' : 'Not Applicable',
      });

      createdTransactions.push(transaction);
    }

    if (!isEsewa) {
      user.pointsBalance = user.pointsBalance - pointsToRedeem + totalPointsEarned;
      await user.save();
    }

    cartTotalAmount = parseFloat(cartTotalAmount.toFixed(2));

    if (isEsewa) {
      const signatureString = `total_amount=${cartTotalAmount},transaction_uuid=${transactionUuid},product_code=EPAYTEST`;
      const secretKey = '8gBm/:&EnhH.1/q';
      const hash = crypto.createHmac('sha256', secretKey).update(signatureString).digest('base64');

      return res.status(201).json({
        transactions: createdTransactions,
        esewaData: {
          amount: cartTotalAmount - deliveryCharge,
          tax_amount: 0,
          total_amount: cartTotalAmount,
          transaction_uuid: transactionUuid,
          product_code: 'EPAYTEST',
          product_service_charge: 0,
          product_delivery_charge: deliveryCharge,
          success_url: 'http://localhost:5173/payment-success',
          failure_url: 'http://localhost:5173/payment-failure',
          signed_field_names: 'total_amount,transaction_uuid,product_code',
          signature: hash
        }
      });
    }

    res.status(201).json({ transactions: createdTransactions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Request a refund (Client)
// @route   POST /api/transactions/refund/:id
// @access  Private
export const refundBook = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.status === 'Refunded' || transaction.status === 'Pending Refund') {
      return res.status(400).json({ message: 'Refund already requested or processed' });
    }

    if (transaction.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to refund this transaction' });
    }

    // Set status to pending refund (don't increase book count yet)
    transaction.status = 'Pending Refund';
    transaction.activity = 'Refund';
    await transaction.save();

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Approve a refund (Admin)
// @route   POST /api/transactions/approve-refund/:id
// @access  Private/Admin
export const approveRefund = async (req, res) => {
  try {
    const { comment } = req.body;
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.status !== 'Pending Refund') {
      return res.status(400).json({ message: 'Transaction is not pending a refund' });
    }

    // Atomically increase book available count to prevent race conditions
    await Book.updateOne(
      { _id: transaction.bookId },
      { $inc: { available: transaction.quantity || 1 } }
    );

    transaction.status = 'Refunded';
    if (comment) transaction.adminComment = comment;
    await transaction.save();

    // Send email notification
    const user = await User.findById(transaction.userId);
    if (user && user.email) {
      await sendRefundEmail(user.email, user.name, transaction.bookTitle, 'Refunded', comment);
    }

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reject a refund (Admin)
// @route   POST /api/transactions/reject-refund/:id
// @access  Private/Admin
export const rejectRefund = async (req, res) => {
  try {
    const { comment } = req.body;
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (transaction.status !== 'Pending Refund') {
      return res.status(400).json({ message: 'Transaction is not pending a refund' });
    }

    transaction.status = 'Refund Rejected';
    if (comment) transaction.adminComment = comment;
    await transaction.save();

    // Send email notification
    const user = await User.findById(transaction.userId);
    if (user && user.email) {
      await sendRefundEmail(user.email, user.name, transaction.bookTitle, 'Refund Rejected', comment);
    }

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Verify eSewa Payment
// @route   POST /api/transactions/verify-esewa
// @access  Public
export const verifyEsewaPayment = async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ message: 'Missing data' });
    
    const decodedString = Buffer.from(data, 'base64').toString('utf-8');
    const parsedData = JSON.parse(decodedString);
    
    const { transaction_uuid, status, signed_field_names, signature } = parsedData;

    if (status !== 'COMPLETE') {
      // Revert stock since payment failed
      const txs = await Transaction.find({ transactionUuid: transaction_uuid });
      for (const tx of txs) {
        if (tx.paymentStatus === 'Pending') {
          tx.paymentStatus = 'Failed';
          tx.status = 'Payment Failed';
          await tx.save();
        }
      }
      return res.status(400).json({ message: 'Payment not complete' });
    }

    // Dynamic signature string construction based on signed_field_names
    const signedFields = signed_field_names.split(',');
    const signString = signedFields.map(field => `${field}=${parsedData[field] || ''}`).join(',');
    
    const secretKey = '8gBm/:&EnhH.1/q';
    const hash = crypto.createHmac('sha256', secretKey).update(signString).digest('base64');
    
    if (hash !== signature) {
      return res.status(400).json({ message: 'Invalid signature. Fraud attempt detected.' });
    }

    // Valid payment
    const txs = await Transaction.find({ transactionUuid: transaction_uuid });
    if (!txs || txs.length === 0) return res.status(404).json({ message: 'Transaction not found' });

    if (txs[0].paymentStatus === 'Completed') {
      return res.status(200).json({ message: 'Payment already verified' });
    }

    let pointsToDeduct = 0;
    let pointsToAdd = 0;

    for (const tx of txs) {
      tx.paymentStatus = 'Completed';
      tx.status = 'Purchased';
      await tx.save();

      // Deduct stock after successful payment
      await Book.updateOne(
        { _id: tx.bookId },
        { $inc: { available: -tx.quantity } }
      );

      pointsToDeduct += tx.pointsRedeemed;
      pointsToAdd += tx.pointsEarned;
    }

    if (pointsToDeduct > 0 || pointsToAdd > 0) {
       const user = await User.findById(txs[0].userId);
       if (user) {
         user.pointsBalance = user.pointsBalance - pointsToDeduct + pointsToAdd;
         await user.save();
       }
    }

    res.status(200).json({ message: 'Payment verified successfully', transactions: txs });
  } catch (error) {
    console.error('Verify Esewa Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark a transaction as delivered
// @route   POST /api/transactions/mark-delivered/:id
// @access  Private/Admin
export const markDelivered = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    transaction.deliveryStatus = 'Delivered';
    await transaction.save();

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
