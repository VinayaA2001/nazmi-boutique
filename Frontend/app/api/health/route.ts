import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://nazmi-boutique-2.onrender.com";

export async function GET() {
  try {
    const response = await fetch(`${API_BASE}/`, {
      method: 'GET',
      headers: { "Content-Type": "application/json" },
    });
    
    if (response.ok) {
      return NextResponse.json({ status: 'online' });
    } else {
      return NextResponse.json({ status: 'offline' }, { status: 503 });
    }
  } catch (error) {
    return NextResponse.json({ status: 'offline' }, { status: 503 });
  }
}