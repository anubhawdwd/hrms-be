// src/modules/organization/controller.ts
import type { Request, Response } from "express";
import { OrganizationService } from "./service.js";

const service = new OrganizationService();

// =================== DEPARTMENTS ===================

export async function createDepartment(req: Request, res: Response) {
  try {
    const { name } = req.body;
    const department = await service.createDepartment({
      name,
      companyId: req.companyId!,
    });
    res.status(201).json(department);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function listDepartments(req: Request, res: Response) {
  try {
    const departments = await service.listDepartments(req.companyId!);
    res.json(departments);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function updateDepartment(req: Request, res: Response) {
  try {
    const { departmentId } = req.params;
    const { name } = req.body;

    if (!departmentId || !name || Array.isArray(departmentId)) {
      return res.status(400).json({ message: "Invalid input" });
    }

    await service.updateDepartment(req.companyId!, departmentId, name);
    res.json({ message: "Department updated" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function deactivateDepartment(req: Request, res: Response) {
  try {
    const { departmentId } = req.params;

    if (!departmentId || Array.isArray(departmentId)) {
      return res.status(400).json({ message: "Invalid input" });
    }

    await service.deactivateDepartment(req.companyId!, departmentId);
    res.json({ message: "Department deactivated" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

// =================== TEAMS ===================

export async function createTeam(req: Request, res: Response) {
  try {
    const { name, departmentId } = req.body;

    if (!departmentId) {
      return res.status(400).json({ message: "departmentId is required" });
    }

    const team = await service.createTeam({
      name,
      departmentId,
      companyId: req.companyId!,
    });

    res.status(201).json(team);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function listTeams(req: Request, res: Response) {
  try {
    const { departmentId } = req.query;

    if (!departmentId || typeof departmentId !== "string") {
      return res.status(400).json({ message: "departmentId is required" });
    }

    const teams = await service.listTeams(departmentId, req.companyId!);
    res.json(teams);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function updateTeam(req: Request, res: Response) {
  try {
    const { teamId } = req.params;
    const { name, departmentId } = req.body;

    if (!teamId || Array.isArray(teamId)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    await service.updateTeam(req.companyId!, teamId, { name, departmentId });
    res.json({ message: "Team updated successfully" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function deactivateTeam(req: Request, res: Response) {
  try {
    const { teamId } = req.params;

    if (!teamId || Array.isArray(teamId)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    await service.deactivateTeam(req.companyId!, teamId);
    res.json({ message: "Team deactivated successfully" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

// =================== DESIGNATIONS ===================

export async function createDesignation(req: Request, res: Response) {
  try {
    const { name } = req.body;
    const designation = await service.createDesignation({
      name,
      companyId: req.companyId!,
    });
    res.status(201).json(designation);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function listDesignations(req: Request, res: Response) {
  try {
    res.json(await service.listDesignations(req.companyId!));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function updateDesignation(req: Request, res: Response) {
  try {
    const { designationId } = req.params;
    const { name } = req.body;

    if (!designationId || !name || Array.isArray(designationId)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    await service.updateDesignation(req.companyId!, designationId, name);
    res.json({ message: "Designation updated successfully" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function deactivateDesignation(req: Request, res: Response) {
  try {
    const { designationId } = req.params;

    if (!designationId || Array.isArray(designationId)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    await service.deactivateDesignation(req.companyId!, designationId);
    res.json({ message: "Designation deactivated successfully" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

// =================== OFFICE LOCATION ===================

export async function setOfficeLocation(req: Request, res: Response) {
  try {
    const { latitude, longitude, radiusM } = req.body;

    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      typeof radiusM !== "number"
    ) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const result = await service.setOfficeLocation(
      req.companyId!,
      latitude,
      longitude,
      radiusM
    );

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function getOfficeLocation(req: Request, res: Response) {
  try {
    const result = await service.getOfficeLocation(req.companyId!);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

// =================== DESIGNATION ATTENDANCE POLICY ===================

export async function upsertDesignationAttendancePolicy(
  req: Request,
  res: Response
) {
  try {
    const { designationId, autoPresent, attendanceExempt } = req.body;

    if (
      !designationId ||
      typeof autoPresent !== "boolean" ||
      typeof attendanceExempt !== "boolean"
    ) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const result = await service.upsertDesignationAttendancePolicy(
      { designationId, autoPresent, attendanceExempt },
      req.companyId!
    );

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function listDesignationAttendancePolicies(
  req: Request,
  res: Response
) {
  try {
    res.json(
      await service.listDesignationAttendancePolicies(req.companyId!)
    );
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function getDesignationAttendancePolicy(
  req: Request,
  res: Response
) {
  try {
    const { designationId } = req.params;

    if (!designationId || Array.isArray(designationId)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    res.json(
      await service.getDesignationAttendancePolicy(
        req.companyId!,
        designationId
      )
    );
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}
