// C:\NAZMI_BOUTIQUE\Frontend\lib\mockDb.ts
import { hashSync } from "bcryptjs";

export type User = {
  id: string;
  email?: string | null;
  phone?: string | null;
  password: string; // hashed
  firstName?: string | null;
  lastName?: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  emailVerificationToken?: string | null;
  phoneVerificationToken?: string | null;
  createdAt: string;
};

export const users: User[] = [
  {
    id: "u-vinaya",
    email: "vinayaammu2001@gmail.com",
    phone: "+919072486326",           // optional
    password: hashSync("password123", 10),
    firstName: "Vinaya",
    lastName: "A",
    emailVerified: false,
    phoneVerified: false,
    createdAt: new Date().toISOString(),
  },
];
