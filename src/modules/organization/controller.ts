import type { Request, Response } from "express";
import { OrganizationService } from "./service.js";

const service = new OrganizationService();

// ---------- Departments ----------

export async function createDepartment(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");
    const { name } = req.body;

    if (!companyId) {
      return res.status(400).json({ message: "x-company-id header missing" });
    }

    const department = await service.createDepartment({
      name,
      companyId,
    });

    res.status(201).json(department);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function listDepartments(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");

    if (!companyId) {
      return res.status(400).json({ message: "x-company-id header missing" });
    }

    const departments = await service.listDepartments(companyId);
    res.json(departments);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function updateDepartment(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");
    const { departmentId } = req.params;
    const { name } = req.body;

    if (!companyId || !departmentId || !name || Array.isArray(departmentId)) {
      return res.status(400).json({ message: "Invalid input" });
    }

    await service.updateDepartment(companyId, departmentId, name);
    res.json({ message: "Department updated" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function deactivateDepartment(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");
    const { departmentId } = req.params;

    if (!companyId || !departmentId || Array.isArray(departmentId)) {
      return res.status(400).json({ message: "Invalid input" });
    }

    await service.deactivateDepartment(companyId, departmentId);
    res.json({ message: "Department deactivated" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

// ---------- Teams ----------

export async function createTeam(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");
    const { name, departmentId } = req.body;

    if (!companyId) {
      return res.status(400).json({ message: "x-company-id header missing" });
    }

    if (!departmentId) {
      return res.status(400).json({ message: "departmentId is required" });
    }

    const team = await service.createTeam({
      name,
      departmentId,
      companyId,
    });

    res.status(201).json(team);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function listTeams(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");
    const { departmentId } = req.query;

    if (!companyId) {
      return res.status(400).json({ message: "x-company-id header missing" });
    }

    if (!departmentId || typeof departmentId !== "string") {
      return res.status(400).json({ message: "departmentId is required" });
    }

    const teams = await service.listTeams(departmentId, companyId);
    res.json(teams);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function updateTeam(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");
    const { teamId } = req.params;
    const { name, departmentId } = req.body;

    if (!companyId || !teamId || Array.isArray(teamId)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    await service.updateTeam(companyId, teamId, { name, departmentId });
    res.json({ message: "Team updated successfully" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function deactivateTeam(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");
    const { teamId } = req.params;

    if (!companyId || !teamId || Array.isArray(teamId)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    await service.deactivateTeam(companyId, teamId);
    res.json({ message: "Team deactivated successfully" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}


// ---------- Designations ----------

export async function createDesignation(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");
    const { name } = req.body;

    if (!companyId) {
      return res.status(400).json({ message: "x-company-id header missing" });
    }

    const designation = await service.createDesignation({
      name,
      companyId,
    });

    res.status(201).json(designation);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function listDesignations(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");
    if (!companyId) {
      return res.status(400).json({ message: "x-company-id header missing" });
    }

    res.json(await service.listDesignations(companyId));
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function updateDesignation(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");
    const { designationId } = req.params;
    const { name } = req.body;

    if (!companyId || !designationId || !name || Array.isArray(designationId)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    await service.updateDesignation(companyId, designationId, name);
    res.json({ message: "Designation updated successfully" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

export async function deactivateDesignation(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");
    const { designationId } = req.params;

    if (!companyId || !designationId || Array.isArray(designationId)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    await service.deactivateDesignation(companyId, designationId);
    res.json({ message: "Designation deactivated successfully" });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}


// ---------- EmployeeProfile ----------
// export async function createEmployee(req: Request, res: Response) {
//   try {
//     const companyId = req.header("x-company-id");

//     if (!companyId) {
//       return res.status(400).json({ message: "x-company-id header missing" });
//     }

//     const {
//       userId,
//       teamId,
//       designationId,
//       firstName,
//       middleName,
//       lastName,
//       displayName,
//       managerId,
//       joiningDate,
//     } = req.body;

//     if (!userId || !teamId || !designationId || !firstName || !lastName || !joiningDate) {
//       return res.status(400).json({ message: "Missing required fields" });
//     }

//     const employee = await service.createEmployeeProfile({
//       userId,
//       companyId,
//       teamId,
//       designationId,
//       firstName,
//       middleName,
//       lastName,
//       displayName,
//       managerId,
//       joiningDate,
//     });

//     res.status(201).json(employee);
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }

// export async function updateEmployee(req: Request, res: Response) {
//   try {
//     const companyId = req.header("x-company-id");
//     const { employeeId } = req.params;

//     if (!companyId || !employeeId || Array.isArray(employeeId)) {
//       return res.status(400).json({ message: "Invalid request" });
//     }

//     await service.updateEmployee(employeeId, companyId, req.body);
//     res.json({ message: "Employee updated successfully" });
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }

// export async function deactivateEmployee(req: Request, res: Response) {
//   try {
//     const companyId = req.header("x-company-id");
//     const { employeeId } = req.params;

//     if (!companyId || !employeeId || Array.isArray(employeeId)) {
//       return res.status(400).json({ message: "Invalid request" });
//     }

//     await service.deactivateEmployee(employeeId, companyId);
//     res.json({ message: "Employee deactivated successfully" });
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }


// export async function listEmployees(req: Request, res: Response) {
//   try {
//     const companyId = req.header("x-company-id");

//     if (!companyId) {
//       return res.status(400).json({ message: "x-company-id header missing" });
//     }

//     const employees = await service.listEmployees(companyId);
//     res.json(employees);
//   } catch (err: any) {
//     res.status(400).json({ message: err.message });
//   }
// }

// Set Office Location
export async function setOfficeLocation(req: Request, res: Response) {
  try {
    const companyId = req.header("x-company-id");
    const { latitude, longitude, radiusM } = req.body;

    if (
      !companyId ||
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      typeof radiusM !== "number"
    ) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const result = await service.setOfficeLocation(
      companyId,
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
    const companyId = req.header("x-company-id");
    if (!companyId) {
      return res.status(400).json({ message: "Missing companyId" });
    }

    const result = await service.getOfficeLocation(companyId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}

// ---------- Designation Attendance Policy ----------
export async function upsertDesignationAttendancePolicy(
  req: Request,
  res: Response
) {
  try {
    const companyId = req.header("x-company-id");
    if (!companyId) {
      return res.status(400).json({ message: "x-company-id missing" });
    }

    const { designationId, autoPresent, attendanceExempt } = req.body;

    if (
      !designationId ||
      typeof autoPresent !== "boolean" ||
      typeof attendanceExempt !== "boolean"
    ) {
      return res.status(400).json({ message: "Invalid input" });
    }

    const result =
      await service.upsertDesignationAttendancePolicy(
        { designationId, autoPresent, attendanceExempt },
        companyId
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
    const companyId = req.header("x-company-id");
    if (!companyId) {
      return res.status(400).json({ message: "x-company-id missing" });
    }

    res.json(
      await service.listDesignationAttendancePolicies(companyId)
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
    const companyId = req.header("x-company-id");
    const { designationId } = req.params;

    if (!companyId || !designationId || Array.isArray(designationId)) {
      return res.status(400).json({ message: "Invalid request" });
    }

    res.json(
      await service.getDesignationAttendancePolicy(
        companyId,
        designationId
      )
    );
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
}
