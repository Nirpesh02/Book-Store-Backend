import express from 'express';
import { getCustomers, toggleCustomerStatus, deleteCustomer } from '../controllers/customerController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, adminOnly, getCustomers);
router.patch('/:id/toggle-status', protect, adminOnly, toggleCustomerStatus);
router.delete('/:id', protect, adminOnly, deleteCustomer);

export default router;
