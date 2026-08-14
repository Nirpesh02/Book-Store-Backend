import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Book title is required'],
      trim: true,
    },
    englishTitle: {
      type: String,
      required: [true, 'English/Romanized title is required'],
      trim: true,
    },
    author: {
      type: String,
      required: [true, 'Author name is required'],
      trim: true,
    },
    category: {
      type: String,
      default: 'Fiction',
      trim: true,
    },
    isbn: {
      type: String,
      default: '',
      trim: true,
    },
    price: {
      type: Number,
      default: 999,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    copies: {
      type: Number,
      default: 1,
      min: 0,
    },
    available: {
      type: Number,
      default: 1,
      min: 0,
    },
    description: {
      type: String,
      default: '',
    },
    isNewRelease: {
      type: Boolean,
      default: false,
    },
    coverImages: {
      type: [String],
      default: [],
    },
    addedDate: {
      type: String,
      default: () => new Date().toISOString().split('T')[0],
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // For backwards compatibility
    },
  },
  { timestamps: true }
);

const Book = mongoose.model('Book', bookSchema);
export default Book;
