import 'dotenv/config';
import nodemailer from 'nodemailer';
import fs from 'fs';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // Use STARTTLS
  connectionTimeout: 5000, // 5 seconds
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
});

transporter.verify((err, success) => {
  if (err) {
    fs.writeFileSync('test-smtp.json', JSON.stringify({status: 'error', error: err.message}));
  } else {
    fs.writeFileSync('test-smtp.json', JSON.stringify({status: 'success'}));
  }
  process.exit();
});
