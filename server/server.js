//use import if using ES Module. Stick with ES Modules since using React Native (modern JavaScript) and Node.js (backend)
import express from "express";
import { createServer } from "http";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";
import path from "path";
import { fileURLToPath } from "url";
import { initializeSocket } from "./socket/socketManager.js";

//use require if not using ES Module
// const express = require("express");
// const dotenv = require("dotenv");
// const cors = require("cors");
// const connectDB = require("./config/db");

dotenv.config();
const app = express();

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.LOCAL_CLIENT_URL,
].filter(Boolean);

const httpServer = createServer(app);

const io = initializeSocket(httpServer);
// The io variable serves as a reference in case needs it later.

// // Socket.IO connection handling
// io.on("connection", (socket) => {
//   console.log("Client connected:", socket.id);

//   // Handle joining ride room
//   socket.on("joinRide", (rideId) => {
//     socket.join(`ride_${rideId}`);
//   });

//   // Handle driver location updates
//   socket.on("updateDriverLocation", (data) => {
//     io.to(`ride_${data.rideId}`).emit("driverLocationUpdated", {
//       location: data.location,
//       rideId: data.rideId,
//     });
//   });

//   // Handle ride status updates
//   socket.on("updateRideStatus", (data) => {
//     io.to(`ride_${data.rideId}`).emit("rideStatusUpdated", data);
//   });

//   socket.on("disconnect", () => {
//     console.log("Client disconnected:", socket.id);
//   });
// });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
// Increase limit to 10mb for large JSON payloads
app.use(express.json({ limit: "10mb" }));
// Add support for URL-encoded bodies with increased limit
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(
  cors({
    origin: allowedOrigins,
    methods: "GET,POST,PUT,DELETE",
    credentials: true,
  })
);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Connect to MongoDB
connectDB();

// Import routes (Use ES Module syntax). ES Module (ESM) – Used in React Native by default (modern standard)
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import rideRoutes from "./routes/rideRoutes.js";
import pricingRoutes from "./routes/pricingRoutes.js";
import zoneRoutes from "./routes/zoneRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import googleApiRoutes from "./routes/googleApiRoutes.js";
import placesRoutes from "./routes/placesRoutes.js";
import discountRoutes from "./routes/discountRoutes.js";
import driverRoutes from "./routes/driverRoutes.js";

// // Import routes using CommonJS. CommonJS (CJS) – Used in Node.js by default (older standard).
// const authRoutes = require("./routes/authRoutes");
// const userRoutes = require("./routes/userRoutes");
// const rideRoutes = require("./routes/rideRoutes");

// Use routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api/zones", zoneRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/google", googleApiRoutes);
app.use("/api/places", placesRoutes);
app.use("/api/discounts", discountRoutes);
app.use("/api/drivers", driverRoutes);

// this will log any unmatched routes so you can confirm if the route path is incorrect
app.use((req, res) => {
  console.log(`🔥 Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ error: "Route not found" });
});

// Error handling middleware
app.use((err, res) => {
  console.error("Server error:", err);
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Payload too large" });
  }
  res.status(500).json({ error: "Internal Server Error" });
});

const PORT = process.env.PORT || 5000;

// app.listen(PORT, "0.0.0.0", () =>
//   console.log(`Server running on port ${PORT}`)
// );

// Change app.listen to httpServer.listen for implementing socket.io
httpServer.listen(PORT, "0.0.0.0", () =>
  console.log(`Server running on port ${PORT}`)
);
