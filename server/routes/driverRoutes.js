import express from "express";
import { auth } from "../middleware/auth.js";
import User from "../models/User.js";

const router = express.Router();

// Middleware to ensure user is a driver
const ensureDriver = async (req, res, next) => {
  try {
    if (req.user.role !== "driver") {
      return res
        .status(403)
        .json({ message: "Access denied. Driver role required." });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update driver status (online/offline/busy)
router.post("/status", auth, ensureDriver, async (req, res) => {
  try {
    const { status, location } = req.body;
    const driverId = req.user.id;

    // Validate status
    if (!["available", "busy", "offline"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const updateData = { driverStatus: status };

    // Update location if provided
    if (location) {
      updateData.currentLocation = location;
    }

    const driver = await User.findByIdAndUpdate(driverId, updateData, {
      new: true,
    });

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    res.json({
      message: "Status updated successfully",
      driverStatus: driver.driverStatus,
      currentLocation: driver.currentLocation,
    });
  } catch (error) {
    console.error("Error updating driver status:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update driver location
router.post("/location", auth, ensureDriver, async (req, res) => {
  try {
    const { location } = req.body;
    const driverId = req.user.id;

    if (!location || !location.coordinates) {
      return res.status(400).json({ message: "Valid location required" });
    }

    const driver = await User.findByIdAndUpdate(
      driverId,
      { currentLocation: location },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    res.json({
      message: "Location updated successfully",
      currentLocation: driver.currentLocation,
    });
  } catch (error) {
    console.error("Error updating driver location:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get driver profile with driver-specific fields
router.get("/profile", auth, ensureDriver, async (req, res) => {
  try {
    const driver = await User.findById(req.user.id).select("-password");

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    res.json(driver);
  } catch (error) {
    console.error("Error fetching driver profile:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get nearby drivers (for admin or system use)
router.get("/nearby", auth, async (req, res) => {
  try {
    const { latitude, longitude, radius = 5000 } = req.query; // radius in meters

    if (!latitude || !longitude) {
      return res
        .status(400)
        .json({ message: "Latitude and longitude required" });
    }

    const drivers = await User.find({
      role: "driver",
      driverStatus: "available",
      "currentLocation.coordinates": {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)],
          },
          $maxDistance: parseInt(radius),
        },
      },
    }).select("firstName lastName currentLocation rating totalRides vehicle");

    res.json(drivers);
  } catch (error) {
    console.error("Error finding nearby drivers:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update driver vehicle information
router.put("/vehicle", auth, ensureDriver, async (req, res) => {
  try {
    const { vehicle } = req.body;
    const driverId = req.user.id;

    if (!vehicle) {
      return res.status(400).json({ message: "Vehicle information required" });
    }

    const driver = await User.findByIdAndUpdate(
      driverId,
      { vehicle },
      { new: true, runValidators: true }
    );

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    res.json({
      message: "Vehicle information updated successfully",
      vehicle: driver.vehicle,
    });
  } catch (error) {
    console.error("Error updating vehicle information:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get driver statistics
router.get("/stats", auth, ensureDriver, async (req, res) => {
  try {
    const driverId = req.user.id;

    // might want to create a separate stats calculation
    // This is just a basic example
    const driver = await User.findById(driverId).select(
      "rating totalRides totalRatings"
    );

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    const stats = {
      totalRides: driver.totalRides || 0,
      averageRating: driver.rating || 5,
      totalRatings: driver.totalRatings || 0,
      // Add more stats as needed
    };

    res.json(stats);
  } catch (error) {
    console.error("Error fetching driver stats:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
