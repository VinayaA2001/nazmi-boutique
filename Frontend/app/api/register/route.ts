import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';

// Mock database - in production, use a real database
const users: any[] = [];

export async function POST(request: NextRequest) {
  try {
    const { email, phone, password, firstName, lastName } = await request.json();

    // Validate input
    if (!email || !phone || !password || !firstName || !lastName) {
      return NextResponse.json(
        { message: 'All fields are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = users.find(user => 
      user.email === email || user.phone === phone
    );

    if (existingUser) {
      return NextResponse.json(
        { message: 'User with this email or phone already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hash(password, 12);

    // Create user
    const user = {
      id: Date.now().toString(),
      email,
      phone,
      password: hashedPassword,
      firstName,
      lastName,
      emailVerified: false,
      phoneVerified: false,
      emailVerificationToken: Math.random().toString(36).substring(2, 15),
      phoneVerificationToken: Math.floor(100000 + Math.random() * 900000).toString(),
      createdAt: new Date().toISOString(),
    };

    users.push(user);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({
      message: 'Registration successful!',
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}