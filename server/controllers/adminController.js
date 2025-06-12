import User from "../models/User.js";
import Ride from "../models/Ride.js";
import Zone from "../models/Zone.js";
import Pricing from "../models/Pricing.js";

// Get admin dashboard statistics
export const getAdminStats = async (req, res) => {
  try {
    const { timeFrame = "day" } = req.query;

    // Calculate date range based on time frame
    const now = new Date();
    let startDate = new Date();

    switch (timeFrame) {
      case "day":
        startDate.setDate(now.getDate() - 1);
        break;
      case "week":
        startDate.setDate(now.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(now.getMonth() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 1); // Default to daily
    }

    // Count total drivers and passengers
    const totalDrivers = await User.countDocuments({ role: "driver" });
    const totalPassengers = await User.countDocuments({ role: "passenger" });

    // Count active drivers (those with status 'available' or 'busy')
    const activeDrivers = await User.countDocuments({
      role: "driver",
      driverStatus: { $in: ["available", "busy"] },
    });

    // Count pending driver verifications
    const pendingDriverVerifications = await User.countDocuments({
      role: "driver",
      isVerified: false,
    });

    // Count rides completed and in progress within the time frame
    const ridesCompleted = await Ride.countDocuments({
      status: "completed",
      requestTime: { $gte: startDate },
    });

    const ridesInProgress = await Ride.countDocuments({
      status: { $in: ["accepted", "arrived", "inProgress"] },
    });

    // Get average rating for drivers
    const ratingAggregation = await User.aggregate([
      { $match: { role: "driver", totalRatings: { $gt: 0 } } },
      { $group: { _id: null, averageRating: { $avg: "$rating" } } },
    ]);

    const averageRating =
      ratingAggregation.length > 0
        ? parseFloat(ratingAggregation[0].averageRating.toFixed(1))
        : 0;

    // Get average rating for passengers
    const passengerRatingAggregation = await User.aggregate([
      { $match: { role: "passenger", totalRatings: { $gt: 0 } } },
      { $group: { _id: null, averageRating: { $avg: "$rating" } } },
    ]);

    const averagePassengerRating =
      passengerRatingAggregation.length > 0
        ? parseFloat(passengerRatingAggregation[0].averageRating.toFixed(1))
        : 0;

    // Get low-rated drivers and passengers
    const lowRatedDrivers = await User.countDocuments({
      role: "driver",
      rating: { $lt: 3.0 },
      totalRatings: { $gt: 0 },
    });

    const lowRatedPassengers = await User.countDocuments({
      role: "passenger",
      rating: { $lt: 3.0 },
      totalRatings: { $gt: 0 },
    });

    // Calculate average wait time between request and acceptance
    const waitTimeAggregation = await Ride.aggregate([
      {
        $match: {
          requestTime: { $exists: true, $ne: null },
          acceptedTime: { $exists: true, $ne: null },
          requestTime: { $gte: startDate },
        },
      },
      {
        $project: {
          waitTimeMinutes: {
            $divide: [
              { $subtract: ["$acceptedTime", "$requestTime"] },
              60000, // Convert milliseconds to minutes
            ],
          },
        },
      },
      { $group: { _id: null, averageWaitTime: { $avg: "$waitTimeMinutes" } } },
    ]);

    const averageWaitTime =
      waitTimeAggregation.length > 0
        ? parseFloat(waitTimeAggregation[0].averageWaitTime.toFixed(1))
        : 0;

    // // Calculate average trip duration
    // const durationAggregation = await Ride.aggregate([
    //   {
    //     $match: {
    //       startTime: { $exists: true, $ne: null },
    //       endTime: { $exists: true, $ne: null },
    //       status: "completed",
    //       requestTime: { $gte: startDate },
    //     },
    //   },
    //   {
    //     $project: {
    //       tripDurationMinutes: {
    //         $divide: [
    //           { $subtract: ["$endTime", "$startTime"] },
    //           60000, // Convert milliseconds to minutes
    //         ],
    //       },
    //     },
    //   },
    //   {
    //     $group: {
    //       _id: null,
    //       averageDuration: { $avg: "$tripDurationMinutes" },
    //     },
    //   },
    // ]);

    // const averageTripDuration =
    //   durationAggregation.length > 0
    //     ? parseFloat(durationAggregation[0].averageDuration.toFixed(1))
    //     : 0;

    // Support Tickets
    // Get number of support tickets (assuming this would be implemented elsewhere)
    // This is a placeholder - replace with your actual implementation
    const supportTickets = 0;

    // Get cancellation stats
    const totalCancellations = await Ride.countDocuments({
      status: "cancelled",
      requestTime: { $gte: startDate },
    });

    const passengerCancellations = await Ride.countDocuments({
      status: "cancelled",
      cancellationInitiator: "passenger",
      requestTime: { $gte: startDate },
    });

    const driverCancellations = await Ride.countDocuments({
      status: "cancelled",
      cancellationInitiator: "driver",
      requestTime: { $gte: startDate },
    });

    const cancellationRate =
      ridesCompleted > 0
        ? parseFloat(
            (
              (totalCancellations / (totalCancellations + ridesCompleted)) *
              100
            ).toFixed(1)
          )
        : 0;

    res.json({
      totalDrivers,
      totalPassengers,
      activeDrivers,
      pendingDriverVerifications,
      ridesCompleted,
      ridesInProgress,
      averageRating,
      averagePassengerRating,
      lowRatedDrivers,
      lowRatedPassengers,
      supportTickets,
      averageWaitTime,
      //   averageTripDuration,
      cancellationStats: {
        total: totalCancellations,
        byPassenger: passengerCancellations,
        byDriver: driverCancellations,
        rate: cancellationRate,
      },
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({ error: "Failed to fetch admin statistics" });
  }
};

// ZONE MANAGEMENT
// Create a new zone
export const createZone = async (req, res) => {
  try {
    const {
      name,
      coordinates,
      color,
      description,
      zoneType,
      parentZone,
      priority,
    } = req.body;

    // Validate required fields
    if (
      !name ||
      !coordinates ||
      typeof coordinates !== "object" ||
      coordinates.type !== "Polygon" ||
      !Array.isArray(coordinates.coordinates)
    ) {
      return res.status(400).json({
        success: false,
        message: "Name and valid GeoJSON Polygon coordinates are required",
      });
    }

    // Validate zone type
    if (zoneType && !["barangay", "area", "landmark"].includes(zoneType)) {
      return res.status(400).json({
        success: false,
        message: "Zone type must be 'barangay', 'area', or 'landmark'",
      });
    }

    // Validate parent zone if provided
    if (parentZone) {
      const parent = await Zone.findById(parentZone);
      if (!parent) {
        return res.status(400).json({
          success: false,
          message: "Parent zone does not exist",
        });
      }

      // Areas and landmarks should have barangay parents
      if (zoneType === "area" && parent.zoneType !== "barangay") {
        return res.status(400).json({
          success: false,
          message: "Area zones must have a barangay as parent",
        });
      }
    }

    // Check if zone with this name already exists
    const existingZone = await Zone.findOne({ name });
    if (existingZone) {
      return res.status(400).json({
        success: false,
        message: "A zone with this name already exists",
      });
    }

    // Set default priority based on zone type
    let zonePriority = priority;
    if (!zonePriority) {
      switch (zoneType) {
        case "landmark":
          zonePriority = 3;
          break;
        case "area":
          zonePriority = 2;
          break;
        case "barangay":
        default:
          zonePriority = 1;
          break;
      }
    }

    // Create new zone
    const zone = new Zone({
      name,
      coordinates,
      color: color || "#3498db",
      description: description || "",
      zoneType: zoneType || "barangay",
      parentZone: parentZone || null,
      priority: zonePriority,
    });

    await zone.save();

    // Populate parent zone for response
    const populatedZone = await Zone.findById(zone._id).populate("parentZone");

    res.status(201).json({
      success: true,
      message: "Zone created successfully",
      zone: populatedZone,
    });
  } catch (error) {
    console.error("Error creating zone:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all zones with hierarchy information
export const getAllZones = async (req, res) => {
  try {
    const { zoneType, parentZone } = req.query;

    let query = {};
    if (zoneType) query.zoneType = zoneType;
    if (parentZone) query.parentZone = parentZone;

    const zones = await Zone.find(query)
      .populate("parentZone")
      .sort({ zoneType: 1, priority: -1, name: 1 });

    res.json({ success: true, zones });
  } catch (error) {
    console.error("Error fetching zones:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get barangay zones only
export const getBarangayZones = async (req, res) => {
  try {
    const barangays = await Zone.find({ zoneType: "barangay" }).sort({
      name: 1,
    });

    res.json({ success: true, zones: barangays });
  } catch (error) {
    console.error("Error fetching barangay zones:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get child zones of a parent zone
export const getChildZones = async (req, res) => {
  try {
    const { parentId } = req.params;

    const childZones = await Zone.findChildZones(parentId);

    res.json({ success: true, zones: childZones });
  } catch (error) {
    console.error("Error fetching child zones:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get zone by ID
export const getZoneById = async (req, res) => {
  try {
    const { id } = req.params;
    const zone = await Zone.findById(id).populate("parentZone");

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found",
      });
    }

    // Also get child zones
    const childZones = await Zone.findChildZones(id);

    res.json({
      success: true,
      zone: {
        ...zone.toObject(),
        childZones,
      },
    });
  } catch (error) {
    console.error("Error fetching zone:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update zone
export const updateZone = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      coordinates,
      color,
      description,
      zoneType,
      parentZone,
      priority,
    } = req.body;

    // Check if zone exists
    const zone = await Zone.findById(id);
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found",
      });
    }

    // Validate parent zone if being changed
    if (parentZone && parentZone !== zone.parentZone?.toString()) {
      const parent = await Zone.findById(parentZone);
      if (!parent) {
        return res.status(400).json({
          success: false,
          message: "Parent zone does not exist",
        });
      }
    }

    // Check if another zone with this name exists
    if (name && name !== zone.name) {
      const existingZone = await Zone.findOne({ name });
      if (existingZone && existingZone._id.toString() !== id) {
        return res.status(400).json({
          success: false,
          message: "Another zone with this name already exists",
        });
      }
    }

    // Update zone
    const updatedZone = await Zone.findByIdAndUpdate(
      id,
      {
        name: name || zone.name,
        coordinates: coordinates || zone.coordinates,
        color: color || zone.color,
        description: description !== undefined ? description : zone.description,
        zoneType: zoneType || zone.zoneType,
        parentZone: parentZone !== undefined ? parentZone : zone.parentZone,
        priority: priority !== undefined ? priority : zone.priority,
      },
      { new: true }
    ).populate("parentZone");

    res.json({
      success: true,
      message: "Zone updated successfully",
      zone: updatedZone,
    });
  } catch (error) {
    console.error("Error updating zone:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete zone
export const deleteZone = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if zone exists
    const zone = await Zone.findById(id);
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found",
      });
    }

    // Check if zone has child zones
    const childZones = await Zone.findChildZones(id);
    if (childZones.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete zone: it has child zones. Delete child zones first.",
      });
    }

    // Check if zone is used in any pricing rules
    const pricingRules = await Pricing.find({
      $or: [{ fromZone: id }, { toZone: id }],
    });

    if (pricingRules.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete zone: it is used in existing pricing rules",
      });
    }

    // Delete zone
    await Zone.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Zone deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting zone:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lookup zone by coordinates
export const lookupZoneByCoordinates = async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    // Validate input parameters
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    // Get the most specific zone for this location
    const zone = await Zone.findMostSpecificZone(lng, lat);

    if (!zone) {
      return res.json({
        success: false,
        message: "No zone found for these coordinates",
        data: null,
      });
    }

    // Also get all zones that contain this point for context
    const allZones = await Zone.findByCoordinates(lng, lat);

    res.json({
      success: true,
      data: zone,
      allMatchingZones: allZones, // For debugging/context
    });
  } catch (error) {
    console.error("Error looking up zone:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// PRICING MANAGEMENT
// Create a new pricing rule
export const createPricing = async (req, res) => {
  try {
    const {
      fromZone,
      toZone,
      amount,
      vehicleType,
      pricingType,
      description,
      priority,
    } = req.body;

    // Validate required fields
    if (
      !fromZone ||
      !toZone ||
      amount === undefined ||
      isNaN(parseFloat(amount))
    ) {
      return res.status(400).json({
        success: false,
        message: "From zone, to zone, and valid amount are required",
      });
    }

    // Check if both zones exist
    const fromZoneExists = await Zone.findById(fromZone);
    const toZoneExists = await Zone.findById(toZone);

    if (!fromZoneExists || !toZoneExists) {
      return res.status(400).json({
        success: false,
        message: "One or both zones do not exist",
      });
    }

    // Check if pricing rule already exists
    const existingRule = await Pricing.findOne({
      fromZone,
      toZone,
      vehicleType: "bao-bao",
    });

    if (existingRule) {
      return res.status(400).json({
        success: false,
        message:
          "A pricing rule for these zones and vehicle type already exists",
      });
    }

    // Create new pricing rule
    const pricing = new Pricing({
      fromZone,
      toZone,
      amount: parseFloat(amount),
      vehicleType: "bao-bao",
      pricingType: pricingType || "fixed",
      description: description || "",
      priority: priority || 1,
    });

    await pricing.save();

    // Populate the zone information for the response
    const populatedPricing = await Pricing.findById(pricing._id)
      .populate("fromZone")
      .populate("toZone");

    res.status(201).json({
      success: true,
      message: "Pricing rule created successfully",
      pricing: populatedPricing,
    });
  } catch (error) {
    console.error("Error creating pricing rule:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all pricing rules
export const getAllPricing = async (req, res) => {
  try {
    const { pricingType, vehicleType } = req.query;

    let query = {};
    if (pricingType) query.pricingType = pricingType;
    if (vehicleType) query.vehicleType = vehicleType;

    const pricing = await Pricing.find(query)
      .populate({
        path: "fromZone",
        populate: { path: "parentZone" },
      })
      .populate({
        path: "toZone",
        populate: { path: "parentZone" },
      })
      .sort({ priority: -1, createdAt: -1 });

    res.json({ success: true, data: pricing });
  } catch (error) {
    console.error("Error fetching pricing rules:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get pricing for specific route with hierarchy consideration
export const getPricingForRoute = async (req, res) => {
  try {
    const { fromZone, toZone } = req.query;

    if (!fromZone || !toZone) {
      return res.status(400).json({
        success: false,
        message: "Both fromZone and toZone are required",
      });
    }

    const pricing = await Pricing.findPricingWithHierarchy(
      fromZone,
      toZone,
      "bao-bao"
    );

    if (!pricing) {
      return res.json({
        success: false,
        message: "No pricing rule found for this route",
        data: null,
      });
    }

    res.json({
      success: true,
      data: pricing,
    });
  } catch (error) {
    console.error("Error fetching pricing for route:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update pricing rule
export const updatePricing = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fromZone,
      toZone,
      amount,
      vehicleType,
      isActive,
      pricingType,
      description,
      priority,
    } = req.body;

    // Check if pricing rule exists
    const pricing = await Pricing.findById(id);
    if (!pricing) {
      return res.status(404).json({
        success: false,
        message: "Pricing rule not found",
      });
    }

    // If fromZone or toZone is being changed, check if they exist
    if (fromZone && fromZone !== pricing.fromZone.toString()) {
      const fromZoneExists = await Zone.findById(fromZone);
      if (!fromZoneExists) {
        return res.status(400).json({
          success: false,
          message: "From zone does not exist",
        });
      }
    }

    if (toZone && toZone !== pricing.toZone.toString()) {
      const toZoneExists = await Zone.findById(toZone);
      if (!toZoneExists) {
        return res.status(400).json({
          success: false,
          message: "To zone does not exist",
        });
      }
    }

    // Update pricing rule
    const updatedPricing = await Pricing.findByIdAndUpdate(
      id,
      {
        fromZone: fromZone || pricing.fromZone,
        toZone: toZone || pricing.toZone,
        amount: amount !== undefined ? parseFloat(amount) : pricing.amount,
        vehicleType: vehicleType || pricing.vehicleType,
        isActive: isActive !== undefined ? isActive : pricing.isActive,
        pricingType: pricingType || pricing.pricingType,
        description:
          description !== undefined ? description : pricing.description,
        priority: priority !== undefined ? priority : pricing.priority,
      },
      { new: true }
    )
      .populate("fromZone")
      .populate("toZone");

    res.json({
      success: true,
      message: "Pricing rule updated successfully",
      pricing: updatedPricing,
    });
  } catch (error) {
    console.error("Error updating pricing rule:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete pricing rule
export const deletePricing = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if pricing rule exists
    const pricing = await Pricing.findById(id);
    if (!pricing) {
      return res.status(404).json({
        success: false,
        message: "Pricing rule not found",
      });
    }

    // Delete pricing rule
    await Pricing.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Pricing rule deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting pricing rule:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
