// src/modules/user/types.ts
import { AuthProvider, UserRole } from "../../generated/prisma/enums.js";

export interface CreateUserDTO {
  companyId: string;
  email: string;
  authProvider: AuthProvider;
  role?: UserRole;
  roles?: UserRole[];
}

export interface ListUsersDTO {
  companyId: string;
}

export interface UpdateUserEmailDTO {
  userId: string;
  companyId?: string | null | undefined;
  email: string;
  actorUserId?: string | undefined;
}

export interface UpdateUserDTO {
  userId: string;
  companyId: string;
  email?: string | undefined;
  authProvider?: AuthProvider | undefined;
  role?: UserRole | undefined;
  roles?: UserRole[] | undefined;
  actorUserId?: string | undefined;
}

export interface ResetPasswordDTO {
  userId: string;
  companyId: string;
  manualPassword?: string;
}