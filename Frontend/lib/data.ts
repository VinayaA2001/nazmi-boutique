// lib/data.ts

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  images: string[];
  category: string;
  tags: string[];
  inStock: boolean;
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
  // ✅ add these:
  sizes?: string[];   // optional so old items still type-check
  stock: number;      // how many you have (used by detail page)
}


/**
 * Mock data
 * - Keep `stock` up to date. `inStock` is set to stock > 0 for convenience.
 * - Add/replace images with your Cloudinary URLs as needed.
 */
export const products: Product[] = [
  {
    id: "1",
    slug: "embroidered-kurti-1",
    name: "Embroidered Kurti",
    description: "Beautiful hand-embroidered cotton kurti",
    price: 1899,
    originalPrice: 2499,
    images: ["/images/products/kurti-1.jpg"],
    category: "traditional",
    tags: ["new", "embroidered", "cotton"],
    inStock: true,
    featured: true,
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
    sizes: ["S", "M", "L", "XL"], // ✅ optional
    stock: 5,                    // ✅ required by page
  },
  {
    id: "2",
    slug: "designer-saree-2",
    name: "Designer Saree",
    description: "Elegant silk saree with designer work",
    price: 4599,
    originalPrice: 5999,
    images: ["/images/products/saree-1.jpg"],
    category: "traditional",
    tags: ["new", "silk", "designer"],
    inStock: true,
    featured: true,
    createdAt: new Date("2024-01-10"),
    updatedAt: new Date("2024-01-10"),
    sizes: ["M", "L"], // ✅ optional
    stock: 3,          // ✅
  },
];

/** New Arrivals helper (last 30 days) */
export function getNewArrivals(): Product[] {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return products
    .filter((p) => p.createdAt >= thirtyDaysAgo)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Find a single product by slug */
export function getProductBySlug(slug: string): Product | undefined {
  return (
    products.find((p) => p.slug === slug) ||
    products.find(
      (p) => p.name.toLowerCase().replace(/\s+/g, "-") === slug.toLowerCase()
    )
  );
}

/** Simple related products (same category, excluding the current one) */
export function getRelatedProducts(
  product: Product,
  limit = 4
): Product[] {
  return products
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, limit);
}