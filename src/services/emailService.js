'use strict';

const nodemailer = require('nodemailer');

// Create reusable transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

/**
 * Send password reset OTP email.
 */
const sendResetOTPEmail = async (email, otp) => {
  try {
    const transporter = createTransporter();
    
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Water Monitoring System" <noreply@watermonitoring.com>',
      to: email,
      subject: '🔐 Password Reset OTP - Water Monitoring',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Password Reset Request</h2>
          <p>You requested to reset your password. Use the OTP below:</p>
          <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h1 style="font-size: 36px; letter-spacing: 8px; color: #2563eb; margin: 0;">${otp}</h1>
          </div>
          <p><strong>This OTP expires in 10 minutes.</strong></p>
          <p>If you didn't request this, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">Water Monitoring System</p>
        </div>
      `,
    });

    console.log(`📧 Password reset email sent to ${email}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    // In development, still return true so flow continues
    if (process.env.NODE_ENV === 'development') {
      console.log(`📧 [DEV] OTP for ${email}: ${otp}`);
      return true;
    }
    return false;
  }
};

/**
 * Send welcome email (for future use).
 */
const sendWelcomeEmail = async (email, name) => {
  try {
    const transporter = createTransporter();
    
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Water Monitoring System" <noreply@watermonitoring.com>',
      to: email,
      subject: '👋 Welcome to Water Monitoring System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Welcome, ${name}!</h2>
          <p>Your account has been created successfully.</p>
          <p>You can now log in to the Water Monitoring dashboard.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 12px;">Water Monitoring System</p>
        </div>
      `,
    });

    console.log(`📧 Welcome email sent to ${email}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error.message);
    return false;
  }
};

module.exports = {
  sendResetOTPEmail,
  sendWelcomeEmail,
};