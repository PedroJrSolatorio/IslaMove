import express from "express";
import {
  updateRide,
  deleteRide,
  createRideRequest,
  cancelRide,
  acceptRide,
  ratePassenger,
  rateDriver,
  getRecentRides,
  getRideHistory,
  addRide,
} from "../controllers/rideController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// Passenger routes
router.get("/recent", auth, getRecentRides);
router.get("/history", auth, getRideHistory);
router.post("/request", auth, createRideRequest);
router.post("/:id/cancel", auth, cancelRide);
router.post("/:id/rate-driver", auth, rateDriver);

// Driver routes
router.post("/:id/accept", auth, acceptRide);
router.post("/:id/rate-passenger", auth, ratePassenger);

// General routes
router.put("/:id", auth, updateRide);
router.post("/increment-totalRides", auth, addRide);
router.delete("/:id", auth, deleteRide);

export default router;
