// C:\NAZMI_BOUTIQUE\Frontend\components\account\OrdersList.tsx
"use client";

import type { Order, OrderStatus } from "@/lib/type";
import Image from "next/image";
import Link from "next/link";
import { formatINR } from "@/lib/currency";

/* =========================
   Status helpers
   ========================= */

const STATUS_STEPS: OrderStatus[] = [
  "PLACED",
  "CONFIRMED",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

const statusIndex = (s: OrderStatus) =>
  Math.max(0, STATUS_STEPS.indexOf(s));

/* =========================
   Date helpers (SAFE)
   ========================= */

function toSafeDate(value: any): Date | null {
  if (!value) return null;

  // Mongo extended JSON: { $date: "2025-11-14T..." }
  if (typeof value === "object" && value !== null && "$date" in value) {
    const d = new Date((value as any).$date);
    return isNaN(d.getTime()) ? null : d;
  }

  // Firestore-like: { seconds: 123456789 }
  if (typeof value === "object" && value !== null && "seconds" in value) {
    const d = new Date((value as any).seconds * 1000);
    return isNaN(d.getTime()) ? null : d;
  }

  // Already a Date
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // Timestamp number or ISO string
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(date: any): string {
  const d = toSafeDate(date);
  if (!d) return "-";

  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysLeft(d?: any): number | null {
  if (!d) return null;
  const target = toSafeDate(d);
  if (!target) return null;

  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / 86400000);
}

/* =========================
   Component
   ========================= */

export default function OrdersList({
  orders,
  loading,
}: {
  orders: Order[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="text-center text-gray-600 py-10">
        Loading your orders…
      </div>
    );
  }

  if (!orders?.length) {
    return (
      <div className="text-center py-10">
        <p className="text-gray-600 mb-3">No orders yet</p>
        <Link
          href="/sale"
          className="inline-flex items-center px-4 py-2 rounded-full text-sm bg-black text-white hover:bg-gray-900 transition"
        >
          Start shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {orders.map((o) => {
        const id = (o as any)._id ?? (o as any).id;
        const orderNumber =
          (o as any).orderNumber ?? (o as any).order_number ?? id;
        const createdAt =
          (o as any).createdAt ?? (o as any).created_at ?? null;

        const status = (o.status || "PLACED") as OrderStatus;
        const delivered = status === "DELIVERED";
        const cancelled = status === "CANCELLED";

        const rawPaymentStatus =
          (o as any).paymentStatus ??
          (o as any).payment_status ??
          (o as any)?.payment?.status ??
          "PENDING";

        const paymentStatus = String(rawPaymentStatus).toUpperCase();
        const paymentChip =
          paymentStatus === "PAID"
            ? "bg-green-100 text-green-700"
            : paymentStatus === "PENDING"
            ? "bg-yellow-100 text-yellow-700"
            : "bg-red-100 text-red-700";

        const items = ((o as any).items ?? []) as any[];
        const firstItem = items[0];
        const itemCount = items.length;

        const totalAmount =
          (o as any).grandTotal ??
          (o as any).grand_total ??
          (o as any).total ??
          0;

        const expectedDelivery =
          (o as any).expectedDelivery ?? (o as any).expected_delivery;
        const etaDays = daysLeft(expectedDelivery);

        const stepIndex = statusIndex(status);

        // 🔹 IMAGE FALLBACKS – try multiple field names from order item AND nested product
        let thumbSrc: string | undefined;
        if (firstItem) {
          const p = (firstItem as any).product ?? {};
          thumbSrc =
            firstItem.image ||
            firstItem.imageUrl ||
            firstItem.image_url ||
            firstItem.productImage ||
            firstItem.product_image ||
            (Array.isArray(firstItem.images) && firstItem.images[0]) ||
            (Array.isArray(firstItem.imageUrls) && firstItem.imageUrls[0]) ||
            (Array.isArray(firstItem.productImages) &&
              firstItem.productImages[0]) ||
            p.image ||
            (Array.isArray(p.images) && p.images[0]);
        }

        const hasThumb =
          typeof thumbSrc === "string" && thumbSrc.trim().length > 0;

        return (
          <div
            key={String(id)}
            className="border rounded-xl bg-white overflow-hidden"
          >
            {/* Top bar */}
            <div className="px-4 py-3 bg-gray-50 flex flex-wrap justify-between items-center gap-3 text-sm">
              <div className="space-y-1">
                <span className="block font-medium">
                  Order ID: {orderNumber}
                </span>
                <span className="block text-xs text-gray-500">
                  Placed on: {formatDate(createdAt)}
                </span>
              </div>

              <span className="flex gap-2">
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    cancelled
                      ? "bg-red-100 text-red-700"
                      : delivered
                      ? "bg-green-100 text-green-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {status}
                </span>

                <span
                  className={`px-2 py-1 text-xs rounded-full ${paymentChip}`}
                >
                  {paymentStatus}
                </span>
              </span>
            </div>

            {/* Body */}
            <div className="px-4 py-3 flex flex-col md:flex-row gap-4">
              {/* Thumbnail + basic info */}
              <div className="flex items-center gap-3 md:w-1/2">
                <div className="w-16 h-16 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
                  {hasThumb ? (
                    <Image
                      src={thumbSrc as string}
                      alt={firstItem?.name ?? "Product"}
                      width={64}
                      height={64}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <span className="text-xs text-gray-400">No image</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {firstItem?.name ?? "Order items"}
                    {itemCount > 1 && (
                      <span className="text-xs text-gray-500 ml-1">
                        + {itemCount - 1} more item
                        {itemCount - 1 > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {firstItem && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {firstItem.size || firstItem.selectedSize ? (
                        <span className="mr-2">
                          Size: {firstItem.size ?? firstItem.selectedSize}
                        </span>
                      ) : null}
                      {firstItem.color || firstItem.selectedColor ? (
                        <span>
                          Color: {firstItem.color ?? firstItem.selectedColor}
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              {/* Amount + ETA + actions */}
              <div className="md:w-1/2 flex flex-col gap-2 md:items-end">
                <div className="text-right">
                  <div className="text-xs text-gray-500">
                    Order Total
                  </div>
                  <div className="text-lg font-semibold">
                    {formatINR(totalAmount)}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full md:max-w-xs">
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    {STATUS_STEPS.map((step, idx) => (
                      <span key={step} className="truncate">
                        {idx === 0 || idx === STATUS_STEPS.length - 1
                          ? step.replace(/_/g, " ")
                          : ""}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    {STATUS_STEPS.map((step, idx) => {
                      const active = idx <= stepIndex;
                      return (
                        <div
                          key={step}
                          className={`h-1 flex-1 rounded-full ${
                            active
                              ? "bg-green-500"
                              : "bg-gray-200"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* ETA text */}
                <div className="text-xs text-gray-500 text-right">
                  {delivered
                    ? "Delivered"
                    : cancelled
                    ? "Order cancelled"
                    : etaDays !== null && etaDays >= 0
                    ? `Estimated delivery in ${etaDays} day${
                        etaDays === 1 ? "" : "s"
                      }`
                    : "We’ll notify you when your order is shipped."}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 justify-end pt-1">
                  <Link
                    href={`/account/orders/${id}`}
                    className="px-3 py-1.5 text-xs border rounded-full hover:bg-gray-50 transition"
                  >
                    View details
                  </Link>
                  <Link
                    href="/"
                    className="px-3 py-1.5 text-xs rounded-full bg-black text-white hover:bg-gray-900 transition"
                  >
                    Shop more
                  </Link>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
