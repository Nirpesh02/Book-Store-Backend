import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import Book from './models/Book.js';
import Transaction from './models/Transaction.js';
import Review from './models/Review.js';

dotenv.config();

const seedData = async () => {
  try {
    await connectDB();

    // Clear existing data
    await User.deleteMany({});
    await Book.deleteMany({});
    await Transaction.deleteMany({});
    await Review.deleteMany({});

    console.log('Cleared existing data...');

    // Create Users
    const adminUser = await User.create({
      name: 'Nir P esh',
      email: 'admin@nirpesh.com',
      password: 'admin123',
      role: 'admin',
      adminType: 'permanent',
      tier: 'Standard',
      status: 'Active',
    });

    const customer1 = await User.create({
      name: 'neer',
      email: 'nirpesh@dhungel.com',
      password: '123',
      role: 'client',
      tier: 'Premium Member',
      status: 'Active',
    });


    console.log('Users seeded...');

    // Create Books
    const book1 = await Book.create({
      title: 'The Midnight Library',
      author: 'Matt Haig',
      category: 'Fiction',
      isbn: '978-0525559474',
      price: 1499,
      copies: 4,
      available: 3,
      description: 'Between life and death there is a library, and within that library, the shelves go on forever. Every book provides a chance to try another life you could have lived.',
      addedDate: '2026-07-15',
      coverImages: ['https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=80'],
    });

    const book2 = await Book.create({
      title: 'Project Hail Mary',
      author: 'Andy Weir',
      category: 'Sci-Fi',
      isbn: '978-0593135204',
      price: 1850,
      copies: 5,
      available: 5,
      description: 'Ryland Grace is the sole survivor on a desperate, last-chance mission—and if he fails, humanity and the Earth itself are finished.',
      addedDate: '2026-07-20',
      coverImages: ['https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=600&q=80'],
    });

    const book3 = await Book.create({
      title: 'Cloud Cuckoo Land',
      author: 'Anthony Doerr',
      category: 'Historical',
      isbn: '978-1982168438',
      price: 2200,
      copies: 2,
      available: 0,
      description: 'Set across centuries, this epic novel weaves together the stories of three young dreamers linked by a single ancient text.',
      addedDate: '2026-06-10',
      coverImages: ['https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80'],
    });

    const book4 = await Book.create({
      title: 'Atomic Habits',
      author: 'James Clear',
      category: 'Self-Help',
      isbn: '978-0735211292',
      price: 1699,
      copies: 8,
      available: 2,
      description: 'Tiny changes, remarkable results. An easy & proven way to build good habits & break bad ones.',
      addedDate: '2026-08-01',
      coverImages: ['https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=600&q=80'],
    });

    console.log('Books seeded...');

    // Create Transactions
    await Transaction.create({
      bookId: book1._id,
      bookTitle: 'The Midnight Library',
      userId: customer1._id,
      customerName: 'neer',
      orderDate: '2026-08-01',
      status: 'Purchased',
      activity: 'Purchase',
    });


    console.log('Transactions seeded...');

    // Create Reviews
    await Review.create({
      bookId: book1._id,
      userId: customer1._id,
      customerName: 'neer',
      rating: 5,
      comment: 'Absolutely loved this book! A horrible exploration of life choices and second chances.',
      date: '2026-08-02',
    });

    await Review.create({
      bookId: book4._id,
      userId: customer1._id,
      customerName: 'neer',
      rating: 5,
      comment: 'Changed my life! The best self-help book I have ever read.',
      date: '2026-08-01',
    });

    console.log('Reviews seeded...');

    console.log('\n✅ All seed data inserted successfully!');
    console.log('\nLogin Credentials:');
    console.log('  Admin:    admin@nirpesh.com / admin123');
    console.log('  Customer: nirpesh@dhungel.com / 123');

    process.exit(0);
  } catch (error) {
    console.error('Seeding Error:', error);
    process.exit(1);
  }
};

seedData();
