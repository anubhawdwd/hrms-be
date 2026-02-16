// src/modules/employee/controller.ts
import type { Request, Response } from "express";
import { EmployeeService } from "./service.js";

const service = new EmployeeService();

export async function createEmployee(req: Request, res: Response) {
  try {
    const employee = await service.createEmployee({
      ...req.body,
      companyId: req.companyId!,
    });

    res.status(201).json(employee);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function listEmployees(req: Request, res: Response) {
  try {
    const employees = await service.listEmployees(req.companyId!);
    res.json(employees);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function getEmployeeById(req: Request, res: Response) {
  try {
    const { employeeId } = req.params;

    if (!employeeId || Array.isArray(employeeId)) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const employee = await service.getEmployeeById(
      employeeId,
      req.companyId!
    );
    res.json(employee);
  } catch (err: any) {
    res.status(404).json({ message: err.message });
  }
}

export async function updateMyProfile(req: Request, res: Response) {
  try {
    const result = await service.updateMyProfile(
      req.user!.userId,
      req.companyId!,
      req.body
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function updateEmployeeAdmin(req: Request, res: Response) {
  try {
    const { employeeId } = req.params;
    if (!employeeId || Array.isArray(employeeId)) {
      return res.status(400).json({ message: "Invalid input" });
    }
    const result = await service.updateEmployeeAdmin(
      employeeId,
      req.companyId!,
      req.body
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function deactivateEmployee(req: Request, res: Response) {
  try {
    const { employeeId } = req.params;

    if (!employeeId || Array.isArray(employeeId)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    const employee = await service.deactivateEmployee(
      employeeId,
      req.companyId!
    );
    res.json(employee);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function changeManager(req: Request, res: Response) {
  try {
    const { employeeId } = req.params;
    const { managerId } = req.body;

    if (!employeeId || Array.isArray(employeeId)) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const employee = await service.changeManager({
      employeeId,
      companyId: req.companyId!,
      managerId,
    });

    res.json(employee);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function getMyEmployeeProfile(req: Request, res: Response) {
  try {
    const employee = await service.getEmployeeByUserId(
      req.user!.userId,
      req.companyId!
    );
    res.json(employee);
  } catch (err: any) {
    res.status(404).json({ message: err.message });
  }
}
