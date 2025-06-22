import express from "express";
import {
  getAdminStats,
  getDrivers,
  verifyDriver,
  blockDriver,
  unblockDriver,
  sendWarningToDriver,
  verifyDriverDocument,
  getPassengers,
  sendWarningToPassenger,
  blockPassenger,
  unblockPassenger,
  verifyPassengerId,
  getPassengerStats, // optional
} from "../controllers/adminController.js";
import { adminAuth } from "../middleware/adminAuth.js";

const router = express.Router();

// Admin routes - protected with admin auth middleware
router.get("/stats", adminAuth, getAdminStats);

// All routes require authentication
// This line means: all routes defined after this line will automatically use the adminAuth middleware. (i just separate stats route for comparison)
router.use(adminAuth);

// Driver management routes
router.get("/drivers", getDrivers);
router.put("/drivers/:driverId/verify", verifyDriver);
router.put("/drivers/:driverId/block", blockDriver);
router.put("/drivers/:driverId/unblock", unblockDriver);
router.post("/drivers/:driverId/warning", sendWarningToDriver);
router.put(
  "/drivers/:driverId/documents/:documentIndex/verify",
  verifyDriverDocument
);

// Passenger management routes
router.get("/passengers", getPassengers);
router.get("/passengers/stats", getPassengerStats); // optional
router.post("/passengers/:id/warning", sendWarningToPassenger);
router.put("/passengers/:id/block", blockPassenger);
router.put("/passengers/:id/unblock", unblockPassenger);
router.put("/passengers/:id/verify-id", verifyPassengerId);

export default router;
