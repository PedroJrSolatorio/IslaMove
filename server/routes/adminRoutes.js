import express from "express";
import {
  getAdminStats,
  createZone,
  updateZone,
  deleteZone,
  getZoneById,
  getAllZones,
  getBarangayZones,
  getChildZones,
  lookupZoneByCoordinates,
  createPricing,
  updatePricing,
  deletePricing,
  getAllPricing,
  getPricingForRoute,
} from "../controllers/adminController.js";
import { adminAuth } from "../middleware/adminAuth.js";

const router = express.Router();

// Admin routes - protected with admin auth middleware
router.get("/stats", adminAuth, getAdminStats);

// All routes require authentication
// This line means: all routes defined after this line will automatically use the adminAuth middleware. (that's why /stats doesn't have it)
router.use(adminAuth);

// Zone management routes
router.post("/zones", createZone);
router.get("/zones", getAllZones);
router.get("/zones/barangays", getBarangayZones);
router.get("/zones/:id", getZoneById);
router.get("/zones/:parentId/children", getChildZones);
router.put("/zones/:id", updateZone);
router.delete("/zones/:id", deleteZone);
router.get("/zones/lookup", lookupZoneByCoordinates);

// Pricing management routes
router.post("/pricing", createPricing);
router.get("/pricing", getAllPricing);
router.get("/pricing/route", getPricingForRoute);
router.put("/pricing/:id", updatePricing);
router.delete("/pricing/:id", deletePricing);

export default router;
