import Ride from "../models/Ride.js";
import User from "../models/User.js";
import Zone from "../models/Zone.js";
import axios from "axios";
import { getIO } from "../socket/socketManager.js";

// Update ride status
export const updateRide = async (req, res) => {
  try {
    const { status } = req.body;
    const rideId = req.params.id;
    const userId = req.user.id;

    // Find the ride and populate driver/passenger info
    const ride = await Ride.findById(rideId)
      .populate("passenger", "firstName lastName")
      .populate("driver", "firstName lastName");

    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    // Check if user is authorized to update this ride
    const isDriver = ride.driver && ride.driver._id.toString() === userId;
    const isPassenger = ride.passenger._id.toString() === userId;

    if (!isDriver && !isPassenger) {
      return res
        .status(403)
        .json({ error: "Not authorized to update this ride" });
    }

    // Update timestamps based on status
    const updateData = { status };
    const now = new Date();

    switch (status) {
      case "accepted":
        updateData.acceptedTime = now;
        break;
      case "arrived":
        updateData.arrivedTime = now;
        break;
      case "inProgress":
        updateData.startTime = now;
        break;
      case "completed":
        updateData.endTime = now;
        break;
    }

    const updatedRide = await Ride.findByIdAndUpdate(rideId, updateData, {
      new: true,
    })
      .populate("passenger", "firstName lastName middleInitial")
      .populate("driver", "firstName lastName middleInitial");

    // Emit socket event to notify relevant parties
    const io = getIO();
    if (isDriver) {
      // Notify passenger of status update
      io.to(`user_${ride.passenger._id}`).emit("ride_status_update", {
        rideId: rideId,
        status: status,
        ride: updatedRide,
      });
    }

    res.json({
      success: true,
      data: updatedRide,
    });
  } catch (error) {
    console.error("Error updating ride:", error);
    res.status(500).json({ error: "Error updating ride" });
  }
};

export const addRide = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { totalRides: 1 } },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({
      message: "totalRides incremented",
      totalRides: user.totalRides,
    });
  } catch (error) {
    console.error("Error incrementing totalRides:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Accept ride request (for drivers)
export const acceptRide = async (req, res) => {
  try {
    const rideId = req.params.id;
    const driverId = req.user.id;

    // Check if driver exists and is available
    const driver = await User.findById(driverId);
    if (!driver || driver.role !== "driver") {
      return res.status(403).json({ error: "Driver access required" });
    }

    if (driver.driverStatus !== "available") {
      return res.status(400).json({ error: "Driver is not available" });
    }

    // Find the ride
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    if (ride.status !== "requested") {
      return res.status(400).json({ error: "Ride is no longer available" });
    }

    // Check if driver already has maximum rides
    const activeRides = await Ride.countDocuments({
      driver: driverId,
      status: { $in: ["accepted", "arrived", "inProgress"] },
    });

    if (activeRides >= 5) {
      // MAX_PASSENGERS from your frontend
      return res.status(400).json({ error: "Maximum active rides reached" });
    }

    // Accept the ride
    const updatedRide = await Ride.findByIdAndUpdate(
      rideId,
      {
        driver: driverId,
        status: "accepted",
        acceptedTime: new Date(),
      },
      { new: true }
    )
      .populate(
        "passenger",
        "firstName lastName middleInitial profileImage phoneNumber rating"
      )
      .populate(
        "driver",
        "firstName lastName middleInitial profileImage phoneNumber rating"
      )
      .populate("fromZone", "name")
      .populate("toZone", "name");

    // Count active rides after accepting one
    const newActiveRides = await Ride.countDocuments({
      driver: driverId,
      status: { $in: ["accepted", "arrived", "inProgress"] },
    });

    const newStatus = newActiveRides >= 5 ? "busy" : "available";
    await User.findByIdAndUpdate(driverId, { driverStatus: newStatus });

    // Notify passenger via socket
    const io = getIO();
    io.to(`user_${ride.passenger}`).emit("ride_accepted", {
      ride: updatedRide,
      driver: {
        _id: driver._id,
        firstName: driver.firstName,
        lastName: driver.lastName,
        middleInitial: driver.middleInitial,
        profileImage: driver.profileImage,
        phoneNumber: driver.phoneNumber,
        rating: driver.rating,
        vehicle: driver.vehicle,
        currentLocation: driver.currentLocation,
      },
    });

    res.json({
      success: true,
      message: "Ride accepted successfully",
      data: updatedRide,
    });
  } catch (error) {
    console.error("Error accepting ride:", error);
    res.status(500).json({ error: "Error accepting ride" });
  }
};

// Find nearby available drivers
const findNearbyDrivers = async (pickupLocation, maxDistance = 500) => {
  try {
    console.log("Searching for drivers with params:", {
      pickupLocation,
      maxDistance,
    });

    // First, let's check if there are any available drivers at all
    const totalAvailableDrivers = await User.countDocuments({
      role: "driver",
      driverStatus: "available",
      currentLocation: { $exists: true },
    });

    console.log(
      `Total available drivers with location: ${totalAvailableDrivers}`
    );

    if (totalAvailableDrivers === 0) {
      console.log("No available drivers found");
      return [];
    }

    // Ensure the pickup location is in the correct GeoJSON format
    const searchLocation = {
      type: "Point",
      coordinates: pickupLocation.coordinates,
    };

    console.log("Search location:", searchLocation);

    // Use $geoNear aggregation for better debugging
    const drivers = await User.aggregate([
      {
        $geoNear: {
          near: searchLocation,
          distanceField: "distance",
          maxDistance: maxDistance,
          spherical: true,
          query: {
            role: "driver",
            driverStatus: "available",
            currentLocation: { $exists: true },
          },
        },
      },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          rating: 1,
          currentLocation: 1,
          vehicle: 1,
          totalRides: 1,
          distance: 1,
        },
      },
      {
        $sort: {
          rating: -1,
          totalRides: -1,
        },
      },
    ]);

    console.log(`Found ${drivers.length} drivers within ${maxDistance}m`);

    // Log first few drivers for debugging
    if (drivers.length > 0) {
      console.log("First driver found:", {
        name: `${drivers[0].firstName} ${drivers[0].lastName}`,
        distance: drivers[0].distance,
        rating: drivers[0].rating,
        location: drivers[0].currentLocation,
      });
    }

    return drivers;
  } catch (error) {
    console.error("Error finding nearby drivers:", error);

    // Fallback: try to find drivers without location constraint
    try {
      console.log("Attempting fallback search without location constraint...");
      const fallbackDrivers = await User.find({
        role: "driver",
        driverStatus: "available",
      })
        .select("firstName lastName rating currentLocation vehicle totalRides")
        .sort({ rating: -1, totalRides: -1 })
        .limit(10);

      console.log(`Fallback search found ${fallbackDrivers.length} drivers`);
      return fallbackDrivers;
    } catch (fallbackError) {
      console.error("Fallback search also failed:", fallbackError);
      return [];
    }
  }
};

// Notify drivers about ride request
const notifyDriversAboutRide = async (ride) => {
  let io;

  try {
    io = getIO();
  } catch (socketError) {
    console.error("Socket.io not initialized:", socketError.message);
    // Continue without socket notifications for now
    console.log("Continuing without real-time notifications...");
  }

  let maxRadius = 500; // Start with 500 meters
  const maxAllowedRadius = 800; // Maximum 800 meters
  const radiusIncrement = 100; // Increase by 100 meters each time

  while (maxRadius <= maxAllowedRadius) {
    console.log(`Searching for drivers within ${maxRadius} meters...`);

    const nearbyDrivers = await findNearbyDrivers(
      ride.pickupLocation,
      maxRadius
    );

    if (nearbyDrivers.length > 0) {
      console.log(
        `Found ${nearbyDrivers.length} drivers within ${maxRadius} meters`
      );

      // Sort drivers by rating (descending) and total rides (descending)
      const sortedDrivers = nearbyDrivers.sort((a, b) => {
        if (b.rating !== a.rating) {
          return b.rating - a.rating; // Higher rating first
        }
        return b.totalRides - a.totalRides; // More experienced first
      });

      // Notify the best driver first
      const bestDriver = sortedDrivers[0];
      console.log(
        `Notifying best driver: ${bestDriver.firstName} ${bestDriver.lastName} (Rating: ${bestDriver.rating})`
      );

      // Only emit if socket is available
      if (io) {
        try {
          io.to(`user_${bestDriver._id}`).emit("ride_request", {
            ...ride.toObject(),
            passenger: {
              _id: ride.passenger._id,
              firstName: ride.passenger.firstName,
              lastName: ride.passenger.lastName,
              middleInitial: ride.passenger.middleInitial,
              profileImage: ride.passenger.profileImage,
              phoneNumber: ride.passenger.phoneNumber,
              rating: ride.passenger.rating,
            },
          });
          console.log(`Socket notification sent to driver: ${bestDriver._id}`);
        } catch (emitError) {
          console.error("Error emitting to driver:", emitError);
        }
      } else {
        console.log("Socket not available - driver notification skipped");
      }

      // Set a timeout to notify the next driver if the first one doesn't respond
      setTimeout(async () => {
        const rideCheck = await Ride.findById(ride._id);
        if (rideCheck && rideCheck.status === "requested") {
          // If ride is still not accepted, notify other drivers
          for (let i = 1; i < Math.min(sortedDrivers.length, 3); i++) {
            const driver = sortedDrivers[i];
            if (io) {
              try {
                io.to(`user_${driver._id}`).emit("ride_request", {
                  ...ride.toObject(),
                  passenger: {
                    _id: ride.passenger._id,
                    firstName: ride.passenger.firstName,
                    lastName: ride.passenger.lastName,
                    middleInitial: ride.passenger.middleInitial,
                    profileImage: ride.passenger.profileImage,
                    phoneNumber: ride.passenger.phoneNumber,
                    rating: ride.passenger.rating,
                  },
                });
                console.log(
                  `Backup notification sent to driver: ${driver._id}`
                );
              } catch (emitError) {
                console.error("Error emitting to backup driver:", emitError);
              }
            }
          }
        }
      }, 15000); // Wait 15 seconds before notifying other drivers

      return true; // Found drivers, stop searching
    }

    // No drivers found, increase radius
    maxRadius += radiusIncrement;
    console.log(`No drivers found, increasing radius to ${maxRadius} meters`);
  }

  console.log(
    `No drivers found within maximum radius of ${maxAllowedRadius} meters`
  );
  return false;
};

// Cancel a ride
export const cancelRide = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    // Find the ride and check if it exists
    const ride = await Ride.findById(id)
      .populate("passenger", "firstName lastName")
      .populate("driver", "firstName lastName");

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: "Ride not found",
      });
    }

    // Check if the user is authorized to cancel this ride
    const isPassenger = ride.passenger._id.toString() === userId;
    const isDriver = ride.driver && ride.driver._id.toString() === userId;

    if (!isPassenger && !isDriver) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this ride",
      });
    }

    // Check if ride can be cancelled
    if (ride.status === "completed" || ride.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: `Ride is already ${ride.status}`,
      });
    }

    // Update ride with cancellation details
    const updatedRide = await Ride.findByIdAndUpdate(
      id,
      {
        status: "cancelled",
        cancellationReason: reason || "No reason provided",
        cancellationInitiator: isPassenger ? "passenger" : "driver",
        cancellationTime: new Date(),
      },
      { new: true }
    )
      .populate("fromZone", "name")
      .populate("toZone", "name");

    // If driver cancels, make them available again
    if (isDriver) {
      await User.findByIdAndUpdate(ride.driver._id, {
        driverStatus: "available",
      });
    }

    // Notify the other party via socket
    const io = getIO();
    if (isPassenger && ride.driver) {
      io.to(`user_${ride.driver._id}`).emit("ride_cancelled", {
        rideId: id,
        reason: reason || "No reason provided",
        initiator: "passenger",
      });
    } else if (isDriver) {
      io.to(`user_${ride.passenger._id}`).emit("ride_cancelled", {
        rideId: id,
        reason: reason || "No reason provided",
        initiator: "driver",
      });
    }

    res.json({
      success: true,
      message: "Ride cancelled successfully",
      data: updatedRide,
    });
  } catch (error) {
    console.error("Cancel ride error:", error);
    res.status(500).json({
      success: false,
      message: "Error cancelling ride",
      error: error.message,
    });
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

// Rate passenger (for drivers)
export const ratePassenger = async (req, res) => {
  try {
    const { rating, feedback } = req.body;
    const rideId = req.params.id;
    const driverId = req.user.id;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    // Find the ride
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    // Check if the driver is authorized to rate this ride
    if (!ride.driver || ride.driver.toString() !== driverId) {
      return res
        .status(403)
        .json({ error: "Not authorized to rate this passenger" });
    }

    // Check if ride is completed
    if (ride.status !== "completed") {
      return res.status(400).json({ error: "Can only rate completed rides" });
    }

    // Check if already rated
    if (ride.passengerRating) {
      return res
        .status(400)
        .json({ error: "Passenger already rated for this ride" });
    }

    // Update the ride with passenger rating
    await Ride.findByIdAndUpdate(rideId, {
      passengerRating: rating,
      driverFeedback: feedback || "",
    });

    // Update passenger's overall rating
    const passenger = await User.findById(ride.passenger);
    const newTotalRatings = passenger.totalRatings + 1;
    const newRating =
      (passenger.rating * passenger.totalRatings + rating) / newTotalRatings;

    await User.findByIdAndUpdate(ride.passenger, {
      rating: parseFloat(newRating.toFixed(1)),
      totalRatings: newTotalRatings,
    });

    res.json({
      success: true,
      message: "Passenger rated successfully",
    });
  } catch (error) {
    console.error("Error rating passenger:", error);
    res.status(500).json({ error: "Error rating passenger" });
  }
};

// Rate driver (for passengers)
export const rateDriver = async (req, res) => {
  try {
    const { rating, feedback } = req.body;
    const rideId = req.params.id;
    const passengerId = req.user.id;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    // Find the ride
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    // Check if the passenger is authorized to rate this ride
    if (!ride.passenger || ride.passenger.toString() !== passengerId) {
      return res
        .status(403)
        .json({ error: "Not authorized to rate this driver" });
    }

    // Check if ride is completed
    if (ride.status !== "completed") {
      return res.status(400).json({ error: "Can only rate completed rides" });
    }

    // Check if already rated
    if (ride.driverRating) {
      return res
        .status(400)
        .json({ error: "Driver already rated for this ride" });
    }

    // Update the ride with driver rating
    await Ride.findByIdAndUpdate(rideId, {
      driverRating: rating,
      passengerFeedback: feedback || "",
    });

    // Update driver's overall rating
    const driver = await User.findById(ride.driver);
    if (driver) {
      const newTotalRatings = driver.totalRatings + 1;
      const newRating =
        (driver.rating * driver.totalRatings + rating) / newTotalRatings;

      await User.findByIdAndUpdate(ride.driver, {
        rating: parseFloat(newRating.toFixed(1)),
        totalRatings: newTotalRatings,
      });
      // Emit socket event to driver for real-time update
      const io = getIO();
      if (io && driver) {
        io.to(`user_${driver._id}`).emit("driver_rated", {
          rating: parseFloat(newRating.toFixed(1)),
          totalRatings: newTotalRatings,
        });
      }
    }

    res.json({
      success: true,
      message: "Driver rated successfully",
    });
  } catch (error) {
    console.error("Error rating driver:", error);
    res.status(500).json({ error: "Error rating driver" });
  }
};

export const getRecentRides = async (req, res) => {
  try {
    const userId = req.user.id;
    const rides = await Ride.find({ passenger: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("fromZone", "name")
      .populate("toZone", "name")
      .populate("driver", "firstName lastName profileImage")
      .exec();

    res.json({ success: true, rides });
  } catch (error) {
    console.error("Error fetching recent rides:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch recent rides" });
  }
};

export const getRideHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;
    const query = { passenger: userId };
    if (status) query.status = status;

    const rides = await Ride.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("fromZone", "name")
      .populate("toZone", "name")
      .populate("driver", "firstName lastName profileImage")
      .exec();

    const total = await Ride.countDocuments(query);

    res.json({
      success: true,
      rides,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching ride history:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch ride history" });
  }
};

export const createRideRequest = async (req, res) => {
  console.log("=== RIDE REQUEST DEBUG ===");
  console.log("Request body:", JSON.stringify(req.body, null, 2));
  console.log("User ID:", req.user?.id);

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
      paymentMethod = "cash",
    } = req.body;

    console.log("Received ride request:", {
      fromZone,
      toZone,
      passengerId: req.user.id,
      estimatedDistance,
      estimatedDuration,
    });

    const passengerId = req.user.id;

    // Validate required fields with better error messages
    if (!pickupLocation || !destinationLocation) {
      return res.status(400).json({
        success: false,
        message: "Pickup and destination locations are required",
      });
    }

    if (!fromZone || !toZone) {
      return res.status(400).json({
        success: false,
        message: "Zone information is required",
      });
    }

    // Verify zones exist with better error handling
    let pickupZoneExists, destinationZoneExists;

    try {
      pickupZoneExists = await Zone.findById(fromZone);
      destinationZoneExists = await Zone.findById(toZone);
    } catch (zoneError) {
      console.error("Zone lookup error:", zoneError);
      return res.status(400).json({
        success: false,
        message: "Invalid zone ID format",
      });
    }

    if (!pickupZoneExists) {
      console.error("Pickup zone not found:", fromZone);
      return res.status(400).json({
        success: false,
        message: "Pickup zone not found",
      });
    }

    if (!destinationZoneExists) {
      console.error("Destination zone not found:", toZone);
      return res.status(400).json({
        success: false,
        message: "Destination zone not found",
      });
    }

    // Check if passenger has any active rides
    const activeRide = await Ride.findOne({
      passenger: passengerId,
      status: { $in: ["requested", "accepted", "arrived", "inProgress"] },
    });

    if (activeRide) {
      return res.status(400).json({
        success: false,
        message: "You already have an active ride request",
      });
    }

    // Check if there are any available drivers before creating the ride
    console.log("Checking for available drivers...");
    const availableDrivers = await User.countDocuments({
      role: "driver",
      driverStatus: "available",
    });

    console.log(`Found ${availableDrivers} available drivers online`);

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
              key: process.env.GOOGLE_API_KEY,
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

    // Get passenger info for the ride
    const passenger = await User.findById(passengerId).select(
      "firstName lastName middleInitial profileImage phoneNumber rating"
    );

    let io;
    try {
      io = getIO();
    } catch (socketError) {
      console.warn("Socket.IO not available:", socketError.message);
      io = null;
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
    console.log("Ride created successfully:", newRide._id);

    setTimeout(async () => {
      try {
        const ride = await Ride.findById(newRide._id);

        // Only auto-cancel if the ride is still in the 'requested' state
        // It could have been accepted or manually cancelled by now.
        if (ride && ride.status === "requested") {
          console.log(
            `Backend: Ride ${newRide._id} timed out. Auto-cancelling...`
          );

          const updatedTimedOutRide = await Ride.findByIdAndUpdate(
            newRide._id,
            {
              status: "cancelled",
              cancellationReason: "No drivers available - system timeout",
              cancellationTime: new Date(),
              cancellationInitiator: "system",
            },
            { new: true }
          );

          // Notify the passenger via socket that their ride was auto-cancelled
          if (io) {
            io.to(`user_${updatedTimedOutRide.passenger._id}`).emit(
              "ride_cancelled",
              {
                rideId: updatedTimedOutRide._id,
                reason: "No drivers available - timeout (system auto-cancel)",
                initiator: "system",
                rideStatus: updatedTimedOutRide.status, // Send the new status
              }
            );
            console.log(
              `Backend: Passenger ${updatedTimedOutRide.passenger._id} notified of auto-cancellation.`
            );
          } else {
            console.warn(
              "Socket.IO not available for auto-cancellation notification."
            );
          }

          console.log(
            `Backend: Ride ${newRide._id} successfully auto-cancelled.`
          );
        } else {
          console.log(
            `Backend: Ride ${newRide._id} was no longer in 'requested' status (current: ${ride?.status}), not auto-cancelling.`
          );
        }
      } catch (timeoutError) {
        console.error(
          "Error in backend timeout cancellation for ride",
          newRide._id,
          ":",
          timeoutError
        );
      }
    }, 60000); // 1 minute timeout (adjust as needed)

    // Populate zone information for response
    const populatedRide = await Ride.findById(newRide._id)
      .populate("fromZone", "name")
      .populate("toZone", "name")
      .populate(
        "passenger",
        "firstName lastName middleInitial profileImage phoneNumber rating"
      );

    // Start looking for drivers
    console.log("Starting driver search for ride:", newRide._id);
    let driversFound = false;

    try {
      driversFound = await notifyDriversAboutRide(populatedRide);
      console.log("Driver notification result:", driversFound);
    } catch (notificationError) {
      console.error("Driver notification failed:", notificationError);
      // Don't fail the entire request - just log the error
      console.log("Continuing without driver notifications...");
    }

    // Always return success if ride was created
    // The socket issue shouldn't prevent ride creation
    res.status(201).json({
      success: true,
      message: driversFound
        ? "Ride request created successfully. Driver notified."
        : "Ride request created successfully. Searching for drivers...",
      data: populatedRide,
      _id: newRide._id,
      socketEnabled: !!io, // Let frontend know if real-time features are available
    });
  } catch (error) {
    console.error("Create ride error:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to create ride request",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};
