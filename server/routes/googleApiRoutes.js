import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

dotenv.config();
const router = express.Router();
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Add rate limiting
const googleApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests to the Google API proxy, please try again later",
});

// Apply to all routes in this file
router.use(googleApiLimiter);

// Geocoding endpoint
router.get("/geocode", async (req, res) => {
  try {
    const { address, latlng } = req.query;
    let url;

    if (address) {
      url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address
      )}&key=${GOOGLE_API_KEY}`;
    } else if (latlng) {
      url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latlng}&key=${GOOGLE_API_KEY}`;
    } else {
      return res
        .status(400)
        .json({ error: "Address or latlng parameter is required" });
    }

    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    console.error("Google Geocoding API error:", error);
    res.status(500).json({ error: "Failed to fetch geocoding data" });
  }
});

router.post("/geocode", async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ error: "Address is required" });
    }

    const geocodeRes = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json",
      {
        params: {
          address: address,
          key: process.env.GOOGLE_API_KEY,
        },
      }
    );

    const location = geocodeRes.data.results[0]?.geometry.location;

    if (!location) {
      return res.status(400).json({ error: "Unable to geocode the address" });
    }

    return res.json({
      coordinates: {
        lat: location.lat,
        lng: location.lng,
      },
    });
  } catch (error) {
    console.error("Geocoding error:", error);
    return res.status(500).json({ error: "Failed to geocode address" });
  }
});

// Directions endpoint
router.get("/directions", async (req, res) => {
  try {
    const { origin, destination } = req.query;

    if (!origin || !destination) {
      return res
        .status(400)
        .json({ error: "Origin and destination parameters are required" });
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_API_KEY}`;
    const response = await axios.get(url);
    res.json(response.data);
  } catch (error) {
    console.error("Google Directions API error:", error);
    res.status(500).json({ error: "Failed to fetch directions data" });
  }
});

export default router;
