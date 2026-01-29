import { Router } from "express";
import {
  checkIn,
  checkOut,
  getAttendanceDay,
  getAttendanceRange,
  getAttendanceViolations,
} from "./controller.js";

const router = Router();

router.post("/check-in", checkIn);
router.post("/check-out", checkOut);

router.get("/day", getAttendanceDay);
router.get("/range", getAttendanceRange);

router.get("/violations", getAttendanceViolations);

export default router;

