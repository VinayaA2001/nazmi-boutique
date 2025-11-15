// C:\NAZMI_BOUTIQUE\Frontend\components\account\AccountTabs.tsx
"use client";

export type TabId = "overview" | "orders" | "wishlist" | "addresses";

export default function AccountTabs({
  active,
  setActive,
}: {
  active: TabId;
  setActive: (t: TabId) => void;
}) {
  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "orders", label: "Orders & Tracking" },
    { id: "wishlist", label: "Wishlist" },
    { id: "addresses", label: "Addresses" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 mt-6">
      <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border whitespace-nowrap ${
              active === t.id
                ? "bg-black text-white border-black"
                : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
