import express from 'express';
import { getTransactions, purchaseBook, purchaseCart, refundBook, approveRefund, rejectRefund, verifyEsewaPayment, markDelivered } from '../controllers/transactionController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getTransactions);
router.post('/purchase', protect, purchaseBook);
router.post('/purchase-cart', protect, purchaseCart);
router.post('/verify-esewa', verifyEsewaPayment); // Public callback URL from eSewa
router.post('/refund/:id', protect, refundBook);
router.post('/approve-refund/:id', protect, adminOnly, approveRefund);
router.post('/reject-refund/:id', protect, adminOnly, rejectRefund);
router.post('/mark-delivered/:id', protect, adminOnly, markDelivered);

export default router;
