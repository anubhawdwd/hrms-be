import { Router } from "express";
import {
  checkIn,
  checkOut,
  getAttendanceDay,
  getAttendanceRange,
} from "./controller.js";

const router = Router();

router.post("/check-in", checkIn);
router.post("/check-out", checkOut);

router.get("/day", getAttendanceDay);
router.get("/range", getAttendanceRange);

export default router;

