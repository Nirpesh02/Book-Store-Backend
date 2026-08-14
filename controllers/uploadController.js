import cloudinary from '../config/cloudinary.js';

// @desc    Generate Cloudinary Signature
// @route   POST /api/upload/signature
// @access  Private
export const generateSignature = (req, res) => {
  try {
    const { folder } = req.body;
    
    // Timestamp must be in seconds
    const timestamp = Math.round(new Date().getTime() / 1000);
    
    // Parameters to sign must exactly match what the frontend sends (excluding file, api_key, cloud_name)
    const paramsToSign = {
      timestamp
    };

    if (folder) paramsToSign.folder = folder;

    // Use Cloudinary utils to sign the request using our hidden API Secret
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({
      timestamp,
      signature,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME
    });
  } catch (error) {
    console.error("Signature generation error:", error);
    res.status(500).json({ message: 'Failed to generate signature' });
  }
};
