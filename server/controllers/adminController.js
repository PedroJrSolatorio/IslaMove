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

    // Count pending driver verifications
    const pendingPassengerVerifications = await User.countDocuments({
      role: "passenger",
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
