export async function createBackendOrder(payload: {
  order_number?: string;     // if you already created internal order
  amount?: number;           // amount in paise (ONLY if no order_number)
  purpose?: string;
}) {
  const base = process.env.NEXT_PUBLIC_API_URL || "https://nazmi-boutique-2.onrender.com";
  const r = await fetch(`${base}/api/payments/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // If you have an internal order_number pass it; otherwise pass amount
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || e.details || `Create order failed (${r.status})`);
  }
  return r.json() as Promise<{ success: boolean; order_id: string; amount: number; currency: string; key: string }>;
}

export async function verifyBackendPayment(payload: {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
  order_number?: string; // pass if you used one
  customer_email?: string;
  amount?: number;       // optional fallback
}) {
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  const r = await fetch(`${base}/api/payments/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.error || e.details || `Verify failed (${r.status})`);
  }
  return r.json();
}
