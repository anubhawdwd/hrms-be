// src/modules/employee/controller.ts

import type { Request, Response } from "express";
import { EmployeeService } from "./service.js";

const service = new EmployeeService();

export async function createEmployee(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");
    if (!companyId) {
      return res.status(400).json({ message: "Missing x-company-id" });
    }

    const employee = await service.createEmployee({
      ...req.body,
      companyId,
    });

    res.status(201).json(employee);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function listEmployees(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");
    if (!companyId) {
      return res.status(400).json({ message: "Missing x-company-id" });
    }

    const employees = await service.listEmployees(companyId);
    res.json(employees);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function getEmployeeById(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");
    const { employeeId } = req.params;

    if (!companyId || !employeeId || Array.isArray(employeeId)) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const employee = await service.getEmployeeById(employeeId, companyId);
    res.json(employee);
  } catch (err: any) {
    res.status(404).json({ message: err.message });
  }
}

// export async function updateEmployee(req: Request, res: Response) {
//   try {
//     const companyId = req.header("x-company-id");
//     const { employeeId } = req.params;

//     if (!companyId || !employeeId || Array.isArray(employeeId)) {
//       return res.status(400).json({ message: "Invalid input" });
//     }

//     const employee = await service.updateEmployee(
//       employeeId,
//       companyId,
//       req.body
//     );

//     res.json(employee);
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }

export async function updateMyProfile(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");
    const { employeeId } = req.params;
    if (!companyId || !employeeId || Array.isArray(employeeId)) {
      return res.status(400).json({ message: "Invalid input" });
    }
    const result = await service.updateMyProfile(employeeId, companyId, req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function updateEmployeeAdmin(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");
    const { employeeId } = req.params;
    if (!companyId || !employeeId || Array.isArray(employeeId)) {
      return res.status(400).json({ message: "Invalid input" });
    }
    const result = await service.updateEmployeeAdmin(employeeId, companyId, req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function deactivateEmployee(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");
    const { employeeId } = req.params;

    if (!companyId || !employeeId || Array.isArray(employeeId)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    const employee = await service.deactivateEmployee(employeeId, companyId);

    res.json(employee);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function changeManager(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");
    const { employeeId } = req.params;
    const { managerId } = req.body;

    if (!companyId || !employeeId || Array.isArray(employeeId)) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const employee = await service.changeManager({
      employeeId,
      companyId,
      managerId,
    });

    res.json(employee);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}
