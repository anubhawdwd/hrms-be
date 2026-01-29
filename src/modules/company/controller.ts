// src/modules/company/controller.ts

import type { Request, Response } from "express";
import { CompanyService } from "./service.js";

const service = new CompanyService();

export async function createCompany(req: Request, res: Response) {
    try {
        const { name } = req.body;

        const company = await service.createCompany({ name });

        res.status(201).json(company);
    } catch (err: any) {
        res.status(400).json({ message: err.message });
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
