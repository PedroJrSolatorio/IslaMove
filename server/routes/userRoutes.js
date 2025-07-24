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
  uploadSchoolId,
  acknowledgeSeniorEligibility,
  requestCategoryChange,
} from "../controllers/userController.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

// Fix for ES Modules: Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const profilesDir = path.join(__dirname, "../uploads/profiles");
const documentsDir = path.join(__dirname, "../uploads/documents");

if (!fs.existsSync(profilesDir)) {
  fs.mkdirSync(profilesDir, { recursive: true });
}

if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
}

// Configure storage for profile images
const profileStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, profilesDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

// Configure storage for documents (schoolId, supportingDocument, etc.)
const documentStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, documentsDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const uploadProfile = multer({ storage: profileStorage });
const uploadDocument = multer({ storage: documentStorage });

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
  uploadProfile.single("profileImage"),
  auth,
  uploadProfileImage
);
router.post("/verify-deletion/:id", auth, verifyAccountDeletion);
router.post(
  "/upload-school-id/:id",
  uploadDocument.single("schoolId"),
  auth,
  uploadSchoolId
);
router.post(
  "/acknowledge-senior-eligibility/:id",
  auth,
  acknowledgeSeniorEligibility
);
router.post(
  "/change-category/:id",
  uploadDocument.single("supportingDocument"),
  auth,
  requestCategoryChange
);

export default router;
