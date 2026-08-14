import express from 'express';
import { getCustomers, addCustomer, toggleCustomerStatus, deleteCustomer } from '../controllers/customerController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, adminOnly, getCustomers);
router.post('/', protect, adminOnly, addCustomer);
router.patch('/:id/toggle-status', protect, adminOnly, toggleCustomerStatus);
router.delete('/:id', protect, adminOnly, deleteCustomer);

export default router;
