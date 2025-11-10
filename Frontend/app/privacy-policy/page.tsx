export const metadata = {
  title: "Privacy Policy | Nazmi Boutique",
  description: "Learn how Nazmi Boutique collects, uses, and protects your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 text-gray-800">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>

      <p className="mb-4">
        Nazmi Boutique (“we”, “our”, “us”) operates the website{" "}
        <a href="https://www.nazmiboutique.com" className="text-blue-600 hover:underline">
          www.nazmiboutique.com
        </a>. This Privacy Policy explains how we collect, use, and protect your personal
        information when you visit or make a purchase from our website.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">1. Information We Collect</h2>
      <p className="mb-4">
        We may collect personal details such as your name, email address, phone number,
        billing and shipping address, and payment information (processed securely via Razorpay).
        We also gather device, browser, and usage data through cookies and analytics.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">2. How We Use Your Information</h2>
      <p className="mb-4">
        Your information helps us process and deliver orders, manage payments, provide
        customer support, send updates or promotions (only with consent), and improve
        our website and shopping experience.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">3. Payment Security</h2>
      <p className="mb-4">
        We use <strong>Razorpay</strong> as our secure payment gateway. All transactions
        are encrypted and processed on Razorpay’s servers. Nazmi Boutique does not store
        any card or payment details. For more information, please review Razorpay’s Privacy Policy.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">4. Data Protection</h2>
      <p className="mb-4">
        We adopt strict data collection, storage, and security practices. Personal data
        is accessed only by authorized personnel. We never sell, trade, or rent user information.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">5. Cookies</h2>
      <p className="mb-4">
        Our website uses cookies to enhance your shopping experience and remember preferences.
        You may disable cookies through your browser settings if you prefer.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">6. Third-Party Services</h2>
      <p className="mb-4">
        We may share limited data with trusted third parties (like delivery partners or
        email/SMS providers) solely for order fulfillment and communication.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">7. Your Rights</h2>
      <p className="mb-4">
        You may request access, correction, or deletion of your personal data at any time
        by contacting us at{" "}
        <a href="mailto:nazmiboutique1@gmail.com" className="text-blue-600 hover:underline">
          nazmiboutique1@gmail.com
        </a>.
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">8. Contact Us</h2>
      <p className="mb-4">
        <strong>Nazmi Boutique</strong>
        <br />
        Kerala, India
        <br />
        📞 +91 99959 47709
        <br />
        ✉️{" "}
        <a href="mailto:nazmiboutique1@gmail.com" className="text-blue-600 hover:underline">
          nazmiboutique1@gmail.com
        </a>
      </p>

      <h2 className="text-xl font-semibold mt-8 mb-2">9. Policy Updates</h2>
      <p className="mb-4">
        We may update this Privacy Policy from time to time. The latest version will
        always be available on our website.
      </p>

      <p className="text-sm text-gray-500 mt-8">
        Last updated: {new Date().getFullYear()}
      </p>
    </div>
  );
}
