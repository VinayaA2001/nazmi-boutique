import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    // Get user and verification token from database
    const user = await prisma.user.findFirst({
      where: { phone },
      select: { phoneVerificationToken: true, firstName: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Send verification SMS using Twilio
    await client.messages.create({
      body: `Welcome to Nazmi Boutique! Your verification code is: ${user.phoneVerificationToken}. Use this code to verify your phone number.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });

    return NextResponse.json({ message: 'Verification SMS sent' });
  } catch (error) {
    console.error('SMS verification error:', error);
    return NextResponse.json(
      { error: 'Failed to send verification SMS' },
      { status: 500 }
    );
  }
}