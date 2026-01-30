import { Router } from "express";
import {
  checkIn,
  checkOut,
  getAttendanceDay,
  getAttendanceRange,
  getAttendanceViolations,
  hrAddAttendanceEvent,
  hrUpdateAttendanceDay,
  hrUpsertAttendanceDay,
  upsertEmployeeAttendanceOverride,
} from "./controller.js";

const router = Router();

router.post("/check-in", checkIn);
router.post("/check-out", checkOut);

router.get("/day", getAttendanceDay);
router.get("/range", getAttendanceRange);

router.get("/violations", getAttendanceViolations);
// -------SpecialProvision-for-DefaultAttendance------
router.post("/employee-override", upsertEmployeeAttendanceOverride);

// 🔑 HR APIs
router.post("/hr/attendance-day", hrUpsertAttendanceDay);
router.post("/hr/attendance-event", hrAddAttendanceEvent);
router.patch("/hr/attendance-day/:attendanceDayId", hrUpdateAttendanceDay);



export default router;

