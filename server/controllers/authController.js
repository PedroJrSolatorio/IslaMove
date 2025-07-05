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
      lastName,
      firstName,
      middleInitial,
      birthdate,
      age,
      username,
      email,
      phone,
      password,
      role,
      licenseNumber,
      homeAddress,
      passengerCategory,
    } = req.body;

    // Get the base URL for file paths
    const baseUrl =
      process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;

    // Parse vehicle data if provided
    let vehicle = null;
    if (req.body.vehicle) {
      if (typeof req.body.vehicle === "string") {
        vehicle = JSON.parse(req.body.vehicle);
      } else {
        vehicle = req.body.vehicle;
      }
    }

    // Parse homeAddress if provided as string
    let parsedHomeAddress = null;
    if (homeAddress) {
      if (typeof homeAddress === "string") {
        parsedHomeAddress = JSON.parse(homeAddress);
      } else {
        parsedHomeAddress = homeAddress;
      }
    }

    // Parse idDocument if provided
    let idDocument = null;
    if (req.body.idDocument) {
      if (typeof req.body.idDocument === "string") {
        idDocument = JSON.parse(req.body.idDocument);
      } else {
        idDocument = req.body.idDocument;
      }
    }

    // Check required fields for all users
    if (
      !lastName ||
      !firstName ||
      !middleInitial ||
      !birthdate ||
      !age ||
      !username ||
      !email ||
      !phone ||
      !password ||
      !role
    ) {
      console.error("🚨 Missing required fields:", req.body);
      return res
        .status(400)
        .json({ error: "All required fields must be provided" });
    }

    // Role-specific validation
    if (role === "driver") {
      if (!licenseNumber) {
        return res.status(400).json({
          error: "License number is required for drivers",
        });
      }

      if (
        !parsedHomeAddress ||
        !parsedHomeAddress.street ||
        !parsedHomeAddress.city ||
        !parsedHomeAddress.state ||
        !parsedHomeAddress.zipCode
      ) {
        return res.status(400).json({
          error: "Complete home address is required for drivers",
        });
      }

      if (
        !vehicle ||
        !vehicle.make ||
        !vehicle.series ||
        !vehicle.yearModel ||
        !vehicle.color ||
        !vehicle.type ||
        !vehicle.plateNumber ||
        !vehicle.bodyNumber
      ) {
        return res.status(400).json({
          error: "Complete vehicle information is required for drivers",
        });
      }

      // Validate vehicle type
      if (vehicle.type !== "bao-bao") {
        return res.status(400).json({
          error: "Invalid vehicle type. Only 'bao-bao' is allowed",
        });
      }
    }

    if (role === "passenger") {
      if (
        !passengerCategory ||
        !["regular", "student", "senior"].includes(passengerCategory)
      ) {
        return res.status(400).json({
          error: "Valid passenger category is required for passengers",
        });
      }

      if (
        !parsedHomeAddress ||
        !parsedHomeAddress.street ||
        !parsedHomeAddress.city ||
        !parsedHomeAddress.state ||
        !parsedHomeAddress.zipCode
      ) {
        return res.status(400).json({
          error: "Complete home address is required for passengers",
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

    // Create base user object
    const userData = {
      lastName,
      firstName,
      middleInitial,
      birthdate: new Date(birthdate),
      age: parseInt(age),
      username,
      email,
      phone,
      password: hashedPassword,
      role,
    };

    // Add home address for drivers and passengers (not admin)
    if (role !== "admin" && parsedHomeAddress) {
      userData.homeAddress = {
        street: parsedHomeAddress.street,
        city: parsedHomeAddress.city,
        state: parsedHomeAddress.state,
        zipCode: parsedHomeAddress.zipCode,
        // coordinates can be added later when implementing geocoding
      };
    }

    // Process profile image if provided
    if (req.files && req.files.profileImage) {
      const profileImageFile = req.files.profileImage[0];
      userData.profileImage = `${baseUrl}/uploads/profiles/${profileImageFile.filename}`;
    }

    // Add role-specific fields
    if (role === "driver") {
      userData.licenseNumber = licenseNumber;
      userData.vehicle = {
        make: vehicle.make,
        series: vehicle.series,
        yearModel: parseInt(vehicle.yearModel),
        color: vehicle.color,
        type: vehicle.type,
        plateNumber: vehicle.plateNumber,
        bodyNumber: vehicle.bodyNumber,
      };
      userData.driverStatus = "offline";
      userData.isVerified = false;
      userData.verificationStatus = "pending";

      // Handle ID document
      if (idDocument && req.files && req.files.idDocumentImage) {
        const idDocumentFile = req.files.idDocumentImage[0];
        userData.idDocument = {
          type: idDocument.type,
          imageUrl: `${baseUrl}/uploads/documents/${idDocumentFile.filename}`,
          uploadedAt: new Date(),
          verified: false,
        };
      }

      // Handle driver verification documents
      const documentTypes = [
        "Official Receipt (OR)",
        "Certificate of Registration (CR)",
        "MODA Certificate",
        "Vehicle Photo",
      ];
      userData.documents = [];

      documentTypes.forEach((docType) => {
        const fieldName = `document_${docType.replace(/\s+/g, "")}`;
        if (req.files && req.files[fieldName]) {
          const docFile = req.files[fieldName][0];
          userData.documents.push({
            documentType: docType,
            fileURL: `${baseUrl}/uploads/documents/${docFile.filename}`,
            verified: false,
            uploadDate: new Date(),
          });
        }
      });
    } else if (role === "passenger") {
      userData.passengerCategory = passengerCategory;
      userData.savedAddresses = [];

      // Handle ID document for passengers too
      if (idDocument && req.files && req.files.idDocumentImage) {
        const idDocumentFile = req.files.idDocumentImage[0];
        userData.idDocument = {
          type: idDocument.type,
          imageUrl: `${baseUrl}/uploads/documents/${idDocumentFile.filename}`,
          uploadedAt: new Date(),
          verified: false,
        };
      }
    }

    // Create the user
    const newUser = await User.create(userData);

    // Remove password from response
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      message: "User registered successfully",
      user: userResponse,
    });
  } catch (error) {
    console.error("Registration error:", error);

    // Send more specific error messages for validation errors
    if (error.name === "ValidationError") {
      const errorMessage = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ");

      return res.status(400).json({ error: errorMessage });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        error: `${
          field.charAt(0).toUpperCase() + field.slice(1)
        } already exists`,
      });
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
      firstName: user.firstName,
      username: user.username,
    });
    console.log(
      `User name: ${user.username}, userId: ${user._id} logged in successfully, token generated`
    );
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
