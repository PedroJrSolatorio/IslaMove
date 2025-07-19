import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  getUserByEmail,
  getProfileById,
  updateProfile,
  uploadProfileImage,
  getAddresses,
  addNewAddress,
  updateAddresses,
  removeAddress,
  verifyAccountDeletion,
} from "../controllers/userController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// Fix for ES Modules: Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "../uploads/profiles");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

// Public routes
router.get("/:email", getUserByEmail);

// Protected routes - use auth middleware here
router.get("/profile/:id", auth, getProfileById);
router.get("/addresses/:id", auth, getAddresses);
router.post("/addresses/:id", auth, addNewAddress);
router.put("/addresses/:id", auth, updateAddresses);
router.delete("/addresses/:id/:addressIndex", auth, removeAddress);
router.put("/profile/:id", auth, updateProfile);
router.post(
  "/upload-image/:id",
  upload.single("profileImage"),
  auth,
  uploadProfileImage
);
router.post("/verify-deletion/:id", auth, verifyAccountDeletion);

export default router;
