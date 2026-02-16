// src/modules/user/types.ts
import { AuthProvider, UserRole  } from "../../generated/prisma/enums.js";

export interface CreateUserDTO {
  companyId: string;
  email: string;
  authProvider: AuthProvider;
  role?: UserRole; 
}

export interface ListUsersDTO {
  companyId: string;
}

export interface UpdateUserDTO {
  userId: string;
  companyId: string;
  email?: string;
  authProvider?: AuthProvider;
  role?: UserRole; 
}