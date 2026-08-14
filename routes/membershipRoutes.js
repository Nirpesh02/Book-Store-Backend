import express from 'express';
import { protect, adminOnly } from '../middleware/authMiddleware.js';
import {
  applyForMembership,
  getPendingRequests,
  approveRequest,
  rejectRequest,
} from '../controllers/membershipController.js';

const router = express.Router();

// Client route
router.post('/apply', protect, applyForMembership);

// Admin routes
router.get('/requests', protect, adminOnly, getPendingRequests);
router.post('/approve/:userId', protect, adminOnly, approveRequest);
router.post('/reject/:userId', protect, adminOnly, rejectRequest);

export default router;
