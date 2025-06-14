import express from "express";
import { getAdminStats } from "../controllers/adminController.js";
import { adminAuth } from "../middleware/adminAuth.js";

const router = express.Router();

// Admin routes - protected with admin auth middleware
router.get("/stats", adminAuth, getAdminStats);

export default router;
