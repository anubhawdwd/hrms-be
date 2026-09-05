// src/modules/user/controller.ts
import type { Request, Response } from "express";
import { UserService } from "./service.js";

const service = new UserService();

export async function createUser(req: Request, res: Response) {
  try {
    const { email, authProvider, role } = req.body;

    const user = await service.createUser({
      companyId: req.companyId!,
      email,
      authProvider,
      role,
    });

    res.status(201).json(user);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function listUsers(req: Request, res: Response) {
  try {
    const users = await service.listUsers({ companyId: req.companyId! });
    res.json(users);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function updateUserEmail(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const { email } = req.body;

    if (!userId || Array.isArray(userId)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    const result = await service.updateUserEmail({
      userId,
      companyId: req.companyId!,
      actorUserId: req.user?.userId,
      email,
    });
    res.json(result);
  } catch (err: any) {
    const status =
      err.statusCode || (err.message?.includes("already exists") ? 409 : 400);
    res.status(status).json({ message: err.message });
  }
}

export async function updateUser(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const { email, authProvider, role } = req.body;

    if (!userId || Array.isArray(userId)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    const result = await service.updateUser({
      userId,
      companyId: req.companyId!,
      actorUserId: req.user?.userId,
      email,
      authProvider,
      role,
    });
    res.json(result);
  } catch (err: any) {
    const status =
      err.statusCode || (err.message?.includes("already exists") ? 409 : 400);
    res.status(status).json({ message: err.message });
  }
}

export async function resetPassword(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const { manualPassword } = req.body;
    if (!userId || Array.isArray(userId)) {
      return res.status(400).json({ message: "Invalid request" });
    }
    const result = await service.resetPassword({
      userId,
      companyId: req.companyId!,
      manualPassword,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function deactivateUser(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    if (!userId || Array.isArray(userId)) {
      return res.status(400).json({ message: "Invalid request" });
    }
    const result = await service.deactivateUser(userId, req.companyId!);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}