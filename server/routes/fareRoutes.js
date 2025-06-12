import express from "express";
import {
  getFares,
  addFare,
  updateFare,
  deleteFare,
  getFareByZones,
  calculateFare,
} from "../controllers/fareController.js";

const router = express.Router();

router.get("/pricing", getPricing);
router.get("/lookup", lookup);

export default router;
