"use client";

type TabId = "overview" | "orders" | "addresses";

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
    { id: "addresses", label: "Addresses" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 mt-6">
      <div className="flex gap-2 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${
              active === t.id ? "bg-black text-white border-black" : "bg-white text-gray-800 border-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

