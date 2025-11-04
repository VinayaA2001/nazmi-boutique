// app/terms/page.tsx
import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-r from-amber-600 to-orange-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">N</span>
              </div>
              <span className="font-bold text-gray-900">NAZMI</span>
            </Link>
            <nav className="flex gap-6 text-sm">
              <Link href="/" className="text-gray-600 hover:text-gray-900">Home</Link>
              <Link href="/products" className="text-gray-600 hover:text-gray-900">Shop</Link>
              <Link href="/login" className="text-gray-600 hover:text-gray-900">Sign In</Link>
            </nav>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Service</h1>
          
          <div className="prose prose-amber max-w-none">
            <p className="text-gray-600 mb-6">Last updated: {new Date().toLocaleDateString()}</p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-700 mb-4">
                Welcome to NAZMI Boutique. By accessing and using our website, mobile application, 
                and services (collectively, the "Services"), you agree to be bound by these Terms 
                of Service and our Privacy Policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">2. Account Registration</h2>
              <p className="text-gray-700 mb-4">
                To access certain features, you must register for an account. You agree to:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
                <li>Provide accurate and complete information</li>
                <li>Maintain the security of your password</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Be at least 18 years old or have parental consent</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">3. Products and Pricing</h2>
              <p className="text-gray-700 mb-4">
                We strive to display accurate product information, including prices, descriptions, 
                and availability. However, we reserve the right to:
              </p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
                <li>Correct any errors in pricing or product information</li>
                <li>Limit quantities available for purchase</li>
                <li>Refuse or cancel orders for any reason</li>
                <li>Discontinue products at any time</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Orders and Payment</h2>
              <p className="text-gray-700 mb-4">
                All orders are subject to acceptance and availability. We accept various payment 
                methods and process payments securely. You agree to provide current and complete 
                payment information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Shipping and Delivery</h2>
              <p className="text-gray-700 mb-4">
                Shipping times are estimates and may vary. Risk of loss passes to you upon delivery 
                to the carrier. You are responsible for any customs duties or import taxes.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">6. Returns and Exchanges</h2>
              <p className="text-gray-700 mb-4">
                Please review our Return Policy for detailed information about returns, exchanges, 
                and refunds. Items must be in original condition with tags attached.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Intellectual Property</h2>
              <p className="text-gray-700 mb-4">
                All content on our Services, including text, graphics, logos, and images, is the 
                property of NAZMI Boutique or its content suppliers and protected by intellectual 
                property laws.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">8. User Conduct</h2>
              <p className="text-gray-700 mb-4">You agree not to:</p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
                <li>Use the Services for any illegal purpose</li>
                <li>Attempt to gain unauthorized access to any part of the Services</li>
                <li>Interfere with the proper working of the Services</li>
                <li>Submit false or misleading information</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">9. Limitation of Liability</h2>
              <p className="text-gray-700 mb-4">
                NAZMI Boutique shall not be liable for any indirect, incidental, special, 
                consequential, or punitive damages resulting from your use of the Services.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">10. Changes to Terms</h2>
              <p className="text-gray-700 mb-4">
                We reserve the right to modify these Terms at any time. Continued use of the 
                Services after changes constitutes acceptance of the modified Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">11. Contact Information</h2>
              <p className="text-gray-700">
                For questions about these Terms, please contact us at:
              </p>
              <p className="text-gray-700 mt-2">
                Email: legal@nazmiboutique.com<br />
                Phone: +1 (555) 123-NAZMI<br />
                Address: 123 Fashion District, Kozhikode, Kerala, India
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}