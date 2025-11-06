// components/sections/NewArrivals.tsx
import ProductCardClient, { CardProduct } from "@/components/commerce/ProductCardClient";
import { fetchNewArrivals, isEthnicOrWestern, removeDuplicates, optimizeCloudinaryUrl } from "@/lib/product";

// Process product images for consistent format
const processProductImages = (product: any): string[] => {
  const images: string[] = [];
  
  // Handle images array
  if (Array.isArray(product.images) && product.images.length > 0) {
    images.push(...product.images);
  }
  
  // Handle single image field
  if (product.image && !images.includes(product.image)) {
    images.push(product.image);
  }
  
  // If no images found, use placeholder
  if (images.length === 0) {
    return ["/images/placeholder.png"];
  }
  
  // Optimize all image URLs
  return images.map(img => optimizeCloudinaryUrl(img));
};

// Fallback products when API fails
const fallbackProducts: CardProduct[] = Array.from({ length: 10 }, (_, i) => ({
  _id: `fallback-${i}`,
  slug: `product-${i + 1}`,
  name: `Fashion Item ${i + 1}`,
  category: i % 2 === 0 ? "Ethnic Wear" : "Western Wear",
  images: ["/images/placeholder.png"],
  minPrice: 999 + (i * 100),
  maxPrice: 1499 + (i * 100),
}));

export default async function NewArrivals({
  title = "New Arrivals",
  limit = 10,
}: {
  title?: string;
  limit?: number;
}) {
  let products: CardProduct[] = [];

  try {
    // Fetch products with error handling
    const fetched = await fetchNewArrivals(Math.max(limit * 2, 20));
    
    console.log('Fetched products:', fetched.length);
    
    // Filter and process products
    const filtered = fetched.filter(p => isEthnicOrWestern(p.category));
    const unique = removeDuplicates(filtered).slice(0, limit);
    
    // Map to CardProduct format with optimized images
    products = unique.map((p) => ({
      _id: p._id,
      slug: p.slug || p._id,
      name: p.product_name || p.name || "Untitled",
      category: p.category,
      images: processProductImages(p),
      minPrice: p.minPrice || p.price,
      maxPrice: p.maxPrice || p.price,
    }));

    console.log('Processed products:', products.length);
    if (products.length > 0) {
      console.log('Sample product:', {
        name: products[0].name,
        images: products[0].images,
        category: products[0].category
      });
    }
  } catch (error) {
    console.error("Error fetching new arrivals:", error);
    products = fallbackProducts.slice(0, limit);
  }

  // If no products after processing, use fallbacks
  if (products.length === 0) {
    console.log('Using fallback products');
    products = fallbackProducts.slice(0, limit);
  }

  return (
    <section className="py-10 sm:py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-end justify-between mb-6 sm:mb-8">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-500">Latest drop</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
              {title} <span className="text-gray-400 text-base align-top">({products.length})</span>
            </h2>
          </div>
        </div>

        {products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-5">
            {products.map((p, index) => (
              <ProductCardClient
                key={p._id}
                p={p}
                priority={index < 4}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No products available at the moment.</p>
            <p className="text-gray-400 text-sm mt-2">Please check back later.</p>
          </div>
        )}
      </div>
    </section>
  );
}