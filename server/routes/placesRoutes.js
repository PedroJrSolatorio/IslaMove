import express from "express";
import axios from "axios";

const router = express.Router();

router.get("/autocomplete", async (req, res) => {
  const { input, lat, lng, radius, sessionToken } = req.query; // radius in meters (6km)
  //this will be used to filter results based on proximity from user's location

  if (!sessionToken) {
    return res.status(400).json({ error: "Session token is required" });
  }

  // Don't process very short queries
  if (!input || input.length < 3) {
    return res.json({ predictions: [] });
  }

  // Validate and sanitize radius
  let parsedRadius = parseInt(radius, 10);
  if (isNaN(parsedRadius)) {
    parsedRadius = 6000; // Default to 6km, Fallback if radius is invalid or not provided from frontend
  }

  // Optional: enforce a maximum radius to avoid excessive queries
  const MAX_RADIUS = 10000; // 10km
  if (parsedRadius > MAX_RADIUS) {
    parsedRadius = MAX_RADIUS;
  }

  // Note: params.radius and params.strictbounds still did not limit the results to the specified radius, maybe Google Nearby Search is more suitable for this

  try {
    const params = {
      input,
      key: process.env.GOOGLE_API_KEY,
      sessiontoken: sessionToken,
      components: "country:ph",
      language: "en",
    };

    // Add location bias if coordinates are provided
    if (lat && lng) {
      params.location = `${lat},${lng}`;
      params.radius = parsedRadius.toString();
      // You can also use 'strictbounds' to only return results within the radius
      params.strictbounds = true;
    }

    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json`,
      { params, timeout: 8000 }
    );
    console.log(`Autocomplete API call for session: ${sessionToken}`);
    res.json(response.data);
  } catch (error) {
    console.error("Places Autocomplete error:", error);
    res.status(500).json({ error: "Failed to fetch autocomplete results" });
  }
});

router.get("/details", async (req, res) => {
  const { placeId, sessionToken } = req.query;

  // Validate required parameters
  if (!placeId || !sessionToken) {
    return res.status(400).json({
      error: "Place ID and session token are required",
    });
  }

  try {
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/place/details/json`,
      {
        params: {
          place_id: placeId,
          key: process.env.GOOGLE_API_KEY,
          sessiontoken: sessionToken, // Same session token for billing
          fields: "geometry,formatted_address,place_id", // Only fetch needed fields
        },
        timeout: 8000,
      }
    );
    console.log(`Place Details API call for session: ${sessionToken}`);
    res.json(response.data);
  } catch (error) {
    console.error("Place Details error:", error);
    res.status(500).json({ error: "Failed to fetch place details" });
  }
});

export default router;
