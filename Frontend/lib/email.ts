// lib/email.ts
import nodemailer from 'nodemailer';

export interface EmailTemplateData {
  name: string;
  email: string;
  phone?: string;
  message?: string;
  orderNumber?: string;
  totalAmount?: number;
  deliveryAddress?: string;
  productDetails?: Array<{
    name: string;
    quantity: number;
    price: number;
    size?: string;
    color?: string;
  }>;
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured: boolean = false;
  private isTestAccount: boolean = false;

  constructor() {
    this.initializeTransporter();
  }

  private async initializeTransporter() {
    try {
      console.log('Initializing email transporter...');
      
      // For development, use ethereal.email test service
      if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
        console.log('No email credentials found, using test account...');
        await this.createTestAccount();
        return;
      }

      const emailConfig = {
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      };

      this.transporter = nodemailer.createTransport(emailConfig);
      this.isConfigured = true;
      this.isTestAccount = false;

      console.log('Email transporter initialized successfully');

    } catch (error) {
      console.error('Failed to initialize email transporter:', error);
      this.isConfigured = false;
    }
  }

  private async createTestAccount() {
    try {
      console.log('Creating test email account...');
      const testAccount = await nodemailer.createTestAccount();
      
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      this.isConfigured = true;
      this.isTestAccount = true;
      console.log('Test email account created:', testAccount.user);
      
    } catch (error) {
      console.error('Failed to create test email account:', error);
      this.isConfigured = false;
    }
  }

  async sendEmail(options: EmailOptions) {
    if (!this.isConfigured || !this.transporter) {
      return {
        success: false,
        error: 'Email service is not configured',
      };
    }

    try {
      const mailOptions = {
        from: {
          name: process.env.EMAIL_FROM_NAME || 'Nazmi Fashion Store',
          address: process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER || 'noreply@nazmi.com',
        },
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        cc: options.cc,
        bcc: options.bcc,
        replyTo: options.replyTo,
      };

      const result = await this.transporter.sendMail(mailOptions);

      // For test accounts, provide preview URL
      let previewUrl;
      if (this.isTestAccount) {
        previewUrl = nodemailer.getTestMessageUrl(result);
        console.log('Email preview URL:', previewUrl);
      }

      return {
        success: true,
        messageId: result.messageId,
        previewUrl,
      };
    } catch (error) {
      console.error('Error sending email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async sendContactForm(data: EmailTemplateData) {
    const subject = 'New Contact Form Submission - Nazmi Fashion Store';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #fff; }
          .field { margin-bottom: 15px; }
          .field strong { display: inline-block; width: 120px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Contact Form Submission</h1>
          </div>
          <div class="content">
            <div class="field"><strong>Name:</strong> ${data.name}</div>
            <div class="field"><strong>Email:</strong> ${data.email}</div>
            <div class="field"><strong>Phone:</strong> ${data.phone || 'Not provided'}</div>
            <div class="field"><strong>Message:</strong> ${data.message || 'No message provided'}</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `New contact form submission:
Name: ${data.name}
Email: ${data.email}
Phone: ${data.phone || 'Not provided'}
Message: ${data.message || 'No message provided'}`;

    return this.sendEmail({
      to: process.env.CONTACT_EMAIL || process.env.EMAIL_USER || 'contact@nazmi.com',
      subject,
      html,
      text,
      replyTo: data.email,
    });
  }

  async sendOrderConfirmation(email: string, data: EmailTemplateData) {
    const subject = `Order Confirmation - #${data.orderNumber}`;
    
    const productDetailsHtml = data.productDetails ? `
      <h3>Order Items:</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background: #f8f9fa;">
            <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Product</th>
            <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Quantity</th>
            <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Price</th>
            <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Size</th>
            <th style="padding: 12px; text-align: left; border: 1px solid #ddd;">Color</th>
          </tr>
        </thead>
        <tbody>
          ${data.productDetails.map(item => `
            <tr>
              <td style="padding: 12px; border: 1px solid #ddd;">${item.name}</td>
              <td style="padding: 12px; border: 1px solid #ddd;">${item.quantity}</td>
              <td style="padding: 12px; border: 1px solid #ddd;">₹${item.price}</td>
              <td style="padding: 12px; border: 1px solid #ddd;">${item.size || 'N/A'}</td>
              <td style="padding: 12px; border: 1px solid #ddd;">${item.color || 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #d4edda; padding: 20px; text-align: center; color: #155724; }
          .content { padding: 20px; background: #fff; }
          .order-info { background: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .total { font-size: 1.2em; font-weight: bold; color: #155724; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 12px; text-align: left; border: 1px solid #ddd; }
          th { background: #f8f9fa; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Order Confirmed!</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${data.name}</strong>,</p>
            <p>Thank you for your order! We're excited to let you know that we've received your order and it's being processed.</p>
            
            <div class="order-info">
              <h3>Order Details</h3>
              <p><strong>Order Number:</strong> ${data.orderNumber}</p>
              <p><strong>Total Amount:</strong> <span class="total">₹${data.totalAmount}</span></p>
              ${data.deliveryAddress ? `<p><strong>Delivery Address:</strong><br>${data.deliveryAddress.replace(/\n/g, '<br>')}</p>` : ''}
            </div>

            ${productDetailsHtml}

            <p>We'll notify you once your order ships. You can track your order status from your account page.</p>
            
            <p>Thank you for shopping with Nazmi Fashion Store!</p>
            
            <p>Best regards,<br>The Nazmi Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `Order Confirmation
Hello ${data.name},

Thank you for your order! We're excited to let you know that we've received your order and it's being processed.

Order Details:
- Order Number: ${data.orderNumber}
- Total Amount: ₹${data.totalAmount}
${data.deliveryAddress ? `- Delivery Address: ${data.deliveryAddress}` : ''}

${data.productDetails ? `Order Items:
${data.productDetails.map(item => `- ${item.name} (Qty: ${item.quantity}, Price: ₹${item.price})`).join('\n')}` : ''}

We'll notify you once your order ships.

Thank you for shopping with Nazmi Fashion Store!

Best regards,
The Nazmi Team`;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text,
    });
  }

  async sendShippingConfirmation(email: string, data: EmailTemplateData) {
    const subject = `Your Order Has Shipped - #${data.orderNumber}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #cce7ff; padding: 20px; text-align: center; color: #004085; }
          .content { padding: 20px; background: #fff; }
          .tracking-info { background: #f8f9fa; padding: 15px; margin: 15px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚚 Your Order is on the Way!</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${data.name}</strong>,</p>
            <p>Great news! Your order has been shipped and is on its way to you.</p>
            
            <div class="tracking-info">
              <h3>Shipping Details</h3>
              <p><strong>Order Number:</strong> ${data.orderNumber}</p>
              <p><strong>Tracking Number:</strong> Will be provided soon</p>
              <p><strong>Delivery Address:</strong><br>${data.deliveryAddress?.replace(/\n/g, '<br>')}</p>
            </div>

            <p>You can track your order status from your account page.</p>
            <p>Expected delivery: 3-5 business days</p>
            
            <p>Thank you for shopping with Nazmi Fashion Store!</p>
            
            <p>Best regards,<br>The Nazmi Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text: `Your order #${data.orderNumber} has been shipped and is on its way to you. Delivery address: ${data.deliveryAddress}. Expected delivery: 3-5 business days.`,
    });
  }

  async sendWelcomeEmail(email: string, data: EmailTemplateData) {
    const subject = 'Welcome to Nazmi Fashion Store!';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #e8f5e8; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #fff; }
          .welcome-bonus { background: #fff3cd; padding: 15px; margin: 15px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>👋 Welcome to Nazmi Fashion Store!</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${data.name}</strong>,</p>
            <p>Welcome to Nazmi Fashion Store! We're thrilled to have you as part of our fashion community.</p>
            
            <div class="welcome-bonus">
              <h3>🎁 Special Welcome Offer!</h3>
              <p>Get 10% off your first order with code: <strong>WELCOME10</strong></p>
            </div>

            <p>At Nazmi, we offer:</p>
            <ul>
              <li>Latest fashion trends</li>
              <li>Premium quality materials</li>
              <li>Fast and reliable delivery</li>
              <li>Excellent customer support</li>
            </ul>

            <p>Start exploring our collection and discover your perfect style!</p>
            
            <p>Happy shopping!<br>The Nazmi Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text: `Welcome to Nazmi Fashion Store, ${data.name}! We're thrilled to have you. Get 10% off your first order with code: WELCOME10. Start exploring our collection today!`,
    });
  }

  async sendPasswordReset(email: string, resetToken: string, data: EmailTemplateData) {
    const subject = 'Password Reset Request - Nazmi Fashion Store';
    const resetLink = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ffeaa7; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #fff; }
          .reset-button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 15px 0; }
          .note { color: #666; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset</h1>
          </div>
          <div class="content">
            <p>Hello <strong>${data.name}</strong>,</p>
            <p>We received a request to reset your password for your Nazmi Fashion Store account.</p>
            
            <p>Click the button below to reset your password:</p>
            
            <a href="${resetLink}" class="reset-button">Reset Your Password</a>
            
            <p class="note">Or copy and paste this link in your browser:<br>${resetLink}</p>
            
            <p class="note"><strong>Note:</strong> This link will expire in 1 hour for security reasons.</p>
            
            <p>If you didn't request a password reset, please ignore this email.</p>
            
            <p>Best regards,<br>The Nazmi Team</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text: `Password Reset Request\n\nHello ${data.name},\n\nClick this link to reset your password: ${resetLink}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, please ignore this email.`,
    });
  }

  async sendCustomEmail(to: string, subject: string, templateData: any, templateType: string = 'generic') {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #fff; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${subject}</h1>
          </div>
          <div class="content">
            ${templateData.message || 'No content provided'}
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to,
      subject,
      html,
      text: templateData.message || 'No content provided',
    });
  }

  isEmailServiceReady(): boolean {
    return this.isConfigured;
  }

  getServiceStatus() {
    return {
      configured: this.isConfigured,
      ready: this.isConfigured && !!this.transporter,
      testAccount: this.isTestAccount,
    };
  }

  async testEmailService() {
    const testData: EmailTemplateData = {
      name: 'Test User',
      email: 'test@example.com',
      orderNumber: 'TEST-123',
      totalAmount: 1999,
      productDetails: [
        {
          name: 'Test Product',
          quantity: 2,
          price: 999,
          size: 'M',
          color: 'Blue'
        }
      ]
    };

    const result = await this.sendOrderConfirmation('test@example.com', testData);
    
    if (result.success) {
      return {
        success: true,
        message: result.previewUrl 
          ? `Email service working! Preview: ${result.previewUrl}`
          : 'Email service working!'
      };
    } else {
      return {
        success: false,
        error: result.error
      };
    }
  }
}

// Create and export singleton instance
export const emailService = new EmailService();
export default emailService;