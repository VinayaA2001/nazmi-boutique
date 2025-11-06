export type User = {
  id: string;
  email?: string | null;
  phone?: string | null;
  password: string;
  firstName?: string | null;
  lastName?: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  emailVerificationToken?: string | null;
  phoneVerificationToken?: string | null;
  createdAt: string;
};

export const users: User[] = [];
