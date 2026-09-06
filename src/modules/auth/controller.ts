// src/modules/auth/controller.ts

import type { Request, Response } from "express";
import { AuthService } from "./service.js";
import { REFRESH_TOKEN_COOKIE } from "../../config/auth.js";

const service = new AuthService();


// Cookie options — environment-aware for LAN HTTP (COOKIE_SECURE=false) & production HTTPS (COOKIE_SECURE=true)
const getCookieOptions = () => {
  const isSecure = process.env.COOKIE_SECURE === "true";
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: (isSecure ? "none" : "lax") as "none" | "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: "/",
  };
};

// GET /auth/me
export async function me(req: Request, res: Response) {
    try {
        const data = await service.me(req.user!.userId);
        res.json(data);
    } catch {
        res.status(401).json({ message: "Unauthorized" });
    }
}

// POST /auth/login
export async function login(req: Request, res: Response) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res
                .status(400)
                .json({ message: "Email and password required" });
        }

        const result = await service.login({
            email,
            password,
            ...(req.headers["user-agent"] && {
                userAgent: req.headers["user-agent"],
            }),
            ...(req.ip && { ipAddress: req.ip }),
        });

        res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, getCookieOptions());

        return res.json({
            accessToken: result.accessToken,
            user: result.user,
        });
    } catch (err: any) {
        return res.status(401).json({ message: err.message });
    }
}

// POST /auth/google
export async function googleLogin(req: Request, res: Response) {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({ message: "idToken required" });
        }

        const result = await service.googleLogin({
            idToken,
            ...(req.headers["user-agent"] && {
                userAgent: req.headers["user-agent"],
            }),
            ...(req.ip && { ipAddress: req.ip }),
        });

        res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, getCookieOptions());

        return res.json({
            accessToken: result.accessToken,
            user: result.user,
        });
    } catch (err: any) {
        return res.status(401).json({ message: err.message });
    }
}

// POST /auth/microsoft
export async function microsoftLogin(req: Request, res: Response) {
    try {
        const { accessToken } = req.body;

        if (!accessToken) {
            return res.status(400).json({ message: "accessToken required" });
        }

        const result = await service.microsoftLogin({
            accessToken,
            ...(req.headers["user-agent"] && {
                userAgent: req.headers["user-agent"],
            }),
            ...(req.ip && { ipAddress: req.ip }),
        });

        res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, getCookieOptions());

        return res.json({
            accessToken: result.accessToken,
            user: result.user,
        });
    } catch (err: any) {
        return res.status(401).json({ message: err.message });
    }
}

// POST /auth/refresh
export async function refreshToken(req: Request, res: Response) {
    try {
        const token = req.cookies?.[REFRESH_TOKEN_COOKIE];

        if (!token) {
            return res.status(401).json({ message: "Missing refresh token" });
        }

        const result = await service.refreshToken({
            refreshToken: token,
            ...(req.headers["user-agent"] && {
                userAgent: req.headers["user-agent"],
            }),
            ...(req.ip && { ipAddress: req.ip }),
        });

        res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, getCookieOptions());

        return res.json({
            accessToken: result.accessToken,
        });
    } catch (err: any) {
        return res.status(401).json({ message: err.message });
    }
}

// POST /auth/logout
export async function logout(req: Request, res: Response) {
    try {
        const token = req.cookies?.[REFRESH_TOKEN_COOKIE];

        if (token) {
            await service.logout(token);
        }

        res.clearCookie(REFRESH_TOKEN_COOKIE, getCookieOptions());

        return res.json({ message: "Logged out" });
    } catch {
        return res.json({ message: "Logged out" });
    }
}

// POST /auth/change-password
export async function changePassword(req: Request, res: Response) {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res
                .status(400)
                .json({ message: "currentPassword and newPassword required" });
        }

        const result = await service.changePassword(req.user!.userId, {
            currentPassword,
            newPassword,
        });

        return res.json(result);
    } catch (err: any) {
        return res.status(400).json({ message: err.message });
    }
}
