// src/modules/auth/controller.ts
import type { Request, Response } from "express";
import { AuthService } from "./service.js";
import { REFRESH_TOKEN_COOKIE } from "../../config/auth.js";

const service = new AuthService();

// GET /auth/me

export async function me(req: Request, res: Response) {
  try {
    const data = await service.me(req.user!.userId);
    res.json(data);
  } catch {
    res.status(401).json({ message: "Unauthorized" });
  }
}


//    POST /auth/login
export async function login(req: Request, res: Response) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password required" });
        }

        const result = await service.login({
            email,
            password,
        });

        res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, {
            httpOnly: true,
            sameSite: "lax",
        });

        return res.json({
            accessToken: result.accessToken,
            user: result.user,
        });
    } catch (err: any) {
        return res.status(401).json({ message: err.message });
    }
}


//    POST /auth/google
export async function googleLogin(req: Request, res: Response) {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({ message: "idToken required" });
        }

        const result = await service.googleLogin({ idToken });

        res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, {
            httpOnly: true,
            sameSite: "lax",
        });

        return res.json({
            accessToken: result.accessToken,
            user: result.user,
        });
    } catch (err: any) {
        return res.status(401).json({ message: err.message });
    }
}


//    POST /auth/microsoft
export async function microsoftLogin(req: Request, res: Response) {
    try {
        const { accessToken } = req.body;

        if (!accessToken) {
            return res.status(400).json({ message: "accessToken required" });
        }

        const result = await service.microsoftLogin({ accessToken });

        res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, {
            httpOnly: true,
            sameSite: "lax",
        });

        return res.json({
            accessToken: result.accessToken,
            user: result.user,
        });
    } catch (err: any) {
        return res.status(401).json({ message: err.message });
    }
}


//    POST /auth/refresh
export async function refreshToken(req: Request, res: Response) {
    try {
        const token = req.cookies?.[REFRESH_TOKEN_COOKIE];

        if (!token) {
            return res.status(401).json({ message: "Missing refresh token" });
        }

        const result = await service.refreshToken({ refreshToken: token });

        res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, {
            httpOnly: true,
            sameSite: "lax",
        });

        return res.json({
            accessToken: result.accessToken,
        });
    } catch (err: any) {
        return res.status(401).json({ message: err.message });
    }
}


//    POST /auth/logout
export async function logout(req: Request, res: Response) {
    try {
        const token = req.cookies?.[REFRESH_TOKEN_COOKIE];

        if (token) {
            await service.logout(token);
        }

        res.clearCookie(REFRESH_TOKEN_COOKIE);

        return res.json({ message: "Logged out" });
    } catch {
        return res.json({ message: "Logged out" });
    }
}
