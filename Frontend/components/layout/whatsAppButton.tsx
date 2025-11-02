// components/layout/WhatsAppButton.tsx
"use client";

type Props = {
  label?: string;
  preset?: string;
  phone?: string; // ✅ Add phone number as prop
};

export default function WhatsAppButton({
  label = "Chat on WhatsApp",
  preset = "Hi Nazmi! I have a question about this page.",
  phone = "+919995947709", // 👈 replace with your WhatsApp number (with country code)
}: Props) {
  const text = encodeURIComponent(preset);
  const href = `https://wa.me/${phone}?text=${text}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-16 right-5 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-green-500 text-white shadow-lg hover:bg-green-600 transition"
    >
      {/* WhatsApp Icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-7 h-7"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M12 0C5.373 0 0 5.373 0 12c0 2.122.553 4.144 1.604 5.928L0 24l6.26-1.627A11.96 11.96 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0Zm0 21.75c-1.928 0-3.812-.5-5.465-1.446l-.391-.224-3.71.964.99-3.62-.254-.377A9.742 9.742 0 0 1 2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75Zm5.324-7.426c-.29-.145-1.717-.848-1.984-.943-.267-.096-.462-.145-.657.145s-.754.943-.924 1.138c-.17.195-.34.219-.629.073-.29-.145-1.223-.451-2.33-1.437-.861-.768-1.442-1.715-1.612-2.005-.17-.29-.018-.447.127-.592.13-.13.29-.34.435-.51.145-.17.193-.29.29-.484.096-.194.048-.364-.024-.51-.073-.145-.657-1.586-.9-2.173-.237-.57-.478-.492-.657-.502l-.56-.01c-.193 0-.51.073-.778.364s-1.02.996-1.02 2.427 1.044 2.817 1.19 3.013c.145.193 2.056 3.137 4.983 4.4.697.3 1.24.478 1.664.612.699.223 1.336.191 1.84.116.56-.083 1.717-.701 1.96-1.378.242-.678.242-1.258.169-1.378-.073-.12-.267-.193-.557-.338Z" />
      </svg>
    </a>
  );
}
