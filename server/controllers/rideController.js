import Ride from "../models/Ride.js";
import Pricing from "../models/Pricing.js";
import Zone from "../models/Zone.js";
import axios from "axios";

// Update ride status
export const updateRide = async (req, res) => {
  try {
    const ride = await Ride.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    res.json(ride);
  } catch (error) {
    res.status(500).json({ error: "Error updating ride" });
  }
};

// Delete a ride
export const deleteRide = async (req, res) => {
  try {
    await Ride.findByIdAndDelete(req.params.id);
    res.json({ message: "Ride deleted" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting ride" });
  }
};

export const createRideRequest = async (req, res) => {
  try {
    const {
      pickupLocation,
      destinationLocation,
      fromZone,
      toZone,
      estimatedDistance,
      estimatedDuration,
      price,
      baseFare,
      discountApplied,
      discountRate,
      discountType,
      passengerType,
      passengerAge,
      paymentMethod = "cash", // default payment method
    } = req.body;

    const passengerId = req.user.id;

    // Validate required fields
    if (!pickupLocation || !destinationLocation || !fromZone || !toZone) {
      return res.status(400).json({
        success: false,
        message: "Missing required location or zone information",
      });
    }

    // Verify zones exist
    const pickupZoneExists = await Zone.findById(fromZone);
    const destinationZoneExists = await Zone.findById(toZone);

    if (!pickupZoneExists || !destinationZoneExists) {
      return res.status(400).json({
        success: false,
        message: "Invalid zone information",
      });
    }

    // If no route details provided, calculate them
    let finalDistance = estimatedDistance;
    let finalDuration = estimatedDuration;
    let routePath = null;

    if (!estimatedDistance || !estimatedDuration) {
      try {
        const route = await axios.get(
          "https://maps.googleapis.com/maps/api/directions/json",
          {
            params: {
              origin: `${pickupLocation.coordinates[1]},${pickupLocation.coordinates[0]}`,
              destination: `${destinationLocation.coordinates[1]},${destinationLocation.coordinates[0]}`,
              key: process.env.GOOGLE_MAPS_API_KEY,
            },
          }
        );

        if (route.data.routes && route.data.routes.length > 0) {
          const leg = route.data.routes[0].legs[0];
          finalDistance = leg.distance.value / 1000; // Convert to km
          finalDuration = Math.ceil(leg.duration.value / 60); // Convert to minutes
          routePath = route.data.routes[0].overview_polyline.points;
        }
      } catch (error) {
        console.error("Error calculating route:", error);
        // Continue with provided values or defaults
      }
    }

    // Create new ride
    const newRide = new Ride({
      passenger: passengerId,
      pickupLocation,
      destinationLocation,
      fromZone,
      toZone,
      estimatedDistance: finalDistance,
      estimatedDuration: finalDuration,
      price: Math.ceil(price), // Round up to nearest whole number
      status: "requested",
      paymentMethod,
      routePath: routePath ? [routePath] : [],
      // Store additional pricing information for reference
      pricingDetails: {
        baseFare,
        discountApplied,
        discountRate,
        discountType,
        passengerType,
        passengerAge,
      },
    });

    await newRide.save();

    // Populate zone information for response
    const populatedRide = await Ride.findById(newRide._id)
      .populate("fromZone", "name")
      .populate("toZone", "name");

    res.status(201).json({
      success: true,
      message: "Ride request created successfully",
      data: populatedRide,
    });
  } catch (error) {
    console.error("Create ride error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create ride request",
      error: error.message,
    });
  }
};
