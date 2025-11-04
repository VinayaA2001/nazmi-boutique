import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { message: 'Verification token is required' },
        { status: 400 }
      );
    }

    // In a real app, you would:
    // 1. Find user by verification token
    // 2. Mark phone as verified
    // 3. Update user in database

    console.log(`Phone would be verified with token: ${token}`);
    
    return NextResponse.json({
      message: 'Phone verified successfully',
    });
  } catch (error) {
    console.error('Phone verification error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}