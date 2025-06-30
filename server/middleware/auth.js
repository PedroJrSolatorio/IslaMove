import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    // console.log("🔑 Auth Header:", authHeader);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("❌ No token or incorrect format:", authHeader);
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    // console.log("🎫 Token:", token);

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // console.log(
    //   "Decoded userId:",
    //   decoded.userId,
    //   "Type:",
    //   typeof decoded.userId
    // );

    // Find user
    const user = await User.findById(decoded.userId).select("-password");
    // console.log("User found in auth with user info:", user);

    if (!user) {
      console.error(
        "User not found for ID:",
        decoded.userId,
        "Token payload:",
        decoded
      );
      return res
        .status(404)
        .json({ message: "User not found in auth const user" });
    }

    // Add user info to request object
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }

    res.status(500).json({ message: "Server error" });
  }
};
