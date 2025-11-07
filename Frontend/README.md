Nazmi Boutique Frontend

Environment and Build Notes

- Required env vars (Vercel → Project Settings → Environment Variables):
  - `NEXT_PUBLIC_API_URL` → your Flask backend base URL (e.g. https://nazmi-boutique-2.onrender.com)
  - `NEXT_PUBLIC_RAZORPAY_KEY_ID` → your Razorpay key
  - `RESEND_API_KEY` and `EMAIL_FROM` if you use email features
  - `DATABASE_URL` (Mongo URI) only if you want Prisma Client generated during install

- Prisma generation is conditional:
  - The postinstall script checks for `DATABASE_URL` and runs `npx prisma generate` only when it is present.
  - If `DATABASE_URL` is not set in Vercel, the build will skip Prisma generation and proceed.
  - Local development: create `Frontend/.env` or `Frontend/.env.local` and set `DATABASE_URL` if you use the minimal Prisma models (e.g., VerificationToken).

- API calls:
  - The Next.js app uses same-origin proxy routes under `/api/*` that forward to the Flask backend defined by `NEXT_PUBLIC_API_URL`.
  - Auth (login/register/forgot/reset/profile), products, orders, and payments are forwarded server-side to avoid browser CORS issues.

- Images:
  - `next.config.mjs` is configured to allow `res.cloudinary.com` and your Render host for remote images.
  - Product components normalize Cloudinary URLs and fall back to `/images/poster1.png` only when a product has no images.

- Cart and header count:
  - The cart is stored in `localStorage` under the `cart` key.
  - `CartContext` listens for the `cart-updated` event and the `storage` event to stay in sync across tabs.
  - Use the `CartContext` methods (`addToCart`, `updateQuantity`, etc.) where possible; they dispatch `cart-updated` for you.

