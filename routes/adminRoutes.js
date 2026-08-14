import express from 'express';
import { getTemporaryAdmins, createTemporaryAdmin, deleteTemporaryAdmin } from '../controllers/adminController.js';
import { protect, permanentAdminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(protect, permanentAdminOnly, getTemporaryAdmins)
  .post(protect, permanentAdminOnly, createTemporaryAdmin);

router.route('/:id')
  .delete(protect, permanentAdminOnly, deleteTemporaryAdmin);

export default router;
