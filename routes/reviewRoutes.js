import express from 'express';
import { getAllReviews, getBookReviews, addReview, deleteReview } from '../controllers/reviewController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', getAllReviews);
router.get('/book/:bookId', getBookReviews);
router.post('/', protect, addReview);
router.delete('/:id', protect, deleteReview);

export default router;
