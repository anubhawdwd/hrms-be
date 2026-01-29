// src/modules/user/controller.ts

import type { Request, Response } from "express";
import { UserService } from "./service.js";
import { AuthProvider } from "../../generated/prisma/enums.js";

const service = new UserService();

export async function createUser(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");
    const { email, authProvider } = req.body;

    if (!companyId) {
      return res.status(400).json({ message: "Missing x-company-id header" });
    }

    const user = await service.createUser({
      companyId,
      email,
      authProvider,
    });

    res.status(201).json(user);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function listUsers(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");

    if (!companyId) {
      return res.status(400).json({ message: "Missing x-company-id header" });
    }

    const users = await service.listUsers({ companyId });

    res.json(users);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}
