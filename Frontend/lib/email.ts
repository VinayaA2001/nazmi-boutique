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
  sendShippingConfirmation(email: any, data: any): any {
    throw new Error("Method not implemented.");
  }
  sendCustomEmail(to: any, subject: any, templateData: any, arg3: any): any {
    throw new Error("Method not implemented.");
  }
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

      const email= {
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
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${data.name}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p><strong>Phone:</strong> ${data.phone || 'Not provided'}</p>
      <p><strong>Message:</strong> ${data.message}</p>
    `;

    return this.sendEmail({
      to: process.env.CONTACT_EMAIL || process.env.EMAIL_USER || 'contact@nazmi.com',
      subject,
      html,
      text: `New contact form from ${data.name} (${data.email})`,
      replyTo: data.email,
    });
  }

  async sendOrderConfirmation(email: string, data: EmailTemplateData) {
    const subject = `Order Confirmation - #${data.orderNumber}`;
    const html = `
      <h1>Order Confirmed!</h1>
      <p>Thank you for your order, ${data.name}!</p>
      <h2>Order Details</h2>
      <p><strong>Order Number:</strong> ${data.orderNumber}</p>
      <p><strong>Total Amount:</strong> ₹${data.totalAmount}</p>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text: `Your order #${data.orderNumber} has been confirmed. Total: ₹${data.totalAmount}`,
    });
  }

  async sendWelcomeEmail(email: string, data: EmailTemplateData) {
    const subject = 'Welcome to Nazmi Fashion Store!';
    const html = `
      <h1>Welcome to Nazmi Fashion Store!</h1>
      <p>Hello ${data.name},</p>
      <p>Thank you for joining our fashion community!</p>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text: `Welcome ${data.name}! Thank you for joining Nazmi Fashion Store.`,
    });
  }

  async sendPasswordReset(email: string, resetToken: string, data: EmailTemplateData) {
    const subject = 'Password Reset Request - Nazmi Fashion Store';
    const resetLink = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    const html = `
      <h1>Password Reset Request</h1>
      <p>Hello ${data.name},</p>
      <p>Click the link below to reset your password:</p>
      <a href="${resetLink}">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
    `;

    return this.sendEmail({
      to: email,
      subject,
      html,
      text: `Password reset link: ${resetLink}`,
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