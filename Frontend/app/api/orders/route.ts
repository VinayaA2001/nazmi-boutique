// C:\NAZMI_BOUTIQUE\Frontend\app\api\orders\route.ts
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.BACKEND_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

function resolveAuthHeader(req: NextRequest): string | undefined {
  const header =
    req.headers.get("authorization") || req.headers.get("Authorization");
  if (header) return header;

  const token =
    cookies().get("auth_token")?.value ||
    cookies().get("token")?.value ||
    cookies().get("Authorization")?.value;

  if (!token) return undefined;
  return token.toLowerCase().startsWith("bearer ")
    ? token
    : `Bearer ${token}`;
}

// Create order (used at checkout)
export async function POST(req: NextRequest) {
  const rawBody = await req.json().catch(() => ({} as any));
  let body: any = { ...rawBody };

  /**
   * If checkout sends `cartItems`, normalise them to `items`
   * with product_id, size, color AND image so that the
   * backend can store the image inside the order document.
   */
  if (Array.isArray(body.cartItems) && !Array.isArray(body.items)) {
    const cartItems = body.cartItems;

    const items = cartItems.map((ci: any) => {
      // Try to resolve product id from multiple possible fields
      const productId =
        ci.productId ?? ci.product_id ?? ci._id ?? ci.id ?? null;

      // Try to resolve name from different shapes
      const name =
        ci.productName ??
        ci.name ??
        ci.product_name ??
        ci.product?.name ??
        ci.product?.product_name ??
        "Product";

      // Price & quantity
      const price = Number(ci.price ?? ci.salePrice ?? ci.mrp ?? 0);
      const quantity = Number(ci.quantity ?? 1);

      // Size & color
      const size = ci.selectedSize ?? ci.size ?? "";
      const color = ci.selectedColor ?? ci.color ?? "";

      // 🔹 IMAGE FALLBACKS
      const image =
        ci.image ||
        (Array.isArray(ci.images) && ci.images[0]) ||
        ci.product?.image ||
        (Array.isArray(ci.product?.images) && ci.product.images[0]) ||
        (Array.isArray(ci.productImages) && ci.productImages[0]) ||
        "";

      return {
        // Keep original item fields (no data loss)
        ...ci,
        product_id: productId,
        name,
        price,
        quantity,
        size,
        color,
        image,
      };
    });

    body = {
      ...body,
      items,
    };
    delete body.cartItems; // backend only cares about `items`
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const auth = resolveAuthHeader(req);
  if (auth) headers.Authorization = auth;

  const res = await fetch(`${API_BASE}/api/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
