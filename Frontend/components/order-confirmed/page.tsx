// app/order-confirmed/page.tsx
import { Suspense } from "react";
import OrderConfirmedContent from "@/components/order-confirmed/OrderConfirmedContent";

export default function OrderConfirmedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4" />
            <p>Loading order details...</p>
          </div>
        </div>
      }
    >
      <OrderConfirmedContent />
    </Suspense>
  );
}
