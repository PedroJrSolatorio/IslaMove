import Zone from "../models/Zone.js";
import Pricing from "../models/Pricing.js";

// Get zone pricing
export const getPricing = async (req, res) => {
  try {
    const pricing = await Pricing.find({ isActive: true })
      .populate("fromZone")
      .populate("toZone");
    res.json({ success: true, data: pricing });
  } catch (error) {
    console.error("Error fetching pricing:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lookup zone by coordinates
export const lookup = async (req, res) => {
  try {
    console.log("Query Params:", req.query);

    const { latitude, longitude } = req.query;

    // Validate input parameters
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    // Convert to numbers
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    // Find the zone that contains the point
    const zone = await Zone.findOne({
      coordinates: {
        $geoIntersects: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
        },
      },
    });

    if (!zone) {
      return res.json({
        success: false,
        message: "No zone found for these coordinates",
        data: null,
      });
    }

    res.json({ success: true, data: zone });
  } catch (error) {
    console.error("Zone lookup error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all zones
export const getAllZones = async (req, res) => {
  try {
    const zones = await Zone.find({ isActive: true });
    res.json({ success: true, zones });
  } catch (error) {
    console.error("Error fetching zones:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
