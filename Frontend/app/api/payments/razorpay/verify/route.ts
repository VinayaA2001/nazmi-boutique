import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    console.log('🔄 Proxying payment verification to:', `${API_BASE}/api/payments/razorpay/verify`);
    
    const response = await fetch(`${API_BASE}/api/payments/razorpay/verify`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Backend payment verification failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      return NextResponse.json(
        { error: `Backend error: ${response.status} - ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ Payment verified successfully:', data);
    
    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error("❌ Proxy error:", error);
    return NextResponse.json(
      { error: "Failed to verify payment: " + error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}