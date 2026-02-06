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

  //      EMAIL + PASSWORD LOGIN
  async login(dto: LoginDTO) {
    const user = await repo.findUserByEmail(dto.email);

    if (!user) {
      throw new Error("Invalid credentials");
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
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        companyId: user.companyId,
      },
    };
  }


  // REFRESH TOKEN ROTATION

  async refreshToken(dto: RefreshTokenDTO) {
    const stored = await repo.findRefreshToken(dto.refreshToken);

    if (!stored) {
      throw new Error("Invalid refresh token");
    }

    try {
      jwt.verify(dto.refreshToken, JWT_REFRESH_SECRET);
    } catch {
      throw new Error("Invalid refresh token");
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


  // GOOGLE LOGIN

  async googleLogin(dto: GoogleLoginDTO) {
    const googleUser = await this.verifyGoogleToken(dto.idToken);

    const user = await repo.findUserByEmail(googleUser.email);

    if (!user) {
      throw new Error("User not found in company");
    }

    if (user.authProvider !== AuthProvider.GOOGLE) {
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

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        companyId: user.companyId,
      },
    };
  }


  // MICROSOFT LOGIN (placeholder)


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
    
    if (user.authProvider !==  AuthProvider.MICROSOFT) {
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

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        companyId: user.companyId,
      },
    };
  }



  // TOKEN HELPERS


  private generateAccessToken(user: {
    id: string;
    companyId: string;
    role: UserRole;
  }) {
    return jwt.sign(
      { sub: user.id, companyId: user.companyId, role: user.role },
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
