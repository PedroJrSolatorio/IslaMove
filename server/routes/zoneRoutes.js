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

router.get("/lookup", lookupZoneByCoordinates);

// All routes require authentication
// This line means: all routes defined after this line will automatically use the adminAuth middleware.
router.use(adminAuth);

router.post("/", createZone);
router.get("/", getAllZones);
router.get("/barangays", getBarangayZones);
router.get("/:id", getZoneById);
router.get("/:parentId/children", getChildZones);
router.put("/:id", updateZone);
router.delete("/:id", deleteZone);

export default router;
