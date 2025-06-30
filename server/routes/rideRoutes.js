import express from "express";
import {
  updateRide,
  deleteRide,
  createRideRequest,
  cancelRide,
  acceptRide,
  ratePassenger,
} from "../controllers/rideController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// Passenger routes
router.post("/request", auth, createRideRequest);
router.post("/:id/cancel", auth, cancelRide);

// Driver routes
router.post("/:id/accept", auth, acceptRide);
router.post("/:id/rate-passenger", auth, ratePassenger);

// General routes
router.put("/:id", auth, updateRide);
router.delete("/:id", auth, deleteRide);

export default router;
