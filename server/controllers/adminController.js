import User from "../models/User.js";
import Ride from "../models/Ride.js";

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
      pendingPassengerVerifications,
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

// Driver management
// Get all users (including drivers) for admin dashboard
export const getAllDrivers = async (req, res) => {
  try {
    // Fetch all users from the database
    const users = await User.find({})
      .select("-password") // Exclude password field
      .sort({ createdAt: -1 }); // Sort by newest first

    res.status(200).json({
      success: true,
      users: users,
      message: "Users fetched successfully",
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
};

// Verify or reject a driver
export const verifyDriver = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { verificationStatus } = req.body;

    // Validate driver ID
    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid driver ID",
      });
    }

    // Validate verification status
    const validStatuses = ["pending", "under_review", "approved", "rejected"];
    if (!validStatuses.includes(verificationStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid verification status",
      });
    }

    // Find and update the driver
    const driver = await User.findOne({
      _id: driverId,
      role: "driver",
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Update verification status
    driver.verificationStatus = verificationStatus;
    driver.isVerified = verificationStatus === "approved";

    await driver.save();

    res.status(200).json({
      success: true,
      message: `Driver ${verificationStatus} successfully`,
      driver: {
        _id: driver._id,
        firstName: driver.firstName,
        lastName: driver.lastName,
        verificationStatus: driver.verificationStatus,
        isVerified: driver.isVerified,
      },
    });
  } catch (error) {
    console.error("Error verifying driver:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify driver",
      error: error.message,
    });
  }
};

// Block a driver
export const blockDriver = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { reason } = req.body;

    // Validate driver ID
    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid driver ID",
      });
    }

    // Validate block reason
    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Block reason is required",
      });
    }

    // Find and update the driver
    const driver = await User.findOne({
      _id: driverId,
      role: "driver",
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Block the driver
    driver.isBlocked = true;
    driver.blockReason = reason.trim();
    driver.driverStatus = "offline"; // Set driver offline when blocked

    await driver.save();

    res.status(200).json({
      success: true,
      message: "Driver blocked successfully",
      driver: {
        _id: driver._id,
        firstName: driver.firstName,
        lastName: driver.lastName,
        isBlocked: driver.isBlocked,
        blockReason: driver.blockReason,
      },
    });
  } catch (error) {
    console.error("Error blocking driver:", error);
    res.status(500).json({
      success: false,
      message: "Failed to block driver",
      error: error.message,
    });
  }
};

// Unblock a driver
export const unblockDriver = async (req, res) => {
  try {
    const { driverId } = req.params;

    // Validate driver ID
    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid driver ID",
      });
    }

    // Find and update the driver
    const driver = await User.findOne({
      _id: driverId,
      role: "driver",
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    if (!driver.isBlocked) {
      return res.status(400).json({
        success: false,
        message: "Driver is not blocked",
      });
    }

    // Unblock the driver
    driver.isBlocked = false;
    driver.blockReason = "";

    await driver.save();

    res.status(200).json({
      success: true,
      message: "Driver unblocked successfully",
      driver: {
        _id: driver._id,
        firstName: driver.firstName,
        lastName: driver.lastName,
        isBlocked: driver.isBlocked,
      },
    });
  } catch (error) {
    console.error("Error unblocking driver:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unblock driver",
      error: error.message,
    });
  }
};

// Send warning to driver
export const sendWarningToDriver = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { message } = req.body;

    // Validate driver ID
    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid driver ID",
      });
    }

    // Validate warning message
    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Warning message is required",
      });
    }

    // Find the driver
    const driver = await User.findOne({
      _id: driverId,
      role: "driver",
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Add warning to driver's warnings array
    const warning = {
      message: message.trim(),
      Date: new Date(),
      readStatus: false,
    };

    driver.warnings.push(warning);
    await driver.save();

    res.status(200).json({
      success: true,
      message: "Warning sent to driver successfully",
      warning: warning,
    });
  } catch (error) {
    console.error("Error sending warning:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send warning",
      error: error.message,
    });
  }
};

// Verify driver document
export const verifyDriverDocument = async (req, res) => {
  try {
    const { driverId, documentIndex } = req.params;

    // Validate driver ID
    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid driver ID",
      });
    }

    // Validate document index
    const docIndex = parseInt(documentIndex);
    if (isNaN(docIndex) || docIndex < 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid document index",
      });
    }

    // Find the driver
    const driver = await User.findOne({
      _id: driverId,
      role: "driver",
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    // Check if document exists
    if (!driver.documents || !driver.documents[docIndex]) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
    }

    // Verify the document
    driver.documents[docIndex].verified = true;
    await driver.save();

    res.status(200).json({
      success: true,
      message: "Document verified successfully",
      document: driver.documents[docIndex],
    });
  } catch (error) {
    console.error("Error verifying document:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify document",
      error: error.message,
    });
  }
};

// Passenger management
// Get all passengers
export const getPassengers = async (req, res) => {
  try {
    const passengers = await User.find({ role: "passenger" })
      .select("-password") // Exclude password field
      .sort({ createdAt: -1 }); // Sort by newest first

    res.status(200).json({
      success: true,
      message: "Passengers retrieved successfully",
      passengers,
      count: passengers.length,
    });
  } catch (error) {
    console.error("Error fetching passengers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch passengers",
      error: error.message,
    });
  }
};

// Send warning to passenger
export const sendWarningToPassenger = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const adminId = req.user.id; // From adminAuth middleware

    // Validate input
    if (!message || message.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Warning message is required",
      });
    }

    // Validate passenger ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid passenger ID",
      });
    }

    // Find the passenger
    const passenger = await User.findOne({ _id: id, role: "passenger" });
    if (!passenger) {
      return res.status(404).json({
        success: false,
        message: "Passenger not found",
      });
    }

    // Add warning to passenger's warnings array
    const newWarning = {
      message: message.trim(),
      Date: new Date(),
      readStatus: false,
    };

    passenger.warnings.push(newWarning);
    await passenger.save();

    // Optional: You can also create a notification record here
    // await createNotification(passenger._id, 'warning', message);

    res.status(200).json({
      success: true,
      message: "Warning sent successfully",
      warning: newWarning,
    });
  } catch (error) {
    console.error("Error sending warning:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send warning",
      error: error.message,
    });
  }
};

// Block passenger
export const blockPassenger = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id; // From adminAuth middleware

    // Validate input
    if (!reason || reason.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Block reason is required",
      });
    }

    // Validate passenger ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid passenger ID",
      });
    }

    // Find the passenger
    const passenger = await User.findOne({ _id: id, role: "passenger" });
    if (!passenger) {
      return res.status(404).json({
        success: false,
        message: "Passenger not found",
      });
    }

    // Check if passenger is already blocked
    if (passenger.isBlocked) {
      return res.status(400).json({
        success: false,
        message: "Passenger is already blocked",
      });
    }

    // Block the passenger
    passenger.isBlocked = true;
    passenger.blockReason = reason.trim();
    await passenger.save();

    // Optional: Cancel any active rides for this passenger
    // await cancelActiveRides(passenger._id);

    // Optional: Send notification to passenger
    // await createNotification(passenger._id, 'blocked', reason);

    res.status(200).json({
      success: true,
      message: "Passenger blocked successfully",
      passenger: {
        _id: passenger._id,
        firstName: passenger.firstName,
        lastName: passenger.lastName,
        email: passenger.email,
        isBlocked: passenger.isBlocked,
        blockReason: passenger.blockReason,
      },
    });
  } catch (error) {
    console.error("Error blocking passenger:", error);
    res.status(500).json({
      success: false,
      message: "Failed to block passenger",
      error: error.message,
    });
  }
};

// Unblock passenger
export const unblockPassenger = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id; // From adminAuth middleware

    // Validate passenger ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid passenger ID",
      });
    }

    // Find the passenger
    const passenger = await User.findOne({ _id: id, role: "passenger" });
    if (!passenger) {
      return res.status(404).json({
        success: false,
        message: "Passenger not found",
      });
    }

    // Check if passenger is actually blocked
    if (!passenger.isBlocked) {
      return res.status(400).json({
        success: false,
        message: "Passenger is not blocked",
      });
    }

    // Unblock the passenger
    passenger.isBlocked = false;
    passenger.blockReason = "";
    await passenger.save();

    // Optional: Send notification to passenger
    // await createNotification(passenger._id, 'unblocked', 'Your account has been unblocked');

    res.status(200).json({
      success: true,
      message: "Passenger unblocked successfully",
      passenger: {
        _id: passenger._id,
        firstName: passenger.firstName,
        lastName: passenger.lastName,
        email: passenger.email,
        isBlocked: passenger.isBlocked,
        blockReason: passenger.blockReason,
      },
    });
  } catch (error) {
    console.error("Error unblocking passenger:", error);
    res.status(500).json({
      success: false,
      message: "Failed to unblock passenger",
      error: error.message,
    });
  }
};

// Verify passenger ID
export const verifyPassengerId = async (req, res) => {
  try {
    const { id } = req.params;
    const { verified } = req.body;
    const adminId = req.user.id; // From adminAuth middleware

    // Validate input
    if (typeof verified !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Verified status must be true or false",
      });
    }

    // Validate passenger ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid passenger ID",
      });
    }

    // Find the passenger
    const passenger = await User.findOne({ _id: id, role: "passenger" });
    if (!passenger) {
      return res.status(404).json({
        success: false,
        message: "Passenger not found",
      });
    }

    // Check if passenger has an ID document
    if (!passenger.idDocument || !passenger.idDocument.imageUrl) {
      return res.status(400).json({
        success: false,
        message: "Passenger has no ID document to verify",
      });
    }

    // Update ID verification status
    passenger.idDocument.verified = verified;
    passenger.idDocument.verifiedAt = verified ? new Date() : null;
    passenger.idDocument.verifiedBy = verified ? adminId : null;

    // Update overall verification status
    if (verified) {
      passenger.verificationStatus = "approved";
      passenger.isVerified = true;
    } else {
      passenger.verificationStatus = "rejected";
      passenger.isVerified = false;
    }

    await passenger.save();

    // Optional: Send notification to passenger about verification result
    const notificationMessage = verified
      ? "Your ID has been verified successfully"
      : "Your ID verification was rejected. Please submit a valid ID document.";

    // await createNotification(passenger._id, 'id_verification', notificationMessage);

    res.status(200).json({
      success: true,
      message: `ID ${verified ? "approved" : "rejected"} successfully`,
      passenger: {
        _id: passenger._id,
        firstName: passenger.firstName,
        lastName: passenger.lastName,
        email: passenger.email,
        verificationStatus: passenger.verificationStatus,
        isVerified: passenger.isVerified,
        idDocument: {
          type: passenger.idDocument.type,
          verified: passenger.idDocument.verified,
          verifiedAt: passenger.idDocument.verifiedAt,
        },
      },
    });
  } catch (error) {
    console.error("Error verifying passenger ID:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify passenger ID",
      error: error.message,
    });
  }
};

// Helper function to get passenger statistics (optional)
export const getPassengerStats = async (req, res) => {
  try {
    const totalPassengers = await User.countDocuments({ role: "passenger" });
    const blockedPassengers = await User.countDocuments({
      role: "passenger",
      isBlocked: true,
    });
    const verifiedPassengers = await User.countDocuments({
      role: "passenger",
      isVerified: true,
    });
    const pendingVerification = await User.countDocuments({
      role: "passenger",
      verificationStatus: { $in: ["pending", "under_review"] },
    });
    const lowRatedPassengers = await User.countDocuments({
      role: "passenger",
      rating: { $lt: 3.5 },
      isBlocked: false,
    });

    // Get passenger category breakdown
    const categoryStats = await User.aggregate([
      { $match: { role: "passenger" } },
      {
        $group: {
          _id: "$passengerCategory",
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      stats: {
        total: totalPassengers,
        blocked: blockedPassengers,
        verified: verifiedPassengers,
        pendingVerification,
        lowRated: lowRatedPassengers,
        categoryBreakdown: categoryStats,
      },
    });
  } catch (error) {
    console.error("Error fetching passenger statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch passenger statistics",
      error: error.message,
    });
  }
};

export const approveProfileImage = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);

    if (!user || !user.pendingProfileImage) {
      return res
        .status(400)
        .json({ error: "No pending profile image to approve" });
    }

    // Delete old image if it exists
    if (user.profileImage) {
      try {
        const uploadsDir = path.resolve(process.cwd(), "uploads", "profiles");
        const oldFilename = path.basename(user.profileImage);
        const oldFilePath = path.join(uploadsDir, oldFilename);
        if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
      } catch (err) {
        console.error(
          "Failed to delete old profile image during approval:",
          err
        );
      }
    }

    // Promote pending to active
    user.profileImage = user.pendingProfileImage;
    user.pendingProfileImage = null;
    await user.save();

    return res.json({
      success: true,
      message: "Profile image approved",
      imageUrl: user.profileImage,
    });
  } catch (error) {
    console.error("Error approving profile image:", error);
    res.status(500).json({ error: "Failed to approve image" });
  }
};

export const rejectProfileImage = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);

    if (!user || !user.pendingProfileImage) {
      return res
        .status(400)
        .json({ error: "No pending profile image to reject" });
    }

    const uploadsDir = path.resolve(process.cwd(), "uploads", "profiles");
    const pendingFilename = path.basename(user.pendingProfileImage);
    const pendingFilePath = path.join(uploadsDir, pendingFilename);

    if (fs.existsSync(pendingFilePath)) {
      fs.unlinkSync(pendingFilePath);
    }

    user.pendingProfileImage = null;
    await user.save();

    return res.json({
      success: true,
      message: "Profile image rejected and deleted",
    });
  } catch (error) {
    console.error("Error rejecting profile image:", error);
    res.status(500).json({ error: "Failed to reject image" });
  }
};
