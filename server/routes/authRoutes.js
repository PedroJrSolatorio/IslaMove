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
    let uploadDir = profilesDir;
    if (file.fieldname.startsWith("document_")) {
      uploadDir = documentsDir;
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// Setup upload middleware
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Helper function to configure multer upload based on request
const configureUpload = (req, res, next) => {
  const role = req.body.role;

  if (!role) {
    return next(multer().none()); // No files expected
  }

  // For both roles, expect at least a profile image
  const fields = [{ name: "profileImage", maxCount: 1 }];

  // For drivers, add document fields
  if (role === "driver") {
    fields.push(
      { name: "document_License", maxCount: 1 },
      { name: "document_Registration", maxCount: 1 },
      { name: "document_MODA", maxCount: 1 },
      { name: "document_Vehicle", maxCount: 1 }
    );
  }

  return upload.fields(fields)(req, res, next);
};

router.post("/check-user", checkUser);
router.post("/login", loginUser);
router.get("/validate", validateToken);
router.post("/refresh", refreshAuthToken);

// Register route with dynamic file upload handling
router.post("/register", (req, res, next) => {
  // We need to determine the fields to expect, but body isn't parsed yet
  // So we use multer's .none() to parse the form first
  multer().none()(req, res, (err) => {
    if (err) return next(err);
    // Now the req.body is populated and we can check the role
    configureUpload(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res
              .status(413)
              .json({ error: "File too large. Maximum size is 5MB." });
          }
        }
        return next(err);
      }
      registerUser(req, res);
    });
  });
});

export default router;
