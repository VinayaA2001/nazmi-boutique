import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    // Get user and verification token from database
    const user = await prisma.user.findUnique({
      where: { email },
      select: { emailVerificationToken: true, firstName: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Send verification email
    await resend.emails.send({
      from: 'Nazmi Boutique <nazmiboutique1@gmail.com>',
      to: email,
      subject: 'Verify Your Email - Nazmi Boutique',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d97706;">Welcome to Nazmi Boutique!</h2>
          <p>Dear ${user.firstName},</p>
          <p>Thank you for registering with Nazmi Boutique. Please verify your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXTAUTH_URL}/verify-email?token=${user.emailVerificationToken}" 
               style="background-color: #d97706; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p>Or copy and paste this link in your browser:</p>
          <p>${process.env.NEXTAUTH_URL}/verify-email?token=${user.emailVerificationToken}</p>
          <p>If you didn't create an account, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">
          <p style="color: #666; font-size: 14px;">
            Nazmi Boutique<br/>
            Kozhikode, Kerala, India<br/>
            +91 99959 47709<br/>
            nazmiboutique1@gmail.com
          </p>
        </div>
      `,
    });

    return NextResponse.json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { error: 'Failed to send verification email' },
      { status: 500 }
    );
  }
}