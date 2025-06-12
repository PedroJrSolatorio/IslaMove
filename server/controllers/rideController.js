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
    const { pickupLocation, destinationLocation, vehicleType, paymentMethod } =
      req.body;
    const passengerId = req.user.id;

    // Find zones for pickup and destination
    const pickupZone = await Zone.findOne({
      coordinates: {
        $geoIntersects: {
          $geometry: {
            type: "Point",
            coordinates: pickupLocation.coordinates,
          },
        },
      },
    });

    const destinationZone = await Zone.findOne({
      coordinates: {
        $geoIntersects: {
          $geometry: {
            type: "Point",
            coordinates: destinationLocation.coordinates,
          },
        },
      },
    });

    if (!pickupZone || !destinationZone) {
      return res
        .status(400)
        .json({ message: "Service not available in this area" });
    }

    // Get route details using Google Maps API
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

    if (!route.data.routes.length) {
      return res.status(400).json({ message: "Could not calculate route" });
    }

    const leg = route.data.routes[0].legs[0];
    const distanceInKm = leg.distance.value / 1000;
    const durationInMinutes = Math.ceil(leg.duration.value / 60);

    // Calculate fare based on zones and distance
    let finalPrice;

    // First, check if there's a fixed fare rule for these zones
    const fareRule = await Fare.findOne({
      sourceZone: pickupZone.name,
      destinationZone: destinationZone.name,
      isActive: true,
    });

    if (fareRule) {
      if (fareRule.isFixedFare) {
        // Use fixed fare amount
        finalPrice = fareRule.fixedFare;
      } else {
        // Use distance-based calculation from the fare rule
        finalPrice = fareRule.baseFare + distanceInKm * fareRule.perKmRate;
      }
    } else {
      // Fallback to pricing model if no fare rule exists
      const pricing = await Pricing.findOne({
        fromZone: pickupZone._id,
        toZone: destinationZone._id,
        vehicleType,
        isActive: true,
      });

      if (!pricing) {
        return res
          .status(404)
          .json({ message: "Pricing not available for this route" });
      }

      // Calculate using pricing model
      const fare = pricing.basePrice + pricing.pricePerKm * distanceInKm;
      finalPrice = Math.ceil(fare * pricing.surgeMultiplier);
    }

    // Create new ride
    const newRide = new Ride({
      passenger: passengerId,
      pickupLocation,
      destinationLocation,
      fromZone: pickupZone._id,
      toZone: destinationZone._id,
      estimatedDistance: distanceInKm,
      estimatedDuration: durationInMinutes,
      price: Math.ceil(finalPrice), // Round up to nearest whole number
      status: "requested",
      paymentMethod,
      routePath: route.data.routes[0].overview_polyline.points,
      vehicleType,
    });

    await newRide.save();

    res.status(201).json({
      success: true,
      data: {
        ...newRide.toObject(),
        fromZoneName: pickupZone.name,
        toZoneName: destinationZone.name,
      },
    });
  } catch (error) {
    console.error("Create ride error:", error);
    res.status(500).json({ message: "Failed to create ride request" });
  }
};
