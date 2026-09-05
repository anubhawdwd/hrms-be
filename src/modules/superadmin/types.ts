// src/modules/superadmin/types.ts
import type { UserRole } from "../../generated/prisma/enums.js";

export interface CreateSuperAdminDTO {
  email: string;
  password?: string | undefined;
}

export interface SuperAdminResponseDTO {
  id: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
  updatedAt: Date;
}

