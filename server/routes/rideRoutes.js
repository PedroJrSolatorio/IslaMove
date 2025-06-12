import express from "express";
import { updateRide, deleteRide } from "../controllers/rideController.js";

const router = express.Router();

router.put("/:id", updateRide);
router.delete("/:id", deleteRide);

export default router;
