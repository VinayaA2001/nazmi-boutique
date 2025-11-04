// app/product/[slug]/page.tsx
import ProductDetailsClient from "@/components/commerce/ProductDetailsClient";


export async function generateMetadata({ params }: { params: { slug: string } }) {
  const product = await fetchProduct(params.slug);
  const title = product?.product_name || product?.name || "Product";
  const desc =
    (product?.description && product.description.slice(0, 150)) ||
    "Explore premium fashion from Nazmi Boutique.";
  const img = product?.images?.[0];

  return {
    title: `${title} | Nazmi Boutique`,
    description: desc,
    openGraph: {
      title: `${title} | Nazmi Boutique`,
      description: desc,
      images: img ? [{ url: img }] : [],
    },
  };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product: NormalizedProduct | null = await fetchProduct(params.slug);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <h1 className="text-2xl font-semibold text-gray-900">Product not found</h1>
        <p className="mt-2 text-gray-600">
          The item you’re looking for doesn’t exist or is unavailable.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <ProductDetailsClient product={product} />
      </div>
    </div>
  );
}
