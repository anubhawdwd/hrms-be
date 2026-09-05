// src/modules/company/controller.ts

import type { Request, Response } from "express";
import { CompanyService } from "./service.js";

const service = new CompanyService();

export async function createCompany(req: Request, res: Response) {
    try {
        const { name, adminEmail, adminPassword } = req.body;

        const company = await service.createCompany({ name, adminEmail, adminPassword });

        res.status(201).json(company);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
}

export async function listCompanies(req: Request, res: Response) {
  try {
    const companies = await service.listCompanies();
    res.json(companies);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}


export async function getCompany(req: Request, res: Response) {
    try {
        const { companyId } = req.params;

        if (!companyId || Array.isArray(companyId)) {
            return res.status(400).json({ message: "Invalid companyId" });
        }

        const company = await service.getCompany(companyId);

        res.json(company);
    } catch (err: any) {
        res.status(404).json({ message: err.message });
    }
}

export async function updateCompany(req: Request, res: Response) {
    try {
        const { companyId } = req.params;

        if (!companyId || Array.isArray(companyId)) {
            return res.status(400).json({ message: "Invalid companyId" });
        }

        const company = await service.updateCompany(companyId, req.body);

        res.json(company);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
    }
}

export async function getCompanyUsers(req: Request, res: Response) {
  try {
    const { companyId } = req.params;
    if (!companyId || Array.isArray(companyId)) {
      return res.status(400).json({ message: "Invalid companyId" });
    }

    const users = await service.getCompanyUsers(companyId);
    res.json(users);
  } catch (err: any) {
    const status = err.message === "Company not found" ? 404 : 400;
    res.status(status).json({ message: err.message });
  }
}

export async function resetCompanyUserPassword(req: Request, res: Response) {
  try {
    const { companyId, userId } = req.params;
    const { manualPassword } = req.body;

    if (!companyId || Array.isArray(companyId) || !userId || Array.isArray(userId)) {
      return res.status(400).json({ message: "Invalid request parameters" });
    }

    const result = await service.resetCompanyUserPassword(companyId, userId, manualPassword);
    res.json(result);
  } catch (err: any) {
    const status = err.message === "User not found in specified company" || err.message === "Company not found" ? 404 : 400;
    res.status(status).json({ message: err.message });
  }
}
