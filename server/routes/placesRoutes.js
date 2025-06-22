import express from "express";
import axios from "axios";

const router = express.Router();

router.get("/autocomplete", async (req, res) => {
  const { input, lat, lng, radius = 10000 } = req.query; // radius in meters (10km)

  try {
    const params = {
      input,
      key: process.env.GOOGLE_API_KEY,
      sessiontoken: "your-session-token",
    };

    // Add location bias if coordinates are provided
    if (lat && lng) {
      params.location = `${lat},${lng}`;
      params.radius = radius;
      // You can also use 'strictbounds' to only return results within the radius
      // params.strictbounds = true;
    }

    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json`,
      { params }
    );
    console.log("Google Places Response:", response.data);
    res.json(response.data);
  } catch (error) {
    console.error("Places Autocomplete error:", error);
    res.status(500).json({ error: "Failed to fetch autocomplete results" });
  }
});

router.get("/details", async (req, res) => {
  const { placeId } = req.query;

  try {
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/place/details/json`,
      {
        params: {
          place_id: placeId,
          key: process.env.GOOGLE_API_KEY,
          sessiontoken: "your-session-token",
          fields: "geometry,formatted_address,name,place_id",
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("Place Details error:", error);
    res.status(500).json({ error: "Failed to fetch place details" });
  }
});

export default router;
