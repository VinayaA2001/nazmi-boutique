import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { users } from "@/lib/mockDb";

/* Helpers */
const isEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s.trim());
const normEmail = (s: string) => s.trim().toLowerCase();
const isPhoneLike = (s: string) => {
  const digits = s.trim().replace(/[^\d]/g, "");
  return digits.length >= 10 && digits.length <= 15;
};
const normPhone = (s: string) => {
  const raw = s.trim();
  const keptPlus = raw.startsWith("+") ? "+" : "";
  const digits = raw.replace(/[^\d]/g, "");
  return keptPlus + digits;
};

export async function POST(request: NextRequest) {
  try {
    const { emailOrPhone, password } = await request.json();

    if (!emailOrPhone || !password) {
      return NextResponse.json(
        { code: "MISSING_FIELDS", field: "emailOrPhone", message: "Email/phone and password are required" },
        { status: 400 }
      );
    }

    // Find user by normalized email or phone
    let user = undefined;

    if (isEmail(emailOrPhone)) {
      const key = normEmail(emailOrPhone);
      user = users.find((u) => u.email && u.email.toLowerCase() === key);
    } else if (isPhoneLike(emailOrPhone)) {
      const key = normPhone(emailOrPhone);
      user = users.find((u) => u.phone && normPhone(u.phone) === key);
    } else {
      return NextResponse.json(
        { code: "INVALID_IDENTIFIER", field: "emailOrPhone", message: "Enter a valid email address or phone number" },
        { status: 400 }
      );
    }

    // ✅ Debug Log
    console.log("[LOGIN] users length at login:", users.length);

    if (!user) {
      return NextResponse.json(
        { code: "USER_NOT_FOUND", field: "emailOrPhone", message: "No account found for this email/phone" },
        { status: 401 }
      );
    }

    const ok = await compare(password, user.password);
    if (!ok) {
      return NextResponse.json(
        { code: "WRONG_PASSWORD", field: "password", message: "Incorrect password" },
        { status: 401 }
      );
    }

    const { password: _omit, ...userWithoutPassword } = user;
    const token = `token-${Date.now()}-${user.id}`; // demo token

    return NextResponse.json({ message: "Login successful", token, user: userWithoutPassword });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
