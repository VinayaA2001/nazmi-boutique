// app/terms/page.tsx
import Link from "next/link";

export const metadata = {
  title: "Terms & Conditions | Nazmi Boutique",
  description:
    "Read the Terms & Conditions for using Nazmi Boutique’s website, services, and online store.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-r from-amber-600 to-orange-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">N</span>
              </div>
              <span className="font-bold text-gray-900 tracking-wide">NAZMI</span>
            </Link>
            <nav className="flex gap-6 text-sm">
              <Link href="/" className="text-gray-600 hover:text-gray-900">Home</Link>
              <Link href="/products" className="text-gray-600 hover:text-gray-900">Shop</Link>
              <Link href="/auth/login" className="text-gray-600 hover:text-gray-900">Sign In</Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Terms Content */}
      <main className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-sm border p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms & Conditions</h1>

          <p className="text-gray-600 mb-6">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              1. Acceptance of Terms
            </h2>
            <p className="text-gray-700 mb-4">
              Welcome to Nazmi Boutique. By accessing or using our website, mobile
              application, or any related services (“Services”), you agree to these
              Terms & Conditions and our Privacy Policy. Please read them carefully
              before using our Services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              2. Account Registration
            </h2>
            <p className="text-gray-700 mb-4">
              To access certain features, you may need to create an account. You agree to:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>Provide accurate and up-to-date information</li>
              <li>Maintain the confidentiality of your password</li>
              <li>Be responsible for all activities under your account</li>
              <li>Be at least 18 years old or have parental consent</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              3. Products and Pricing
            </h2>
            <p className="text-gray-700 mb-4">
              We strive to ensure that all product information, including prices and
              availability, is accurate. However, we reserve the right to:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>Correct any errors or inaccuracies</li>
              <li>Update prices or availability without notice</li>
              <li>Refuse or cancel any order at our discretion</li>
              <li>Limit the quantity of items purchased</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              4. Orders and Payments
            </h2>
            <p className="text-gray-700 mb-4">
              Orders are subject to acceptance and availability. Payments are processed
              securely via our authorized payment partners (e.g., Razorpay). You agree
              to provide valid and accurate payment details for all transactions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              5. Shipping and Delivery
            </h2>
            <p className="text-gray-700 mb-4">
              Delivery times are estimates and may vary based on location or carrier.
              Risk of loss passes to the customer upon dispatch. Any customs duties or
              import taxes are the buyer’s responsibility.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              6. Returns and Exchanges
            </h2>
            <p className="text-gray-700 mb-4">
              Please refer to our <Link href="/return-policy" className="text-blue-600 hover:underline">Return Policy</Link> for details regarding returns, refunds, and exchanges.
              Items must be unused, in original packaging, and returned within the
              specified period.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              7. Intellectual Property
            </h2>
            <p className="text-gray-700 mb-4">
              All website content, including text, images, and designs, is owned by
              Nazmi Boutique or its licensors and protected under applicable
              intellectual property laws. You may not reproduce or distribute any
              materials without our written permission.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              8. User Conduct
            </h2>
            <p className="text-gray-700 mb-4">
              You agree not to:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>Use our Services for unlawful purposes</li>
              <li>Interfere with or disrupt the website’s functionality</li>
              <li>Attempt unauthorized access to our systems</li>
              <li>Provide false, misleading, or fraudulent information</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              9. Limitation of Liability
            </h2>
            <p className="text-gray-700 mb-4">
              Nazmi Boutique shall not be liable for any indirect, incidental,
              consequential, or punitive damages arising from your use of our
              Services or any products purchased through our website.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              10. Modifications to Terms
            </h2>
            <p className="text-gray-700 mb-4">
              We may update or modify these Terms from time to time. Any changes will
              take effect immediately upon posting on this page. Continued use of our
              Services constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              11. Contact Us
            </h2>
            <p className="text-gray-700 mb-2">
              For questions or concerns regarding these Terms, please contact us at:
            </p>
            <p className="text-gray-700">
              Nazmi Boutique<br />
              Kerala, India<br />
              📞 +91 99959 47709<br />
              ✉️ <a href="mailto:nazmiboutique1@gmail.com" className="text-blue-600 hover:underline">
                nazmiboutique1@gmail.com
              </a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
