import { NextRequest, NextResponse } from "next/server"; 
import { hash } from "bcryptjs";
import { users, type User } from "@/lib/mockDb";

/* Helpers */
const isEmail = (s?: string) => !!s && /^\S+@\S+\.\S+$/.test(s.trim());
const normEmail = (s: string) => s.trim().toLowerCase();
const looksLikePhone = (s?: string) => {
  if (!s) return false;
  const digits = s.replace(/[^\d]/g, "");
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
    const body = await request.json();
    let { email, phone, password, firstName, lastName } = body ?? {};

    // Required fields
    if (!password || !firstName || !lastName || (!email && !phone)) {
      return NextResponse.json(
        {
          code: "MISSING_FIELDS",
          field: "emailOrPhone",
          message:
            "Provide password, first name, last name, and at least one of email or phone",
        },
        { status: 400 }
      );
    }

    // Normalize + validate
    let normalizedEmail: string | undefined;
    let normalizedPhone: string | undefined;

    if (email) {
      if (!isEmail(email)) {
        return NextResponse.json(
          { code: "INVALID_EMAIL", field: "email", message: "Enter a valid email address" },
          { status: 400 }
        );
      }
      normalizedEmail = normEmail(email);
    }

    if (phone) {
      if (!looksLikePhone(phone)) {
        return NextResponse.json(
          { code: "INVALID_PHONE", field: "phone", message: "Enter a valid 10-digit Indian phone number" },
          { status: 400 }
        );
      }
      normalizedPhone = normPhone(phone);
    }

    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { code: "WEAK_PASSWORD", field: "password", message: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Uniqueness checks
    const emailClashUser = normalizedEmail
      ? users.find((u) => u.email && u.email.toLowerCase() === normalizedEmail)
      : null;
    if (emailClashUser) {
      return NextResponse.json(
        { code: "EMAIL_EXISTS", field: "email", message: "Email already registered" },
        { status: 409 }
      );
    }

    const phoneClashUser = normalizedPhone
      ? users.find((u) => u.phone && normPhone(u.phone) === normalizedPhone)
      : null;
    if (phoneClashUser) {
      return NextResponse.json(
        { code: "PHONE_EXISTS", field: "phone", message: "Phone number already registered" },
        { status: 409 }
      );
    }

    // Create user
    const hashedPassword = await hash(password, 12);
    const user: User = {
      id: Date.now().toString(),
      email: normalizedEmail ?? null,
      phone: normalizedPhone ?? null,
      password: hashedPassword,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      emailVerified: false,
      phoneVerified: false,
      emailVerificationToken: normalizedEmail ? Math.random().toString(36).slice(2, 12) : null,
      phoneVerificationToken: normalizedPhone ? Math.floor(100000 + Math.random() * 900000).toString() : null,
      createdAt: new Date().toISOString(),
    };

    users.push(user);

    // ✅ Debug Log
    console.log("[REGISTER] users length now:", users.length);

    const { password: _omit, ...userWithoutPassword } = user;

    return NextResponse.json({ message: "Registration successful!", user: userWithoutPassword }, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
