import express from "express";
import { getPricing, lookup } from "../controllers/zoneController.js";

const router = express.Router();

router.get("/pricing", getPricing);
router.get("/lookup", lookup);

export default router;
