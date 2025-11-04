import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';

// Mock database - same as register route
const users: any[] = [];

export async function POST(request: NextRequest) {
  try {
    const { emailOrPhone, password } = await request.json();

    if (!emailOrPhone || !password) {
      return NextResponse.json(
        { message: 'Email/phone and password are required' },
        { status: 400 }
      );
    }

    // Find user by email or phone
    const user = users.find(u => 
      u.email === emailOrPhone || u.phone === emailOrPhone
    );

    if (!user) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    // Create a simple token (in production, use JWT)
    const token = `token-${Date.now()}-${user.id}`;

    return NextResponse.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}