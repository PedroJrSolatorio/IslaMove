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

// PUBLIC ROUTES (no authentication required)
router.get("/route", getPricingForRoute);

// PROTECTED ROUTES (authentication required)
// This line means: all routes defined after this line will automatically use the adminAuth middleware.
router.use(adminAuth);

router.post("/", createPricing);
router.get("/", getAllPricing);
router.put("/:id", updatePricing);
router.delete("/:id", deletePricing);

export default router;
