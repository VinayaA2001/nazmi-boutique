// components/order-confirmed/OrderConfirmedContent.tsx
"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

interface OrderDetails {
  id: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    selectedSize: string;
    selectedColor: string;
    image: string;
  }>;
  total: number;
  customerInfo: {
    firstName: string;
    lastName: string;
    email: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
  };
  orderDate: string;
  status: string;
}

export default function OrderConfirmedContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;

    try {
      const stored = localStorage.getItem("orders");
      const orders = stored ? JSON.parse(stored) : [];
      const foundOrder = orders.find((o: OrderDetails) => o.id === orderId) || null;
      setOrder(foundOrder);
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4" />
          <p>Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12">
        <div className="max-w-md w-full bg-white rounded-lg shadow-sm p-8 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Order Not Found</h1>
          <p className="text-gray-600 mb-6">
            We couldn&apos;t find the order you&apos;re looking for.
          </p>
          <Link
            href="/"
            className="inline-block bg-black text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Success Header */}
        <div className="bg-white rounded-lg shadow-sm p-8 text-center mb-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4">Order Confirmed!</h1>
          <p className="text-gray-600 mb-2">
            Thank you for your purchase, {order.customerInfo.firstName}!
          </p>
          <p className="text-gray-600 mb-6">
            Your order has been confirmed and will be shipped soon.
          </p>

          {/* Order ID */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 inline-block">
            <p className="text-sm text-gray-600">Order ID</p>
            <p className="font-mono font-bold text-gray-900 text-lg">{order.id}</p>
          </div>

          {/* Order Date */}
          <p className="text-sm text-gray-600">
            Order Date:{" "}
            {new Date(order.orderDate).toLocaleDateString("en-IN", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Order Items</h2>
              <div className="space-y-4">
                {order.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-3 border-b border-gray-200 last:border-b-0"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                        <span className="text-xs text-gray-500">Image</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{item.name}</h3>
                        <p className="text-sm text-gray-600">
                          Size: {item.selectedSize} • Color: {item.selectedColor} • Qty:{" "}
                          {item.quantity}
                        </p>
                        <p className="text-sm text-gray-600">Item #{item.id}</p>
                      </div>
                    </div>
                    <p className="font-semibold text-gray-900">
                      ₹{(item.price * item.quantity).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Shipping Address */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Shipping Address</h2>
              <div className="text-gray-600">
                <p className="font-semibold">
                  {order.customerInfo.firstName} {order.customerInfo.lastName}
                </p>
                <p>{order.customerInfo.address}</p>
                <p>
                  {order.customerInfo.city}, {order.customerInfo.state} -{" "}
                  {order.customerInfo.pincode}
                </p>
                <p className="mt-2">Phone: {order.customerInfo.phone}</p>
                <p>Email: {order.customerInfo.email}</p>
              </div>
            </div>
          </div>

          {/* Order Summary + Next Steps */}
          <div className="space-y-6">
            {/* Order Total */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Order Summary</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal ({order.items.length} items)</span>
                  <span>
                    ₹
                    {order.items
                      .reduce((sum, item) => sum + item.price * item.quantity, 0)
                      .toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span>₹99</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-gray-900 border-t pt-3">
                  <span>Total</span>
                  <span>₹{order.total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Next Steps */}
            <div className="bg-blue-50 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-3">What&apos;s next?</h3>
              <ul className="text-sm text-blue-800 space-y-2">
                <li className="flex items-start">
                  <span className="mr-2">📧</span>
                  <span>Order confirmation email sent</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">🚚</span>
                  <span>Order will be shipped in 1–2 business days</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">📦</span>
                  <span>Estimated delivery: 3–5 business days</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">📱</span>
                  <span>Tracking information will be sent via SMS &amp; Email</span>
                </li>
              </ul>
            </div>

            {/* Support Info */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Need Help?</h3>
              <p className="text-sm text-gray-600 mb-3">
                If you have any questions about your order, please contact our customer
                support.
              </p>
              <div className="text-sm text-gray-600 space-y-1">
                <p>📞 +91 99959 47709</p>
                <p>✉️ nazmiboutique1@gmail.com</p>
                <p>🕒 Mon–Sun: 9AM–6PM</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Link
                href="/"
                className="w-full bg-black text-white py-3 px-6 rounded-lg font-semibold hover:bg-gray-800 transition-colors text-center block"
              >
                Continue Shopping
              </Link>
              <button
                onClick={() => window.print()}
                className="w-full border border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:border-gray-400 transition-colors text-center block"
              >
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
