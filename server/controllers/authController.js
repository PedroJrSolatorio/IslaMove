import User from "../models/User.js"; // Add .js extension for ES Modules
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

    // Default assumptions
    let isGoogleUserCompleting = false;
    let googleUserId = null;

    // Decode token if available
    const tempToken = req.headers.authorization?.split(" ")[1];
    if (tempToken) {
      try {
        const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
        if (decoded?.isTemp && decoded?.email) {
          isGoogleUserCompleting = true;
          googleUserId = decoded.sub || decoded.id || decoded._id;
        }
      } catch (err) {
        console.warn("JWT decode failed:", err.message);
        // Proceed as non-Google user
      }
    }

    // Build conflict check query
    const conflictQuery = {
      $or: [
        email ? { email } : null,
        phone ? { phone } : null,
        username ? { username } : null,
      ].filter(Boolean),
    };

    const existingUsers = await User.find(conflictQuery);

    for (const user of existingUsers) {
      const isSelf =
        isGoogleUserCompleting && user._id.toString() === googleUserId;

      if (!isSelf) {
        if (user.email === email) {
          return res.status(409).json({
            message: "This email address is already registered",
            field: "email",
          });
        }
        if (user.username === username) {
          return res.status(409).json({
            message: "This username is already taken",
            field: "username",
          });
        }
        if (user.phone === phone) {
          return res.status(409).json({
            message: "This phone number is already registered",
            field: "phone",
          });
        }
      }
    }

    return res.status(200).json({
      message: "User details are available",
      available: true,
    });
  } catch (error) {
    console.error("Error checking user:", error);
    return res.status(500).json({
      message: "Server error while checking user details",
    });
  }
};

// Register a new user
export const registerUser = async (req, res) => {
  // Array to store paths of files uploaded during this request. These will be deleted if any error occurs.
  const uploadedFilePaths = [];
  try {
    let {
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

    // temporary fix for password as array
    if (Array.isArray(password)) {
      password = password[0]; // Take the first password from the array
    }

    // Get the base URL for file paths
    const baseUrl =
      process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;

    // Parse nested JSON strings
    let vehicle = req.body.vehicle
      ? typeof req.body.vehicle === "string"
        ? JSON.parse(req.body.vehicle)
        : req.body.vehicle
      : null;
    let parsedHomeAddress = homeAddress
      ? typeof homeAddress === "string"
        ? JSON.parse(homeAddress)
        : homeAddress
      : null;
    let idDocument = req.body.idDocument
      ? typeof req.body.idDocument === "string"
        ? JSON.parse(req.body.idDocument)
        : req.body.idDocument
      : null;

    // --- Pre-database Validations ---
    // Use 'throw new Error' to ensure errors jump to the catch block for file cleanup.
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
      throw new Error("All required fields must be provided.");
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
        throw new Error("Complete home address is required for drivers.");
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
        throw new Error(
          "Complete vehicle information is required for drivers."
        );
      }

      // Validate vehicle type
      if (vehicle.type !== "bao-bao") {
        throw new Error("Invalid vehicle type. Only 'bao-bao' is allowed.");
      }
    } else if (role === "passenger") {
      if (
        !passengerCategory ||
        !["regular", "student", "senior"].includes(passengerCategory)
      ) {
        throw new Error("Valid passenger category is required for passengers.");
      }
      if (
        !parsedHomeAddress ||
        !parsedHomeAddress.street ||
        !parsedHomeAddress.city ||
        !parsedHomeAddress.state ||
        !parsedHomeAddress.zipCode
      ) {
        throw new Error("Complete home address is required for passengers.");
      }
    }

    // Check if email, username, or phone already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }, { phone }],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new Error("Email already registered.");
      }
      if (existingUser.username === username) {
        throw new Error("Username already taken.");
      }
      if (existingUser.phone === phone) {
        throw new Error("Phone number already registered.");
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
      isGoogleUser: false, // Explicitly set for non-Google registrations
      isProfileComplete: true, // Assuming non-Google registration means full profile immediately
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
      uploadedFilePaths.push(profileImageFile.path); // Store path for cleanup
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
        uploadedFilePaths.push(idDocumentFile.path);
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
          uploadedFilePaths.push(docFile.path);
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
        uploadedFilePaths.push(idDocumentFile.path);
        userData.idDocument = {
          type: idDocument.type,
          imageUrl: `${baseUrl}/uploads/documents/${idDocumentFile.filename}`,
          uploadedAt: new Date(),
          verified: false,
        };
      }
    }

    // Create the user in the database. If this fails, the catch block will run.
    const newUser = await User.create(userData);

    // If reached here, the user was successfully created, so we don't want to delete the files.
    // Clear the array to prevent cleanup in the catch block for successful operations.
    uploadedFilePaths.length = 0;

    // Remove password from response
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      message: "User registered successfully",
      user: userResponse,
    });
  } catch (error) {
    console.error("Registration error:", error);

    // --- IMPORTANT: Clean up uploaded files if an error occurred ---
    for (const filePath of uploadedFilePaths) {
      try {
        await fs.promises.unlink(filePath);
        console.log(`Successfully deleted uploaded file: ${filePath}`);
      } catch (fileError) {
        console.error(`Failed to delete file ${filePath}:`, fileError);
        // Log the error but continue to delete other files
      }
    }
    // --- END Cleanup ---

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

    // Handle custom thrown errors (e.g., from validation checks)
    if (
      error.message.includes("required") ||
      error.message.includes("Invalid")
    ) {
      return res.status(400).json({ error: error.message });
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

export const googleSignup = async (req, res) => {
  try {
    const { idToken, role } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: "ID token is required" });
    }

    // Verify Google ID token directly with Google
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      return res.status(401).json({ message: "Invalid Google token" });
    }

    const googleId = payload["sub"];

    // Check if user already exists
    let existingUser = await User.findOne({
      $or: [{ email: payload.email }, { googleId: googleId }],
    });

    if (existingUser) {
      // If user exists, log them in instead of trying to sign them up again
      // This is crucial for preventing duplicate accounts and for a smooth UX
      // (Similar to your googleLogin logic)
      const token = jwt.sign(
        {
          userId: existingUser._id,
          role: existingUser.role,
          isProfileComplete: existingUser.isProfileComplete,
          isTemp: true,
          email: user.email,
        },
        process.env.JWT_SECRET,
        { expiresIn: "24h" }
      );
      const refreshToken = jwt.sign(
        { userId: existingUser._id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: "7d" }
      );

      console.log(
        `Existing Google user (${existingUser.email}) found. Logging in.`
      );
      return res.status(200).json({
        message: "Logged in successfully with existing Google account",
        token,
        refreshToken,
        userId: existingUser._id,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        username: existingUser.username,
        isProfileComplete: existingUser.isProfileComplete,
        email: existingUser.email,
      });
    }

    // --- NEW LOGIC: Auto-generate a unique username for new Google users ---
    let generatedUsername;
    let counter = 0;
    let isUnique = false;
    const emailPrefix = payload.email
      .split("@")[0]
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 15); // Max 15 chars from email

    while (!isUnique) {
      const baseUsername = `${emailPrefix}_g_${Math.random()
        .toString(36)
        .substring(2, 8)}`;
      const testUsername =
        counter > 0 ? `${baseUsername}_${counter}` : baseUsername;
      const userWithSameUsername = await User.findOne({
        username: testUsername,
      });
      if (!userWithSameUsername) {
        generatedUsername = testUsername;
        isUnique = true;
      } else {
        counter++;
        if (counter > 100) {
          // Safety break
          console.error(
            "Failed to generate a unique username after many attempts."
          );
          return res
            .status(500)
            .json({ error: "Failed to generate unique username." });
        }
      }
    }
    console.log(
      `Auto-generated username for new Google signup: ${generatedUsername}`
    );
    // --- END NEW LOGIC ---

    // Create new user with Google info (minimal required fields only)
    const user = await User.create({
      email: payload.email,
      firstName: payload.given_name || payload.name.split(" ")[0],
      lastName:
        payload.family_name || payload.name.split(" ").slice(1).join(" "),
      googleId: googleId,
      role: role || "passenger",
      profileImage: payload.picture || "",
      isGoogleUser: true,
      isProfileComplete: false, // This will be the default for Google users
      homeAddress: {},
      username: generatedUsername,
      ...(role === "driver" && {
        documents: [],
      }),
      ...(role === "passenger" && {
        savedAddresses: [],
      }),
    });

    // Generate app-specific tokens
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        isProfileComplete: user.isProfileComplete,
        isTemp: true,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );
    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Google signup successful. Please complete your profile.",
      token,
      refreshToken,
      userId: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      isProfileComplete: user.isProfileComplete,
      role: user.role,
      email: user.email,
    });
  } catch (error) {
    console.error("Google signup error:", error);
    if (error.code === 11000) {
      // Handle duplicate email if for some reason it wasn't caught by findOne first
      return res.status(409).json({
        message: "Account with this email or Google ID already exists.",
      });
    }
    res.status(500).json({ message: "Failed to sign up with Google." });
  }
};

export const completeGoogleRegistration = async (req, res) => {
  const uploadedFilePaths = []; // Array to store paths for cleanup
  try {
    // 1. Verify temp JWT from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("No valid token provided.");
    }

    const tempToken = authHeader.split(" ")[1];
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);

    if (!decoded.isTemp || !decoded.email) {
      throw new Error("Invalid or expired token.");
    }

    // 2. Find the Google user
    const existingUser = await User.findOne({
      _id: decoded.userId,
      isGoogleUser: true,
      isProfileComplete: false,
    });

    if (!existingUser) {
      throw new Error(
        "Google user not found or already completed registration."
      );
    }

    // 3. Parse and validate inputs
    const {
      lastName,
      firstName,
      middleInitial,
      birthdate,
      age,
      phone,
      role,
      licenseNumber,
      passengerCategory,
      homeAddress,
      vehicle,
      idDocument,
    } = req.body;

    // Required fields check
    if (!lastName || !firstName || !birthdate || !age || !phone || !role) {
      throw new Error("Missing required fields.");
    }

    const parsedHomeAddress =
      typeof homeAddress === "string" ? JSON.parse(homeAddress) : homeAddress;

    const parsedVehicle =
      typeof vehicle === "string" ? JSON.parse(vehicle) : vehicle;

    const parsedIdDoc =
      typeof idDocument === "string" ? JSON.parse(idDocument) : idDocument;

    // 4. Phone conflict check
    const phoneConflict = await User.findOne({
      phone,
      _id: { $ne: existingUser._id },
    });
    if (phoneConflict) {
      throw new Error("Phone number already registered.");
    }

    // 5. Update common fields
    existingUser.lastName = lastName;
    existingUser.firstName = firstName;
    existingUser.middleInitial = middleInitial;
    existingUser.birthdate = new Date(birthdate);
    existingUser.age = parseInt(age);
    existingUser.phone = phone;
    existingUser.role = role;

    if (parsedHomeAddress) {
      existingUser.homeAddress = {
        street: parsedHomeAddress.street,
        city: parsedHomeAddress.city,
        state: parsedHomeAddress.state,
        zipCode: parsedHomeAddress.zipCode,
      };
    }

    // 6. Role-specific fields
    if (role === "driver") {
      if (!licenseNumber || !parsedVehicle) {
        throw new Error("Driver license/vehicle required.");
      }

      if (parsedVehicle.type !== "bao-bao") {
        throw new Error("Only 'bao-bao' vehicles allowed.");
      }

      existingUser.licenseNumber = licenseNumber;
      existingUser.vehicle = {
        make: parsedVehicle.make,
        series: parsedVehicle.series,
        yearModel: parseInt(parsedVehicle.yearModel),
        color: parsedVehicle.color,
        type: parsedVehicle.type,
        plateNumber: parsedVehicle.plateNumber,
        bodyNumber: parsedVehicle.bodyNumber,
      };
      existingUser.driverStatus = "offline";
      existingUser.isVerified = false;
      existingUser.verificationStatus = "pending";
    } else if (role === "passenger") {
      if (
        !passengerCategory ||
        !["regular", "student", "senior"].includes(passengerCategory)
      ) {
        throw new Error("Invalid passenger category.");
      }
      existingUser.passengerCategory = passengerCategory;
      existingUser.savedAddresses = [];
    }

    // 7. Handle file uploads
    const baseUrl =
      process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;

    if (req.files?.profileImage?.[0]) {
      uploadedFilePaths.push(req.files.profileImage[0].path); // Store path
      existingUser.profileImage = `${baseUrl}/uploads/profiles/${req.files.profileImage[0].filename}`;
    }

    if (req.files?.idDocumentImage?.[0]) {
      uploadedFilePaths.push(req.files.idDocumentImage[0].path); // Store path
      existingUser.idDocument = {
        type: parsedIdDoc?.type || "",
        imageUrl: `${baseUrl}/uploads/documents/${req.files.idDocumentImage[0].filename}`,
        uploadedAt: new Date(),
        verified: false,
      };
    }

    if (role === "driver") {
      const docTypes = [
        "Official Receipt (OR)",
        "Certificate of Registration (CR)",
        "MODA Certificate",
        "Vehicle Photo",
      ];
      existingUser.documents = [];

      docTypes.forEach((docType) => {
        const field = `document_${docType.replace(/\s+/g, "")}`;
        if (req.files?.[field]?.[0]) {
          uploadedFilePaths.push(req.files[field][0].path); // Store path
          existingUser.documents.push({
            documentType: docType,
            fileURL: `${baseUrl}/uploads/documents/${req.files[field][0].filename}`,
            verified: false,
            uploadDate: new Date(),
          });
        }
      });
    }

    // 8. Finalize profile
    existingUser.isProfileComplete = true;

    // Save the updated user. If this fails, the catch block will run.
    await existingUser.save();

    // If reached here, the user was successfully updated, so clear the paths.
    uploadedFilePaths.length = 0;

    // 9. Issue new token (not a temp token anymore)
    const fullToken = jwt.sign(
      {
        userId: existingUser._id,
        email: existingUser.email,
        role: existingUser.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).json({
      message: "Google registration completed successfully",
      token: fullToken,
      user: {
        id: existingUser._id,
        email: existingUser.email,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        role: existingUser.role,
        isProfileComplete: existingUser.isProfileComplete,
        verificationStatus: existingUser.verificationStatus,
      },
    });
  } catch (error) {
    console.error("Error completing Google registration:", error);

    // --- IMPORTANT: Clean up uploaded files if an error occurred ---
    for (const filePath of uploadedFilePaths) {
      try {
        await fs.promises.unlink(filePath);
        console.log(`Successfully deleted uploaded file: ${filePath}`);
      } catch (fileError) {
        console.error(`Failed to delete file ${filePath}:`, fileError);
        // Log the error but continue to delete other files
      }
    }
    // --- END Cleanup ---

    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: Object.values(error.errors)
          .map((e) => e.message)
          .join(", "),
      });
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        error: `${
          field.charAt(0).toUpperCase() + field.slice(1)
        } already exists`,
      });
    }
    // Handle custom thrown errors (e.g., from validation checks)
    if (
      error.message.includes("required") ||
      error.message.includes("Invalid") ||
      error.message.includes("token")
    ) {
      return res.status(400).json({ error: error.message });
    }
    return res
      .status(500)
      .json({ error: "Server error during Google registration" });
  }
};

export const googleLogin = async (req, res) => {
  try {
    const { idToken, email, name, photo } = req.body;

    // Verify Google ID token directly with Google
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleId = payload["sub"];

    // Verify the token is valid
    if (!payload) {
      return res.status(401).json({ message: "Invalid Google token" });
    }

    // Find or create user in your database
    let user = await User.findOne({
      $or: [{ email: payload.email }, { googleId: googleId }],
    });

    if (!user) {
      user = await User.create({
        email: payload.email,
        firstName: payload.given_name || payload.name.split(" ")[0],
        lastName:
          payload.family_name || payload.name.split(" ").slice(1).join(" "),
        googleId: googleId,
        role: "passenger", // Default role or determine based on your logic
        profileImage: payload.picture || "",
        isGoogleUser: true,
        isProfileComplete: false,
        homeAddress: {},
      });
      console.log("New Google user created during login:", user._id);
    } else {
      console.log("Existing Google user found during login:", user._id);
      // Optional: Update user's Google photo if it changed, or other Google-provided info
      if (payload.picture && user.profileImage !== payload.picture) {
        user.profileImage = payload.picture;
        await user.save(); // Save the update
      }
    }

    // Generate your app's JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        isProfileComplete: user.isProfileComplete,
        isTemp: true,
        email: user.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    const refreshToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      refreshToken,
      userId: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      isProfileComplete: user.isProfileComplete,
      email: user.email,
    });
  } catch (error) {
    console.error("Google login error:", error);
    res.status(401).json({ message: "Google authentication failed" });
  }
};
