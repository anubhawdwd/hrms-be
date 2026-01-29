import { AuthProvider } from "../../generated/prisma/enums.js";

export interface CreateUserDTO {
  companyId: string;
  email: string;
  authProvider: AuthProvider;
}

export interface ListUsersDTO {
  companyId: string;
}
