import User from "../models/User.js"; // Add .js extension for ES Modules
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

// Helper function to save a base64 image
const saveBase64Image = (base64Data, folder) => {
  // Extract the MIME type and actual base64 content
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

  if (!matches || matches.length !== 3) {
    throw new Error("Invalid base64 string");
  }

  const type = matches[1];
  const data = matches[2];
  const imageBuffer = Buffer.from(data, "base64");

  // Create directory if it doesn't exist
  const dir = path.join(process.cwd(), "uploads", folder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Generate filename and save the file
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${
    type.split("/")[1]
  }`;
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, imageBuffer);

  // Return the URL for the saved file
  return `/uploads/${folder}/${filename}`;
};

// Check existing user before registering
export const checkUser = async (req, res) => {
  try {
    const { email, phone, username } = req.body;

    // Check email
    if (email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res
          .status(409)
          .json({ error: "Email already registered", field: "email" });
      }
    }

    // Check phone
    if (phone) {
      const phoneExists = await User.findOne({ phone });
      if (phoneExists) {
        return res
          .status(409)
          .json({ error: "Phone already registered", field: "phone" });
      }
    }

    // Check username
    if (username) {
      const usernameExists = await User.findOne({ username });
      if (usernameExists) {
        return res
          .status(409)
          .json({ error: "Username already taken", field: "username" });
      }
    }

    // No conflicts found
    return res.status(200).json({ message: "User information available" });
  } catch (error) {
    console.error("Check user error:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

// Register a new user
export const registerUser = async (req, res) => {
  try {
    const {
      fullName,
      username,
      email,
      phone,
      password,
      role,
      licenseNumber,
      profileImage,
      documents,
    } = req.body;

    // Extract vehicle data
    let vehicle = null;
    if (req.body.vehicle) {
      if (typeof req.body.vehicle === "string") {
        vehicle = JSON.parse(req.body.vehicle);
      } else {
        vehicle = req.body.vehicle;
      }
    }

    // Check required fields
    if (!fullName || !username || !email || !phone || !password || !role) {
      console.error("🚨 Missing fields:", req.body);
      return res.status(400).json({ error: "All fields are required" });
    }

    // If role is "driver", ensure licenseNumber and vehicle info are provided
    if (role === "driver") {
      if (!licenseNumber) {
        return res.status(400).json({
          error: "License number is required for drivers",
        });
      }

      if (
        !vehicle ||
        !vehicle.make ||
        !vehicle.model ||
        !vehicle.year ||
        !vehicle.color ||
        !vehicle.type ||
        !vehicle.plateNumber
      ) {
        return res.status(400).json({
          error: "Complete vehicle information is required for drivers",
        });
      }
    }

    // Check if email, username, or phone already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }, { phone }],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ error: "Email already registered" });
      }
      if (existingUser.username === username) {
        return res.status(400).json({ error: "Username already taken" });
      }
      if (existingUser.phone === phone) {
        return res
          .status(400)
          .json({ error: "Phone number already registered" });
      }
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user object based on role
    const userData = {
      fullName,
      username,
      email,
      phone,
      password: hashedPassword,
      role,
    };

    // Process profile image if provided
    if (profileImage && profileImage.startsWith("data:image")) {
      userData.profileImage = saveBase64Image(profileImage, "profiles");
    } else if (req.file) {
      // If using multer
      userData.profileImage = `/uploads/profiles/${req.file.filename}`;
    }

    // Only add fields for specific role
    if (role === "driver") {
      userData.licenseNumber = licenseNumber;
      userData.vehicle = vehicle;
      userData.driverStatus = "offline";
      userData.isVerified = false;

      // Handle document uploads if they exist
      if (documents) {
        let parsedDocs;
        if (typeof documents === "string") {
          parsedDocs = JSON.parse(documents);
        } else {
          parsedDocs = documents;
        }

        userData.documents = parsedDocs.map((doc) => {
          const result = {
            documentType: doc.documentType,
            verified: false,
            uploadDate: new Date(),
          };

          if (doc.fileURL && doc.fileURL.startsWith("data:image")) {
            result.fileURL = saveBase64Image(doc.fileURL, "documents");
          }

          return result;
        });
      } else {
        userData.documents = [];
      }
    } else if (role === "passenger") {
      userData.savedAddresses = [];
    }

    // Create a new user
    // const newUser = new User(userData);
    // await newUser.save(); // only used when need to modify the instance before saving, but this is unnecessary since there is User.create()
    // await newUser.validate(); // this line is unnecessary because User.create(userData) already validates and saves the user.

    await User.create(userData);

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Registration error:", error);

    // Send more specific error messages for validation errors
    if (error.name === "ValidationError") {
      const errorMessage = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ");

      return res.status(400).json({ error: errorMessage });
    }

    res.status(500).json({ error: "Error registering user" });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user)
      return res.status(401).json({ error: "User not found in loginUser" });

    // Compare hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
      // { expiresIn: "1m" } // For testing purposes, set a shorter expiration time
    );

    // Generate refresh token with longer expiry
    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      refreshToken,
      userId: user._id,
      role: user.role,
      fullName: user.fullName,
      username: user.username,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
};

export const validateToken = async (req, res) => {
  try {
    // Extract token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    console.log("Token received for validation");

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Token verified successfully, user ID:", decoded._id);

    // Find user
    const user = await User.findById(decoded._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log("User found, returning valid response");

    return res.status(200).json({
      message: "Token is valid",
      userId: user._id,
      username: user.username,
      role: user.role,
    });
  } catch (error) {
    console.error("Token validation error:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    return res
      .status(401)
      .json({ message: "Invalid token", error: error.message });
  }
};

export const refreshAuthToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(401).json({ message: "No refresh token provided" });

    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user)
      return res
        .status(404)
        .json({ message: "User not found in refreshAuthToken" });

    // Generate a new access token
    const newToken = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
      // { expiresIn: "1m" }
    );

    // Generate a new refresh token (token rotation for better security)
    const newRefreshToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(403).json({ message: "Invalid or expired refresh token" });
  }
};
