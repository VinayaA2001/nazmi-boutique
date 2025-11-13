"use client";

export default function OverviewTiles({
  ordersCount,
  deliveredCount,
  onRecentClick,
  onDeliveredClick,
}: {
  ordersCount: number;
  deliveredCount: number;
  onRecentClick?: () => void;
  onDeliveredClick?: () => void;
}) {
  return (
    <div className="max-w-7xl mx-auto px-4">
      <div className="bg-white border rounded-2xl p-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Account Overview</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Orders */}
          <button
            onClick={onRecentClick}
            className="text-left rounded-xl p-6 bg-gradient-to-br from-blue-50 to-blue-100 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <p className="text-blue-700 font-semibold">Recent Orders</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{ordersCount}</p>
            <span className="inline-block mt-3 text-sm text-blue-700 underline">
              View recent orders &gt;
            </span>
          </button>
          {/* Delivered */}
          <button
            onClick={onDeliveredClick}
            className="text-left rounded-xl p-6 bg-gradient-to-br from-purple-50 to-purple-100 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <p className="text-purple-700 font-semibold">Delivered</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{deliveredCount}</p>
            <span className="inline-block mt-3 text-sm text-purple-700 underline">
              View delivered orders &gt;
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}



