// C:\NAZMI_BOUTIQUE\Frontend\app\account\orders\[id]\page.tsx
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { API_BASE_SERVER } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* ============================================================
   Fetch Order
============================================================ */
async function getOrder(id: string) {
  const base = (API_BASE_SERVER || "").replace(/\/$/, "");

  try {
    const r = await fetch(`${base}/api/orders/${id}`, {
      cache: "no-store",
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/* ============================================================
   Helpers
============================================================ */
function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function getImage(it: any) {
  return (
    it.image ||
    it.imageUrl ||
    it.image_url ||
    it.productImage ||
    it.product_image ||
    (Array.isArray(it.images) && it.images[0]) ||
    (Array.isArray(it.imageUrls) && it.imageUrls[0]) ||
    (Array.isArray(it.productImages) && it.productImages[0]) ||
    it.product?.image ||
    (Array.isArray(it.product?.images) && it.product.images[0]) ||
    "/images/poster1.png"
  );
}

function getName(it: any) {
  return (
    it.name ||
    it.product_name ||
    it.productName ||
    it.product?.name ||
    "Item"
  );
}

function getQty(it: any) {
  return Number(it.qty ?? it.quantity ?? 1);
}

function getPrice(it: any) {
  return Number(it.price ?? 0);
}

function toSafeDate(value: any): Date | null {
  if (!value) return null;

  if (typeof value === "object" && value !== null && "$date" in value) {
    const d = new Date((value as any).$date);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === "object" && value !== null && "seconds" in value) {
    const d = new Date((value as any).seconds * 1000);
    return isNaN(d.getTime()) ? null : d;
  }

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(value: any): string {
  const d = toSafeDate(value);
  if (!d) return "-";

  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ============================================================
   Page
============================================================ */
export default async function OrderDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const order = await getOrder(params.id);
  if (!order) return notFound();

  /* ========== Order Fields ========== */
  const orderId =
    order.orderNumber ||
    order.order_number ||
    order._id ||
    params.id;

  const status = String(order.status || "PLACED").toUpperCase();
  const paymentStatus = String(
    order.paymentStatus ||
      order.payment_status ||
      order?.payment?.status ||
      "PENDING"
  ).toUpperCase();

  const total = order.grandTotal ?? order.grand_total ?? order.total ?? 0;
  const subtotal = order.subtotal ?? total;
  const shippingFee = order.shipping_fee ?? order.shippingFee ?? 0;

  const createdAt = order.createdAt ?? order.created_at;
  const expectedDelivery =
    order.expectedDelivery ?? order.expected_delivery;

  const items: any[] = Array.isArray(order.items) ? order.items : [];

  const shippingAddress =
    order.shipping_address ?? order.shippingAddress ?? null;

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* =========================
            Header
        ========================= */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            Order Details
          </h1>
          <p className="text-sm text-gray-600">
            Order ID: <span className="font-medium">{orderId}</span>
          </p>
        </div>

        {/* =========================
            Summary Boxes
        ========================= */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="p-4 border rounded-lg">
            <p className="text-xs text-gray-500">Status</p>
            <p className="font-semibold">{status}</p>
          </div>
          <div className="p-4 border rounded-lg">
            <p className="text-xs text-gray-500">Payment</p>
            <p className="font-semibold">{paymentStatus}</p>
          </div>
          <div className="p-4 border rounded-lg">
            <p className="text-xs text-gray-500">Order Placed</p>
            <p className="font-semibold text-sm">
              {formatDate(createdAt)}
            </p>
          </div>
          <div className="p-4 border rounded-lg">
            <p className="text-xs text-gray-500">Total</p>
            <p className="font-semibold">{inr(total)}</p>
          </div>
        </div>

        {/* =========================
            Items
        ========================= */}
        <div className="border rounded-lg overflow-hidden mb-6">
          <div className="px-4 py-3 border-b bg-gray-50 font-medium">
            Items
          </div>

          <div className="divide-y">
            {items.map((it, i) => {
              const name = getName(it);
              const qty = getQty(it);
              const price = getPrice(it);
              const size = it.size ?? it.selectedSize;
              const color = it.color ?? it.selectedColor;
              const img = getImage(it);

              return (
                <div
                  key={`${i}-${name}`}
                  className="px-4 py-3 flex gap-3 items-center"
                >
                  {/* Image */}
                  <div className="w-16 h-16 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                    <Image
                      src={img}
                      alt={name}
                      width={64}
                      height={64}
                      className="object-cover w-full h-full"
                    />
                  </div>

                  {/* Name + attributes */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{name}</div>
                    <div className="text-xs text-gray-500">
                      {size ? `Size: ${size}` : ""}
                      {size && color ? " • " : ""}
                      {color ? `Color: ${color}` : ""}
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right text-sm">
                    <div className="font-semibold">
                      {inr(price * qty)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {inr(price)} × {qty}
                    </div>
                  </div>
                </div>
              );
            })}

            {items.length === 0 && (
              <div className="px-4 py-6 text-sm text-gray-500">
                No items found in this order.
              </div>
            )}
          </div>
        </div>

        {/* =========================
            Payment Summary + Shipping
        ========================= */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Payment summary */}
          <div className="border rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-3">
              Payment Summary
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">Subtotal</dt>
                <dd>{inr(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Shipping</dt>
                <dd>{shippingFee ? inr(shippingFee) : "Free"}</dd>
              </div>
              <div className="border-t pt-3 mt-2 flex justify-between font-semibold">
                <dt>Total</dt>
                <dd>{inr(total)}</dd>
              </div>
            </dl>
            {order?.payment?.method && (
              <p className="mt-3 text-xs text-gray-500">
                Paid via {order.payment.method}
              </p>
            )}
            {expectedDelivery && (
              <p className="mt-2 text-xs text-gray-500">
                Expected delivery: {formatDate(expectedDelivery)}
              </p>
            )}
          </div>

          {/* Shipping address */}
          <div className="border rounded-lg p-4">
            <h2 className="text-sm font-semibold mb-3">
              Shipping Address
            </h2>
            {shippingAddress ? (
              <div className="text-sm text-gray-700 space-y-1">
                {shippingAddress.fullName && (
                  <p className="font-medium">
                    {shippingAddress.fullName}
                  </p>
                )}
                {shippingAddress.phone && (
                  <p>📞 {shippingAddress.phone}</p>
                )}
                {(shippingAddress.line1 || shippingAddress.line2) && (
                  <p>
                    {shippingAddress.line1}
                    {shippingAddress.line2
                      ? `, ${shippingAddress.line2}`
                      : ""}
                  </p>
                )}
                {(shippingAddress.city ||
                  shippingAddress.state ||
                  shippingAddress.pincode) && (
                  <p>
                    {shippingAddress.city &&
                      `${shippingAddress.city}, `}
                    {shippingAddress.state &&
                      `${shippingAddress.state} `}
                    {shippingAddress.pincode &&
                      `- ${shippingAddress.pincode}`}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No shipping address found for this order.
              </p>
            )}
          </div>
        </div>

        {/* =========================
            Back Button
        ========================= */}
        <div className="mt-4">
          <Link
            href="/account?tab=orders"
            className="px-4 py-2 rounded-lg border hover:bg-gray-50 text-sm"
          >
            Back to Orders
          </Link>
        </div>
      </div>
    </main>
  );
}
