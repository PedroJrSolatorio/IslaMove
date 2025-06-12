import express from "express";
import axios from "axios";

const router = express.Router();

router.get("/autocomplete", async (req, res) => {
  const { input } = req.query;

  try {
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json`,
      {
        params: {
          input,
          key: process.env.GOOGLE_API_KEY,
          sessiontoken: "your-session-token",
        },
      }
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
