import nodemailer from 'nodemailer';

// Helper function to create a transporter using Ethereal Email (for testing)
const createTestTransporter = async () => {
  try {
    // Generate test SMTP service account from ethereal.email
    // Only needed if you don't have a real mail account for testing
    let testAccount = await nodemailer.createTestAccount();

    // create reusable transporter object using the default SMTP transport
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: testAccount.user, // generated ethereal user
        pass: testAccount.pass, // generated ethereal password
      },
    });
  } catch (error) {
    console.error('Failed to create test email account:', error);
    return null;
  }
};

export const sendRefundEmail = async (userEmail, userName, bookTitle, status, comment) => {
  try {
    // In production, you would use a real SMTP service configured in .env
    // const transporter = nodemailer.createTransport({
    //   service: 'gmail',
    //   auth: {
    //     user: process.env.EMAIL_USER,
    //     pass: process.env.EMAIL_PASS,
    //   }
    // });
    
    const transporter = await createTestTransporter();
    if (!transporter) return;

    const isApproved = status === 'Refunded';
    const subject = isApproved ? `Refund Approved: ${bookTitle}` : `Refund Rejected: ${bookTitle}`;
    
    let htmlContent = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Hello ${userName},</h2>
        <p>Your refund request for the book <strong>"${bookTitle}"</strong> has been processed.</p>
        <p>Status: <strong style="color: ${isApproved ? 'green' : 'red'};">${isApproved ? 'Approved' : 'Rejected'}</strong></p>
    `;

    if (comment && comment.trim() !== '') {
      htmlContent += `
        <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #ccc; margin: 15px 0;">
          <strong>Admin Comment:</strong><br/>
          <em>${comment}</em>
        </div>
      `;
    }

    htmlContent += `
        <p>If you have any questions, please contact support.</p>
        <p>Best regards,<br/>BookVerse Admin Team</p>
      </div>
    `;

    // send mail with defined transport object
    let info = await transporter.sendMail({
      from: '"BookVerse Admin" <admin@bookverse.com>',
      to: userEmail,
      subject: subject,
      html: htmlContent,
    });

    console.log("Message sent: %s", info.messageId);
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info)); // IMPORTANT for Ethereal!
  } catch (error) {
    console.error('Error sending refund email:', error);
  }
};
