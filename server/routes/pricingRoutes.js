import express from "express";
import {
  createPricing,
  updatePricing,
  deletePricing,
  getAllPricing,
  getPricingForRoute,
} from "../controllers/pricingController.js";
import { adminAuth } from "../middleware/adminAuth.js";

const router = express.Router();

// All routes require authentication
// This line means: all routes defined after this line will automatically use the adminAuth middleware.
router.use(adminAuth);

router.post("/pricing", createPricing);
router.get("/pricing", getAllPricing);
router.get("/pricing/route", getPricingForRoute);
router.put("/pricing/:id", updatePricing);
router.delete("/pricing/:id", deletePricing);

export default router;
