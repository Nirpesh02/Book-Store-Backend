import Book from '../models/Book.js';

// @desc    Get all books
// @route   GET /api/books
// @access  Public
export const getBooks = async (req, res) => {
  try {
    const books = await Book.find().sort({ createdAt: -1 });
    res.json(books);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single book by ID
// @route   GET /api/books/:id
// @access  Public
export const getBookById = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }
    res.json(book);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a new book
// @route   POST /api/books
// @access  Private/Admin
export const addBook = async (req, res) => {
  try {
    const { title, englishTitle, author, category, isbn, price, discount, copies, description, coverImages, isNewRelease } = req.body;

    if (!title || !englishTitle || !author) {
      return res.status(400).json({ message: 'Nepali title, English title, and author are required' });
    }

    const book = await Book.create({
      title,
      author,
      category: category || 'Fiction',
      isbn: isbn || '',
      price: Number(price) || 999,
      discount: Number(discount) || 0,
      copies: Number(copies) || 1,
      available: Number(copies) || 1,
      description: description || '',
      coverImages: coverImages || [],
      englishTitle: englishTitle || '',
      isNewRelease: isNewRelease || false,
      addedDate: new Date().toISOString().split('T')[0],
      addedBy: req.user._id,
    });

    res.status(201).json(book);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a book
// @route   PUT /api/books/:id
// @access  Private/Admin
export const updateBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    if (req.user.role === 'admin' && req.user.adminType === 'temporary') {
      if (!book.addedBy || book.addedBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Temporary admins can only edit books they added.' });
      }
    }

    const updatedBook = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedBook);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a book
// @route   DELETE /api/books/:id
// @access  Private/Admin
export const deleteBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Book not found' });
    }

    if (req.user.role === 'admin' && req.user.adminType === 'temporary') {
      if (!book.addedBy || book.addedBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Temporary admins can only delete books they added.' });
      }
    }

    await Book.findByIdAndDelete(req.params.id);
    res.json({ message: 'Book deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
