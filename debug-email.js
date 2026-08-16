import 'dotenv/config';
import nodemailer from 'nodemailer';
import fs from 'fs';

async function testEmail() {
  let log = '';
  try {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    log += `User: ${user}\nPass Length: ${pass ? pass.length : 0}\n`;

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // Use STARTTLS
      auth: { user, pass }
    });

    log += 'Verifying...\n';
    await transporter.verify();
    log += 'Verify Success!\n';
    
    fs.writeFileSync('email_debug.log', log);
    console.log('Done');
    process.exit(0);
  } catch (err) {
    log += `Error: ${err.message}\n`;
    fs.writeFileSync('email_debug.log', log);
    process.exit(1);
  }
}
testEmail();
