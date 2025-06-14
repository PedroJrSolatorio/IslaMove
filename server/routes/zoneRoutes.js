import express from "express";
import {
  createZone,
  updateZone,
  deleteZone,
  getZoneById,
  getAllZones,
  getBarangayZones,
  getChildZones,
  lookupZoneByCoordinates,
} from "../controllers/zoneController.js";
import { adminAuth } from "../middleware/adminAuth.js";

const router = express.Router();

// All routes require authentication
// This line means: all routes defined after this line will automatically use the adminAuth middleware.
router.use(adminAuth);

router.post("/zones", createZone);
router.get("/zones", getAllZones);
router.get("/zones/barangays", getBarangayZones);
router.get("/zones/:id", getZoneById);
router.get("/zones/:parentId/children", getChildZones);
router.put("/zones/:id", updateZone);
router.delete("/zones/:id", deleteZone);
router.get("/zones/lookup", lookupZoneByCoordinates);

export default router;
