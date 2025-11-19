import { Suspense } from "react";
import VerifyClient from "../verify/VerifyClient";

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white border rounded-2xl shadow p-6 text-center">
            Verifying your email...
          </div>
        </div>
      }
    >
      <VerifyClient />
    </Suspense>
  );
}
