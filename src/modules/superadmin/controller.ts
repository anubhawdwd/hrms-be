// src/modules/superadmin/controller.ts
import type { Request, Response } from "express";
import { SuperAdminService } from "./service.js";

const service = new SuperAdminService();

export async function createSuperAdmin(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const result = await service.createSuperAdmin({ email, password });
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function listSuperAdmins(req: Request, res: Response) {
  try {
    const list = await service.listSuperAdmins();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

export async function resetSuperAdminPassword(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const { manualPassword } = req.body;

    if (!userId || Array.isArray(userId)) {
      return res.status(400).json({ message: "Invalid userId parameter" });
    }

    const result = await service.resetSuperAdminPassword(userId, manualPassword);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function deactivateSuperAdmin(req: Request, res: Response) {
  try {
    const { userId } = req.params;

    if (!userId || Array.isArray(userId)) {
      return res.status(400).json({ message: "Invalid userId parameter" });
    }

    const result = await service.deactivateSuperAdmin(userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}
