import express from "express";
import {
  getDiscountConfig,
  updateDiscountConfig,
  getFarePreview,
  getPassengerDiscount,
} from "../controllers/discountController.js";
import { adminAuth } from "../middleware/adminAuth.js";

const router = express.Router();

router.get("/preview", getFarePreview); // Public endpoint for fare preview
router.get("/passenger/:passengerId", getPassengerDiscount); // Get discount for specific passenger

router.use(adminAuth); // Admin-only endpoints below
router.get("/", getDiscountConfig);
router.put("/", updateDiscountConfig);

export default router;
