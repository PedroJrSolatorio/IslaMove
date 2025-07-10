import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  registerUser,
  loginUser,
  validateToken,
  refreshAuthToken,
  checkUser,
  googleSignup,
  completeGoogleRegistration,
  googleLogin,
} from "../controllers/authController.js";

const router = express.Router();

// Fix for ES Modules: Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directories if they don't exist
const profilesDir = path.join(__dirname, "../uploads/profiles");
const documentsDir = path.join(__dirname, "../uploads/documents");

if (!fs.existsSync(profilesDir)) {
  fs.mkdirSync(profilesDir, { recursive: true });
}

if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Determine appropriate folder based on fieldname
    let uploadDir = documentsDir; // Default to documents for most files
    if (file.fieldname === "profileImage") {
      uploadDir = profilesDir;
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// Setup upload middleware with all possible fields
const upload = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
});

// Define all possible upload fields
const uploadFields = upload.fields([
  { name: "profileImage", maxCount: 1 },
  { name: "idDocumentImage", maxCount: 1 },
  { name: "document_OfficialReceipt(OR)", maxCount: 1 },
  { name: "document_CertificateofRegistration(CR)", maxCount: 1 },
  { name: "document_MODACertificate", maxCount: 1 },
  { name: "document_VehiclePhoto", maxCount: 1 },
]);

router.post("/check-user", checkUser);
router.post("/login", loginUser);
router.get("/validate", validateToken);
router.post("/refresh", refreshAuthToken);
router.post("/google-signup", googleSignup);
router.post("/google-login", googleLogin);

router.post("/complete-google-registration", uploadFields, (req, res, next) => {
  // Optional: Add specific Multer error handling for this route if needed
  // This ensures Multer errors are caught before reaching your controller logic
  if (req.multerError) {
    // Assuming you set a custom error property in multerConfig if needed
    console.error(
      "Multer error on complete-google-registration:",
      req.multerError
    );
    return res.status(400).json({ error: req.multerError.message });
  }
  completeGoogleRegistration(req, res);
});

// Register route with proper file upload handling
router.post("/register", (req, res, next) => {
  uploadFields(req, res, (err) => {
    if (err) {
      console.error("Multer error:", err);
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res
            .status(413)
            .json({ error: "File too large. Maximum size is 15MB." });
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return res
            .status(400)
            .json({ error: `Unexpected file field: ${err.field}` });
        }
      }
      return res.status(500).json({ error: "File upload error" });
    }
    registerUser(req, res);
  });
});

export default router;
