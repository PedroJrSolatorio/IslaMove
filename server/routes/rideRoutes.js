import express from "express";
import {
  updateRide,
  deleteRide,
  createRideRequest,
  cancelRide,
} from "../controllers/rideController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.post("/request", auth, createRideRequest);
router.post("/:id/cancel", auth, cancelRide);
router.put("/:id", auth, updateRide);
router.delete("/:id", auth, deleteRide);

export default router;
