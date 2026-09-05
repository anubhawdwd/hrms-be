// src/modules/auth/service.ts
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import axios from "axios";

import { AuthRepository } from "./repository.js";
import type {
  LoginDTO,
  GoogleLoginDTO,
  MicrosoftLoginDTO,
  RefreshTokenDTO,
} from "./types.js";

import {
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
} from "../../config/auth.js";
import { AuthProvider, type UserRole } from "../../generated/prisma/enums.js";

const repo = new AuthRepository();


const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "30d";


export class AuthService {
  // get me auth verification

  async me(userId: string) {
    const user = await repo.findUserById(userId);

    if (!user || !user.isActive) {
      throw new Error("User inactive");
    }

    if (!user.companyId) {
      if (user.role === "SUPER_ADMIN") {
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          companyId: null,
          companyName: "SuperAdmin Workspace",
          geoFencingEnabled: false,
          mustChangePassword: user.mustChangePassword ?? false,
          usesTeams: false,
        };
      }
      throw new Error("Company inactive");
    }

    const company = await repo.findCompanyById(user.companyId);

    if (!company || !company.isActive) {
      throw new Error("Company inactive");
    }

    const office = await repo.findActiveOfficeLocation(user.companyId);

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      companyName: company.name,
      geoFencingEnabled: office?.geoFencingEnabled ?? false,
      mustChangePassword: user.mustChangePassword ?? false,
      usesTeams: company.usesTeams ?? false,
    };
  }

  //      EMAIL + PASSWORD LOGIN
  async login(dto: LoginDTO) {
    const user = await repo.findUserByEmail(dto.email);

    if (!user) {
      throw new Error("Invalid credentials");
    }
    if (!user.isActive) {
      throw new Error("Inactive Users not allowed");
    }

    let company = null;
    let office = null;

    if (user.companyId) {
      company = await repo.findCompanyById(user.companyId);
      if (!company || !company.isActive) {
        throw new Error("Company inactive");
      }
      office = await repo.findActiveOfficeLocation(user.companyId);
    } else if (user.role !== "SUPER_ADMIN") {
      throw new Error("User has no company assigned");
    }

    if (!user.passwordHash) {
      throw new Error("Password login not enabled for this account");
    }

    const valid = await bcrypt.compare(
      dto.password,
      user.passwordHash
    );

    if (!valid) {
      throw new Error("Invalid credentials");
    }

    const accessToken = this.generateAccessToken({
      id: user.id,
      companyId: user.companyId,
      role: user.role,
    });

    const refreshToken = this.generateRefreshToken({
      id: user.id,
    });

    await repo.createRefreshToken({
      userId: user.id,
      token: refreshToken,
      expiresAt: this.getRefreshExpiryDate(),
      ...(dto.userAgent && {userAgent: dto.userAgent}),
      ...(dto.ipAddress && {ipAddress: dto.ipAddress}),
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId ?? null,
        companyName: company?.name || (user.role === "SUPER_ADMIN" ? "SuperAdmin Workspace" : "Company Workspace"),
        geoFencingEnabled: office?.geoFencingEnabled ?? false,
        mustChangePassword: user.mustChangePassword ?? false,
        usesTeams: company?.usesTeams ?? false,
      },
    };
  }

  // CHANGE PASSWORD
  async changePassword(userId: string, dto: { currentPassword: string; newPassword: string }) {
    const user = await repo.findUserById(userId);

    if (!user || !user.isActive) {
      throw new Error("User inactive or not found");
    }

    if (!user.passwordHash) {
      throw new Error("Password login not enabled for this account");
    }

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) {
      throw new Error("Current password is incorrect");
    }

    if (!dto.newPassword || dto.newPassword.length < 6) {
      throw new Error("New password must be at least 6 characters long");
    }

    if (dto.newPassword === dto.currentPassword) {
      throw new Error("New password must be different from current password");
    }

    const newHash = await bcrypt.hash(dto.newPassword, 12);
    await repo.updatePassword(userId, newHash);

    return { message: "Password changed successfully" };
  }


  // REFRESH TOKEN ROTATION

  async refreshToken(dto: RefreshTokenDTO) {
    const stored = await repo.findRefreshToken(dto.refreshToken);
    if (!stored) {
      throw new Error("Invalid refresh token");
    }
    try {
      const decoded = jwt.verify(dto.refreshToken, JWT_REFRESH_SECRET) as jwt.JwtPayload;
      if (!decoded.sub || decoded.sub !== stored.user.id) throw Error
    } catch {
      throw new Error("Invalid refresh token");
    }
    if (!stored.user.isActive) {
      await repo.deleteRefreshToken(stored.token);
      throw new Error("Inactive user account");
    }

    // expiry check 
    if (stored.expiresAt < new Date()) {
      await repo.deleteRefreshToken(stored.token);
      throw new Error("Refresh token expired");
    }

    const accessToken = this.generateAccessToken({
      id: stored.user.id,
      companyId: stored.user.companyId,
      role: stored.user.role,
    });

    const newRefreshToken = this.generateRefreshToken({
      id: stored.user.id,
    });

    await repo.deleteRefreshToken(stored.token);

    await repo.createRefreshToken({
      userId: stored.user.id,
      token: newRefreshToken,
      expiresAt: this.getRefreshExpiryDate(),
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }


  // LOGOUT

  async logout(refreshToken: string) {
    await repo.deleteRefreshToken(refreshToken);
  }
// admin can logout All devices
  async logoutAllDevices(userId: string) {
    await repo.deleteAllRefreshTokensByUser(userId);
  }

  // GOOGLE LOGIN

  async googleLogin(dto: GoogleLoginDTO) {
    const googleUser = await this.verifyGoogleToken(dto.idToken);

    const user = await repo.findUserByEmail(googleUser.email);

    if (!user) {
      throw new Error("User not found in company");
    }

    if (!user.isActive) {
      throw new Error("Inactive Users not allowed");
    }

    if (!user.isActive) {
      throw new Error("Inactive Users not allowed");
    }

    if (user.authProvider !== AuthProvider.GOOGLE && user.authProvider !== AuthProvider.LOCAL) {
      throw new Error("Use your configured login method");
    }

    const accessToken = this.generateAccessToken({
      id: user.id,
      companyId: user.companyId,
      role: user.role,
    });

    const refreshToken = this.generateRefreshToken({
      id: user.id,
    });

    await repo.createRefreshToken({
      userId: user.id,
      token: refreshToken,
      expiresAt: this.getRefreshExpiryDate(),
    });

    if (user.mustChangePassword) {
      await repo.clearMustChangePassword(user.id);
    }

    const company = await repo.findCompanyById(user.companyId);
    const office = await repo.findActiveOfficeLocation(user.companyId);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        companyName: company?.name || "Company Workspace",
        geoFencingEnabled: office?.geoFencingEnabled ?? false,
        mustChangePassword: false,
        usesTeams: company?.usesTeams ?? false,
      },
    };
  }


  // MICROSOFT LOGIN

  async microsoftLogin(dto: MicrosoftLoginDTO) {
    const res = await axios.get(
      "https://graph.microsoft.com/v1.0/me",
      {
        headers: {
          Authorization: `Bearer ${dto.accessToken}`,
        },
      }
    );

    const email =
      res.data.mail ||
      res.data.userPrincipalName;

    if (!email) {
      throw new Error("Microsoft account has no email");
    }

    const user = await repo.findUserByEmail(email);

    if (!user) {
      throw new Error("User not found in company");
    }

    if (user.authProvider !== AuthProvider.MICROSOFT && user.authProvider !== AuthProvider.LOCAL) {
      throw new Error("Use your configured login method");
    }

    const accessToken = this.generateAccessToken({
      id: user.id,
      companyId: user.companyId,
      role: user.role,
    });

    const refreshToken = this.generateRefreshToken({
      id: user.id,
    });

    await repo.createRefreshToken({
      userId: user.id,
      token: refreshToken,
      expiresAt: this.getRefreshExpiryDate(),
    });

    if (user.mustChangePassword) {
      await repo.clearMustChangePassword(user.id);
    }

    const company = await repo.findCompanyById(user.companyId);
    const office = await repo.findActiveOfficeLocation(user.companyId);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        companyName: company?.name || "Company Workspace",
        geoFencingEnabled: office?.geoFencingEnabled ?? false,
        mustChangePassword: false,
        usesTeams: company?.usesTeams ?? false,
      },
    };
  }



  // TOKEN HELPERS


  private generateAccessToken(user: {
    id: string;
    companyId?: string | null;
    role: UserRole;
  }) {
    return jwt.sign(
      { sub: user.id, companyId: user.companyId ?? null, role: user.role },
      JWT_ACCESS_SECRET,
      { expiresIn: ACCESS_TOKEN_TTL }
    );
  }

  private generateRefreshToken(user: { id: string }) {
    return jwt.sign(
      { sub: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: REFRESH_TOKEN_TTL }
    );
  }

  private getRefreshExpiryDate() {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d;
  }


  // GOOGLE TOKEN VERIFICATION


  private async verifyGoogleToken(idToken: string) {
    const res = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
    );

    return {
      email: res.data.email,
    };
  }
}
