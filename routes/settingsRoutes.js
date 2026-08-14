import express from 'express';
import { protect, adminOnly, permanentAdminOnly } from '../middleware/authMiddleware.js';
import { getSettings, updateSettings } from '../controllers/settingsController.js';

const router = express.Router();

// Public route so clients can fetch the current discount
router.get('/', getSettings);

// Admin route
router.put('/', protect, permanentAdminOnly, updateSettings);

export default router;
