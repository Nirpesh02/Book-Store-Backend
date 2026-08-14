import express from 'express';
import { generateSignature } from '../controllers/uploadController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/signature', protect, generateSignature);

export default router;
