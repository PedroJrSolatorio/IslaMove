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
  linkGoogleAccount,
  unlinkGoogleAccount,
  setPassword,
  logoutUser,
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
router.post("/complete-google-registration", uploadFields, (req, res) => {
  // Multer errors will be caught by the global error handler
  completeGoogleRegistration(req, res);
});
router.post("/register", uploadFields, (req, res) => {
  registerUser(req, res);
});
router.post("/link-google", linkGoogleAccount);
router.post("/unlink-google", unlinkGoogleAccount);
router.post("/set-password", setPassword);
router.post("/logout", logoutUser);

export default router;
