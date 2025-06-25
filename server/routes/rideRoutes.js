import express from "express";
import {
  updateRide,
  deleteRide,
  createRideRequest,
} from "../controllers/rideController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.post("/request", auth, createRideRequest);
router.put("/:id", auth, updateRide);
router.delete("/:id", auth, deleteRide);

export default router;
