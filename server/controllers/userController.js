import User from "../models/User.js";
import Ride from "../models/Ride.js";
import UserAgreement from "../models/UserAgreement.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getUserByEmail = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user)
      return res
        .status(404)
        .json({ error: "User not found in getUserByEmail" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Error fetching user" });
  }
};

export const getProfileById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("+password");
    if (!user)
      return res
        .status(404)
        .json({ error: "User not found in getProfileById" });

    // 2. Determine if the user has a password set
    const hasPassword = !!user.password;

    // 3. Convert the Mongoose document to a plain JavaScript object
    const userObject = user.toObject();

    // 4. Remove the password field from the object before sending
    delete userObject.password;

    // 5. Add the hasPassword flag
    userObject.hasPassword = hasPassword;

    // 6. Send the modified user object in the response
    res.json(userObject);
  } catch (error) {
    console.error("Error fetching profile:", error);
    // Handle CastError for invalid IDs gracefully
    if (error.name === "CastError") {
      return res.status(400).json({ error: "Invalid user ID" });
    }
    res.status(500).json({ error: "Error fetching user" });
  }
};

export const uploadProfileImage = async (req, res) => {
  let uploadedFilePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Store the file path for cleanup if needed
    uploadedFilePath = req.file.path;

    const userId = req.params.id;
    const user = await User.findById(userId);

    if (!user) {
      // Clean up uploaded file before returning error
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        fs.unlinkSync(uploadedFilePath);
      }
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent upload if a pending image already exists
    if (
      user.pendingProfileImage &&
      user.pendingProfileImage.status === "pending"
    ) {
      // Clean up uploaded file before returning error
      if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        fs.unlinkSync(uploadedFilePath);
      }
      return res.status(403).json({
        error:
          "A profile image is already pending approval. You cannot upload another.",
      });
    }

    // Save file as a pending image
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/profiles/${
      req.file.filename
    }`;

    user.pendingProfileImage = {
      imageUrl: fileUrl,
      uploadedAt: new Date(),
      status: "pending",
    };

    // Save with validation disabled for other fields
    await user.save({ validateModifiedOnly: true });

    return res.json({
      success: true,
      message: "Profile image uploaded and pending admin approval.",
      pendingImageUrl: fileUrl,
    });
  } catch (error) {
    console.error("Error uploading profile image:", error);
    // Clean up uploaded file on any error
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try {
        fs.unlinkSync(uploadedFilePath);
        console.log("Cleaned up uploaded file due to error:", uploadedFilePath);
      } catch (cleanupError) {
        console.error("Failed to clean up uploaded file:", cleanupError);
      }
    }
    return res.status(500).json({ error: "Failed to upload image" });
  }
};

export const reviewProfileImage = async (req, res) => {
  try {
    const { userId } = req.params;
    const { action, rejectionReason } = req.body; // action: "approve" or "reject"
    const adminId = req.user.id; // Assuming admin ID is available in req.user

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (
      !user.pendingProfileImage ||
      user.pendingProfileImage.status !== "pending"
    ) {
      return res
        .status(400)
        .json({ error: "No pending profile image to review" });
    }

    if (action === "approve") {
      // Move pending image to active profile image
      user.profileImage = user.pendingProfileImage.imageUrl;
      user.pendingProfileImage.status = "approved";
      user.pendingProfileImage.reviewedAt = new Date();
      user.pendingProfileImage.reviewedBy = adminId;

      await user.save();

      return res.json({
        message: "Profile image approved successfully",
        profileImage: user.profileImage,
      });
    } else if (action === "reject") {
      user.pendingProfileImage.status = "rejected";
      user.pendingProfileImage.reviewedAt = new Date();
      user.pendingProfileImage.reviewedBy = adminId;
      if (rejectionReason) {
        user.pendingProfileImage.rejectionReason = rejectionReason;
      }

      await user.save();

      return res.json({
        message: "Profile image rejected",
        rejectionReason: rejectionReason || "No reason provided",
      });
    } else {
      return res
        .status(400)
        .json({ error: "Invalid action. Use 'approve' or 'reject'" });
    }
  } catch (error) {
    console.error("Error reviewing profile image:", error);
    return res.status(500).json({ error: "Failed to review profile image" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.params.id;
    const updateData = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found in updateProfile" });
    }

    // Check if this is a password update request
    if (updateData.currentPassword && updateData.newPassword) {
      // Verify current password
      const isMatch = await bcrypt.compare(
        updateData.currentPassword,
        user.password
      );
      if (!isMatch) {
        return res.status(400).json({ error: "Incorrect current password" });
      }

      // Hash the new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(updateData.newPassword, salt);

      // Update password using findByIdAndUpdate
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: { password: hashedPassword } },
        { new: true, runValidators: true }
      );

      // Return success response
      return res.json({
        message: "Password updated successfully",
        user: {
          _id: updatedUser._id,
          username: updatedUser.username,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          email: updatedUser.email,
        },
      });
    }

    // Prevent editing of non-editable fields (but allow viewing)
    const nonEditableFields = [
      "birthdate",
      "age",
      "licenseNumber",
      "idDocument",
      "profileImage", // Users can't directly edit this - must go through upload process
      "pendingProfileImage", // Users can't directly edit this
      "verificationStatus",
    ];

    const attemptedNonEditableFields = nonEditableFields.filter((field) =>
      updateData.hasOwnProperty(field)
    );

    if (attemptedNonEditableFields.length > 0) {
      return res.status(400).json({
        error: `The following fields cannot be modified: ${attemptedNonEditableFields.join(
          ", "
        )}`,
        details: "These fields are read-only or require admin approval",
      });
    }

    // Prevent role changes through this endpoint
    if (updateData.role && updateData.role !== user.role) {
      return res.status(400).json({
        error: "Role cannot be changed through profile update",
      });
    }

    // Check if username changed and if it's taken by another user
    if (updateData.username && updateData.username !== user.username) {
      const existingUsername = await User.findOne({
        username: updateData.username,
        _id: { $ne: userId },
      });

      if (existingUsername) {
        return res.status(400).json({ error: "Username already taken" });
      }
    }

    // Check if email changed and if it's used by another user
    if (updateData.email && updateData.email !== user.email) {
      const existingEmail = await User.findOne({
        email: updateData.email,
        _id: { $ne: userId },
      });

      if (existingEmail) {
        return res.status(400).json({ error: "Email already registered" });
      }
    }

    // Check if phone changed and if it's used by another user
    if (updateData.phone && updateData.phone !== user.phone) {
      const existingPhone = await User.findOne({
        phone: updateData.phone,
        _id: { $ne: userId },
      });

      if (existingPhone) {
        return res
          .status(400)
          .json({ error: "Phone number already registered" });
      }
    }

    // Build the update object based on user role and allowed fields
    const updateObject = {};

    // Update basic user fields (available to all roles)
    const basicFields = [
      "firstName",
      "lastName",
      "middleInitial",
      "username",
      "email",
      "phone",
      "currentLocation",
    ];
    basicFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        updateObject[field] = updateData[field];
      }
    });

    // Role-specific field updates
    if (user.role === "passenger") {
      // Passenger-specific fields
      if (updateData.savedAddresses !== undefined) {
        updateObject.savedAddresses = updateData.savedAddresses;
      }
      if (updateData.passengerCategory !== undefined) {
        updateObject.passengerCategory = updateData.passengerCategory;
      }
      // Fields available to both passenger and driver
      if (updateData.homeAddress !== undefined) {
        updateObject.homeAddress = updateData.homeAddress;
      }
    } else if (user.role === "driver") {
      // Driver-specific fields
      if (updateData.driverStatus !== undefined) {
        updateObject.driverStatus = updateData.driverStatus;
      }
      if (updateData.vehicle !== undefined) {
        updateObject.vehicle = updateData.vehicle;
      }
      if (updateData.documents !== undefined) {
        updateObject.documents = updateData.documents;
      }
      // Fields available to both passenger and driver
      if (updateData.homeAddress !== undefined) {
        updateObject.homeAddress = updateData.homeAddress;
      }
    } else if (user.role === "admin") {
      // Admin users cannot update homeAddress or idDocument
      if (updateData.homeAddress) {
        return res.status(400).json({
          error: "Admin users cannot have home address",
        });
      }
    }

    // Prevent unauthorized role-specific field updates
    if (user.role !== "passenger") {
      if (updateData.savedAddresses || updateData.passengerCategory) {
        return res.status(400).json({
          error:
            "Only passengers can update saved addresses and passenger category",
        });
      }
    }

    if (user.role !== "driver") {
      if (
        updateData.driverStatus ||
        updateData.vehicle ||
        updateData.documents
      ) {
        return res.status(400).json({
          error: "Only drivers can update driver-specific fields",
        });
      }
    }

    // Check if there are any fields to update
    if (Object.keys(updateObject).length === 0) {
      return res.status(400).json({
        error: "No valid fields to update",
      });
    }

    // Use findByIdAndUpdate to update only the specified fields
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateObject },
      {
        new: true, // Return the updated document
        runValidators: true, // Run validators only on updated fields
        context: "query", // Ensures validators run in query context
      }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found during update" });
    }

    // Return the updated user data (excluding password)
    const userResponse = updatedUser.toObject();
    delete userResponse.password;

    res.json({
      message: "Profile updated successfully",
      user: userResponse,
    });
  } catch (error) {
    console.error("Error updating profile:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message
      );
      return res.status(400).json({
        error: "Validation failed",
        details: validationErrors,
      });
    }

    res.status(500).json({ error: "Failed to update profile" });
  }
};

export const getAddresses = async (req, res) => {
  console.log("Params:", req.params);
  const userId = req.params.id;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  const user = await User.findById(userId).select("savedAddresses").lean();

  if (!user) {
    return res
      .status(404)
      .json({ message: "User not found in controller const user" });
  }

  res.json({ success: true, data: user.savedAddresses || [] });
};

export const addNewAddress = async (req, res) => {
  try {
    const userId = req.params.id;
    const { address } = req.body;

    // Validate input
    if (
      !address ||
      !address.label ||
      !address.address ||
      !address.location ||
      !Array.isArray(address.location.coordinates)
    ) {
      return res.status(400).json({
        error: "Address must include label, address, and location", // Make sure error message matches validation
      });
    }

    // Build the new address object according to schema
    const newAddress = {
      label: address.label,
      address: address.address, // This should match your schema
      location: {
        type: "Point",
        coordinates: address.location.coordinates,
        address: address.location.address || address.address,
        mainText: address.location.mainText || "",
        secondaryText: address.location.secondaryText || "",
      },
    };

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.savedAddresses.push(newAddress);
    await user.save();

    res.status(200).json({
      message: "Address added successfully.",
      savedAddresses: user.savedAddresses,
    });
  } catch (error) {
    console.error("Error adding address:", error);
    res.status(500).json({ error: "Failed to add address" });
  }
};

export const updateAddresses = async (req, res) => {
  try {
    const userId = req.params.id;
    const { savedAddresses } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const validatedAddresses = savedAddresses.map((address) => ({
      label: address.label,
      address: address.address,
      location: address.location || {
        type: "Point",
        coordinates: address.location?.coordinates || [0, 0],
        address: address.location?.address || address.address,
      },
    }));

    // Update saved addresses
    user.savedAddresses = validatedAddresses;

    // Save the updated user
    const updatedUser = await user.save();

    // Return just the updated addresses
    res.json({ savedAddresses: updatedUser.savedAddresses });
  } catch (error) {
    console.error("Error updating addresses:", error);
    res.status(500).json({ error: "Failed to update addresses" });
  }
};

export const removeAddress = async (req, res) => {
  try {
    const userId = req.params.id;
    const addressIndex = parseInt(req.params.addressIndex);

    // Validate index
    if (isNaN(addressIndex) || addressIndex < 0) {
      return res.status(400).json({ error: "Invalid address index" });
    }

    // Find the user first to check if the address exists
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.savedAddresses || addressIndex >= user.savedAddresses.length) {
      return res.status(404).json({ error: "Address not found" });
    }

    // Remove the address at the specified index
    user.savedAddresses.splice(addressIndex, 1);
    await user.save();

    res.json({
      message: "Address removed successfully",
      savedAddresses: user.savedAddresses,
    });
  } catch (error) {
    console.error("Error removing address:", error);
    res.status(500).json({ error: "Failed to remove address" });
  }
};

// Verify account deletion with password/Google
export const verifyAccountDeletion = async (req, res) => {
  try {
    const userId = req.params.id;
    const { password, googleIdToken, reason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if user already has a pending deletion
    if (user.deletionRequested) {
      const daysRemaining = Math.ceil(
        (user.deletionScheduledFor - new Date()) / (1000 * 60 * 60 * 24)
      );
      return res.status(400).json({
        error: "Account deletion already requested",
        scheduledFor: user.deletionScheduledFor,
        daysRemaining: Math.max(0, daysRemaining),
      });
    }

    // Verify authentication
    if (user.isGoogleUser) {
      if (!googleIdToken) {
        return res.status(400).json({
          error: "Google authentication required",
          requiresGoogle: true,
        });
      }

      try {
        // Verify Google ID token
        const payload = jwt.decode(googleIdToken);
        if (!payload || payload.email !== user.email) {
          return res
            .status(400)
            .json({ error: "Invalid Google authentication" });
        }
      } catch (error) {
        return res.status(400).json({ error: "Invalid Google authentication" });
      }
    } else {
      if (!password) {
        return res.status(400).json({
          error: "Password required",
          requiresPassword: true,
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: "Invalid password" });
      }
    }

    // Set deletion request with 30-day grace period
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30); // 30 days from now, comment this to set date as today

    user.deletionRequested = true;
    user.deletionRequestedAt = new Date();
    user.deletionScheduledFor = deletionDate;
    user.deletionReason = reason || "User requested account deletion";

    await user.save();

    res.json({
      message: "Account deletion verified and scheduled",
      scheduledFor: deletionDate,
      daysRemaining: 30,
      note: "Your account will be permanently deleted in 30 days. You can cancel this by logging in before the deletion date. All your data will be permanently removed.",
    });
  } catch (error) {
    console.error("Error verifying account deletion:", error);
    res.status(500).json({ error: "Failed to verify account deletion" });
  }
};

// cleanup job (you can run this daily via cron job)
export const processScheduledDeletions = async () => {
  try {
    const now = new Date();

    // Find users scheduled for deletion
    const usersToDelete = await User.find({
      deletionRequested: true,
      deletionScheduledFor: { $lte: now },
    });

    console.log(`Found ${usersToDelete.length} users to delete`);

    for (const user of usersToDelete) {
      try {
        console.log(
          `Starting deletion process for user: ${user.email} (${user._id})`
        );

        // 1. Delete user's profile and document images
        await deleteUserFiles(user);

        // 2. ANONYMIZE rides instead of deleting them
        await anonymizeUserRides(user._id);

        // 3. Remove user from ride queues and update ride references
        await cleanupRideReferences(user._id);

        // 4. Delete user agreements
        const agreementsDeleted = await UserAgreement.deleteMany({
          userId: user._id,
        });
        console.log(
          `Deleted ${agreementsDeleted.deletedCount} user agreements for user ${user._id}`
        );

        // 5. Delete the user
        const deletedUser = await User.findByIdAndDelete(user._id);
        if (deletedUser) {
          console.log(
            `[DEBUG] Successfully deleted user: ${user.email} (${user._id})`
          );
        } else {
          console.log(
            `[DEBUG] Failed to delete user: ${user.email} (${user._id}) - User not found`
          );
        }
      } catch (error) {
        console.error(`Failed to delete user ${user._id}:`, error);
        // Continue with other users even if one fails
      }
    }
    if (usersToDelete.length > 0) {
      console.log(
        `Completed deletion process for ${usersToDelete.length} users`
      );
    }
  } catch (error) {
    console.error("Error processing scheduled deletions:", error);
  }
};

// Anonymize user rides instead of deleting them
const anonymizeUserRides = async (userId) => {
  try {
    console.log(`Anonymizing rides for user ${userId}`);

    // Update rides where user was the passenger
    const passengerRidesUpdated = await Ride.updateMany(
      { passenger: userId },
      {
        $set: {
          passenger: null, // Set to null to indicate deleted user
          passengerRating: null,
          passengerFeedback: "[User deleted]",
        },
      }
    );

    // Update rides where user was the driver
    const driverRidesUpdated = await Ride.updateMany(
      { driver: userId },
      {
        $set: {
          driver: null, // Set to null to indicate deleted user
          driverRating: null,
          driverFeedback: "[User deleted]",
          driverLocationUpdates: [], // Clear location history
        },
      }
    );

    console.log(
      `Anonymized ${passengerRidesUpdated.modifiedCount} passenger rides`
    );
    console.log(`Anonymized ${driverRidesUpdated.modifiedCount} driver rides`);
  } catch (error) {
    console.error(`Error anonymizing rides for user ${userId}:`, error);
  }
};

// Helper function to delete user files (photos and documents)
const deleteUserFiles = async (user) => {
  const filesToDelete = [];

  try {
    // 1. Current profile image
    if (user.profileImage) {
      const profileImagePath = extractFilePath(user.profileImage);
      if (profileImagePath) {
        filesToDelete.push(profileImagePath);
      }
    }

    // 2. Pending profile image
    if (user.pendingProfileImage && user.pendingProfileImage.imageUrl) {
      const pendingImagePath = extractFilePath(
        user.pendingProfileImage.imageUrl
      );
      if (pendingImagePath) {
        filesToDelete.push(pendingImagePath);
      }
    }

    // 3. ID document image
    if (user.idDocument && user.idDocument.imageUrl) {
      const idDocPath = extractFilePath(user.idDocument.imageUrl);
      if (idDocPath) {
        filesToDelete.push(idDocPath);
      }
    }

    // 4. Driver documents (if user is a driver)
    if (user.role === "driver" && user.documents && user.documents.length > 0) {
      user.documents.forEach((doc) => {
        if (doc.fileURL) {
          const docPath = extractFilePath(doc.fileURL);
          if (docPath) {
            filesToDelete.push(docPath);
          }
        }
      });
    }

    // Delete all collected files
    for (const filePath of filesToDelete) {
      try {
        const fullPath = path.join(__dirname, "..", filePath);
        if (fs.existsSync(fullPath)) {
          await fs.promises.unlink(fullPath);
          console.log(`Deleted file: ${filePath}`);
        }
      } catch (fileError) {
        console.error(`Failed to delete file ${filePath}:`, fileError);
        // Continue with other files
      }
    }

    console.log(`Deleted ${filesToDelete.length} files for user ${user._id}`);
  } catch (error) {
    console.error(`Error deleting files for user ${user._id}:`, error);
  }
};

// Helper function to extract file path from URL
const extractFilePath = (fileUrl) => {
  if (!fileUrl) return null;

  try {
    // Extract the path after the domain
    // e.g., "http://localhost:5000/uploads/profiles/123456.jpg" -> "uploads/profiles/123456.jpg"
    const url = new URL(fileUrl);
    return url.pathname.startsWith("/")
      ? url.pathname.substring(1)
      : url.pathname;
  } catch (error) {
    console.error(`Invalid file URL: ${fileUrl}`, error);
    return null;
  }
};

// Helper function to clean up ride references
const cleanupRideReferences = async (userId) => {
  try {
    console.log(`Cleaning up ride references for user ${userId}`);

    // 1. Remove from driver queues (all rides, not just active)
    const queueCleanup = await Ride.updateMany(
      { driverQueue: userId },
      { $pull: { driverQueue: userId } }
    );

    // 2. Remove from skipped drivers (all rides)
    const skippedCleanup = await Ride.updateMany(
      { skippedDrivers: userId },
      { $pull: { skippedDrivers: userId } }
    );

    // 3. Cancel active rides where the deleted user was passenger or driver
    const activeStatuses = [
      "requested",
      "searching",
      "accepted",
      "arrived",
      "inProgress",
    ];

    const cancelledRides = await Ride.updateMany(
      {
        $or: [{ passenger: userId }, { driver: userId }],
        status: { $in: activeStatuses },
      },
      {
        $set: {
          status: "cancelled",
          cancellationReason: "User account deleted",
          cancellationInitiator: "system",
          cancellationTime: new Date(),
        },
      }
    );
    // 4. Verification step - check for any remaining references
    const remainingQueueRefs = await Ride.countDocuments({
      driverQueue: userId,
    });
    const remainingSkippedRefs = await Ride.countDocuments({
      skippedDrivers: userId,
    });

    if (remainingQueueRefs > 0 || remainingSkippedRefs > 0) {
      console.warn(`⚠️  Cleanup incomplete for user ${userId}:`, {
        remainingQueueRefs,
        remainingSkippedRefs,
      });
    }

    console.log(`✅ Cleanup completed for user ${userId}:`, {
      queueUpdates: queueCleanup.modifiedCount,
      skippedUpdates: skippedCleanup.modifiedCount,
      cancelledRides: cancelledRides.modifiedCount,
      remainingReferences: remainingQueueRefs + remainingSkippedRefs,
    });
  } catch (error) {
    console.error(
      `Error cleaning up ride references for user ${userId}:`,
      error
    );
  }
};

// Function to process age transitions and category updates
export const processAgeTransitions = async () => {
  try {
    const today = new Date();

    // Find all passengers who might need age/category updates
    const passengers = await User.find({
      role: "passenger",
      birthdate: { $exists: true },
      deletionRequested: { $ne: true },
    });

    let updatedCount = 0;

    for (const passenger of passengers) {
      // Calculate current age
      const birthDate = new Date(passenger.birthdate);
      let currentAge = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birthDate.getDate())
      ) {
        currentAge--;
      }

      // Check if age has changed
      if (passenger.age !== currentAge) {
        const previousAge = passenger.age;
        const previousCategory = passenger.passengerCategory;
        let categoryChanged = false;
        let newCategory = passenger.passengerCategory;

        // Handle specific age transitions
        if (previousAge === 12 && currentAge === 13) {
          // Transition from student_child to student
          if (passenger.passengerCategory === "student_child") {
            newCategory = "student";
            categoryChanged = true;
          }
        }

        // Handle transition to senior eligibility at age 60
        if (currentAge === 60 && passenger.passengerCategory !== "senior") {
          // Create notification/flag for senior eligibility
          // Don't auto-change to senior - let them choose via category change modal
          passenger.seniorEligibilityNotification = {
            eligible: true,
            notificationDate: today,
            acknowledged: false,
          };

          console.log(
            `Passenger ${passenger._id} is now eligible for senior category at age ${currentAge}`
          );
        }

        // Update age
        passenger.age = currentAge;
        passenger.passengerCategory = newCategory;

        // Record age transition
        passenger.ageTransitions.push({
          fromAge: previousAge,
          toAge: currentAge,
          transitionDate: today,
          categoryChanged: categoryChanged,
          previousCategory: previousCategory,
          newCategory: categoryChanged ? newCategory : undefined,
        });

        // Set school ID validation requirement for 19+ students
        if (currentAge === 19 && passenger.passengerCategory === "student") {
          const currentYear = today.getFullYear();
          const augustDeadline = new Date(currentYear, 7, 31); // August 31st

          passenger.schoolIdValidation = {
            currentSchoolYear: `${currentYear}-${currentYear + 1}`,
            expirationDate: augustDeadline,
            validated: false,
            reminderSent: false,
          };
        }

        await passenger.save();
        updatedCount++;

        console.log(
          `Updated passenger ${passenger._id}: ${previousAge} → ${currentAge}${
            categoryChanged
              ? `, category: ${previousCategory} → ${newCategory}`
              : ""
          }`
        );
      }
    }

    console.log(
      `Age transitions processed: ${updatedCount} passengers updated`
    );
    return { success: true, updatedCount };
  } catch (error) {
    console.error("Error processing age transitions:", error);
    throw error;
  }
};

// Function to send senior eligibility notifications
export const processSeniorEligibilityNotifications = async () => {
  try {
    const today = new Date();

    // Find passengers who are eligible for senior category but haven't been notified
    const eligiblePassengers = await User.find({
      role: "passenger",
      age: { $gte: 60 },
      passengerCategory: { $in: ["regular", "student"] },
      "seniorEligibilityNotification.acknowledged": { $ne: true },
      deletionRequested: { $ne: true },
    });

    let notificationCount = 0;

    for (const passenger of eligiblePassengers) {
      // Set or update senior eligibility notification
      if (!passenger.seniorEligibilityNotification) {
        passenger.seniorEligibilityNotification = {
          eligible: true,
          notificationDate: today,
          acknowledged: false,
        };

        await passenger.save();
        notificationCount++;

        console.log(
          `Set senior eligibility notification for passenger ${passenger._id} (age: ${passenger.age})`
        );
      }
    }

    console.log(
      `Senior eligibility notifications processed: ${notificationCount} passengers notified`
    );
    return { success: true, notificationCount };
  } catch (error) {
    console.error("Error processing senior eligibility notifications:", error);
    throw error;
  }
};

// Function to handle school ID validation requirements
export const processSchoolIdValidations = async () => {
  try {
    const today = new Date();
    const currentYear = today.getFullYear();
    const augustDeadline = new Date(currentYear, 7, 31); // August 31st of current year

    // Find students 19+ who need school ID validation
    const studentsNeedingValidation = await User.find({
      role: "passenger",
      passengerCategory: "student",
      age: { $gte: 19 },
      deletionRequested: { $ne: true },
      $or: [
        // No school ID validation record
        { schoolIdValidation: { $exists: false } },
        // Expired validation
        {
          "schoolIdValidation.expirationDate": { $lt: today },
          "schoolIdValidation.validated": false,
        },
        // Validation for previous school year
        {
          "schoolIdValidation.currentSchoolYear": {
            $ne: `${currentYear}-${currentYear + 1}`,
          },
        },
      ],
    });

    let updatedCount = 0;

    for (const student of studentsNeedingValidation) {
      // Set or update school ID validation requirement
      student.schoolIdValidation = {
        currentSchoolYear: `${currentYear}-${currentYear + 1}`,
        expirationDate: augustDeadline,
        validated: false,
        reminderSent: false,
        // Preserve existing validation data if it exists
        ...(student.schoolIdValidation && student.schoolIdValidation.validated
          ? {
              lastUploadDate: student.schoolIdValidation.lastUploadDate,
            }
          : {}),
      };

      await student.save();
      updatedCount++;

      console.log(
        `Set school ID validation requirement for student ${student._id} (age: ${student.age})`
      );
    }

    console.log(
      `School ID validation requirements processed: ${updatedCount} students updated`
    );
    return { success: true, updatedCount };
  } catch (error) {
    console.error("Error processing school ID validations:", error);
    throw error;
  }
};

// Function to send reminders for expired school ID validations
export const sendSchoolIdReminders = async () => {
  try {
    const today = new Date();
    const reminderDate = new Date();
    reminderDate.setDate(today.getDate() + 30); // 30 days before expiration

    // Find students whose school ID will expire soon and haven't been reminded
    const studentsNeedingReminder = await User.find({
      role: "passenger",
      passengerCategory: "student",
      age: { $gte: 19 },
      "schoolIdValidation.validated": false,
      "schoolIdValidation.reminderSent": false,
      "schoolIdValidation.expirationDate": {
        $lte: reminderDate,
        $gte: today,
      },
      deletionRequested: { $ne: true },
    });

    let reminderCount = 0;

    for (const student of studentsNeedingReminder) {
      // Mark reminder as sent
      student.schoolIdValidation.reminderSent = true;
      await student.save();

      // Here you would typically send a notification/email
      // For now, we'll just log it
      console.log(
        `Reminder sent to student ${student._id} for school ID validation`
      );
      reminderCount++;
    }

    console.log(`School ID reminders sent: ${reminderCount} students notified`);
    return { success: true, reminderCount };
  } catch (error) {
    console.error("Error sending school ID reminders:", error);
    throw error;
  }
};

// Function to handle students who haven't uploaded school ID by deadline
export const processExpiredSchoolIdValidations = async () => {
  try {
    const today = new Date();

    // Find students whose school ID validation has expired
    const expiredStudents = await User.find({
      role: "passenger",
      passengerCategory: "student",
      age: { $gte: 19 },
      "schoolIdValidation.validated": false,
      "schoolIdValidation.expirationDate": { $lt: today },
      deletionRequested: { $ne: true },
    });

    let processedCount = 0;

    for (const student of expiredStudents) {
      // Change category to regular since they didn't validate as student
      const previousCategory = student.passengerCategory;
      student.passengerCategory = "regular";

      // Record the category change due to expired validation
      student.ageTransitions.push({
        fromAge: student.age,
        toAge: student.age,
        transitionDate: today,
        categoryChanged: true,
        previousCategory: previousCategory,
        newCategory: "regular",
      });

      // Clear school ID validation requirement
      student.schoolIdValidation = undefined;

      await student.save();
      processedCount++;

      console.log(
        `Student ${student._id} category changed from student to regular due to expired school ID validation`
      );
    }

    console.log(
      `Expired school ID validations processed: ${processedCount} students updated`
    );
    return { success: true, processedCount };
  } catch (error) {
    console.error("Error processing expired school ID validations:", error);
    throw error;
  }
};

export const acknowledgeSeniorEligibility = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update the senior eligibility notification
    if (user.seniorEligibilityNotification) {
      user.seniorEligibilityNotification.acknowledged = true;
      user.seniorEligibilityNotification.acknowledgedDate = new Date();
    }

    await user.save();
    res.json({ message: "Senior eligibility notification acknowledged" });
  } catch (error) {
    console.error("Error acknowledging senior eligibility:", error);
    res.status(500).json({ error: "Failed to acknowledge notification" });
  }
};

export const uploadSchoolId = async (req, res) => {
  try {
    const userId = req.params.id;

    if (!req.file) {
      return res.status(400).json({ error: "No school ID file provided" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify user is a student and 19 or older
    if (user.role !== "passenger" || user.passengerCategory !== "student") {
      return res.status(400).json({
        error: "School ID upload is only available for student passengers",
      });
    }

    if (user.age < 19) {
      return res.status(400).json({
        error:
          "School ID validation is only required for students 19 years or older",
      });
    }

    const imageUrl = `${req.protocol}://${req.get("host")}/uploads/profiles/${
      req.file.filename
    }`;

    // Get current school year
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const schoolYear =
      currentDate.getMonth() >= 7 // August or later
        ? `${currentYear}-${currentYear + 1}`
        : `${currentYear - 1}-${currentYear}`;

    // Calculate expiration date (August 31st of current school year)
    const expirationYear =
      currentDate.getMonth() >= 7 ? currentYear + 1 : currentYear;
    const expirationDate = new Date(expirationYear, 7, 31); // August 31st

    // Update or create school ID validation record
    user.schoolIdValidation = {
      currentSchoolYear: schoolYear,
      lastUploadDate: new Date(),
      expirationDate: expirationDate,
      validated: false, // Will be set to true by admin during approval
      reminderSent: false,
    };

    // Also update the idDocument field for admin review
    user.idDocument = {
      type: "school_id",
      imageUrl: imageUrl,
      uploadedAt: new Date(),
      verified: false, // Will be verified by admin
    };

    // Set verification status to under review
    user.verificationStatus = "under_review";

    await user.save();

    res.json({
      message: "School ID uploaded successfully and is pending admin approval",
      imageUrl: imageUrl,
      schoolYear: schoolYear,
      expirationDate: expirationDate,
    });
  } catch (error) {
    console.error("Error uploading school ID:", error);
    res.status(500).json({ error: "Failed to upload school ID" });
  }
};

// Update existing requestCategoryChange function to handle senior category
export const requestCategoryChange = async (req, res) => {
  try {
    const userId = req.params.id;
    const { requestedCategory } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Validate category change eligibility
    const currentAge = user.age;
    const validCategories = [];

    if (currentAge >= 18) validCategories.push("regular");
    if (currentAge >= 12) validCategories.push("student");
    if (currentAge >= 60) validCategories.push("senior");

    if (!validCategories.includes(requestedCategory)) {
      return res.status(400).json({
        error: `You are not eligible for ${requestedCategory} category`,
      });
    }

    let supportingDocumentUrl = null;
    if (req.file) {
      supportingDocumentUrl = `${req.protocol}://${req.get(
        "host"
      )}/uploads/profiles/${req.file.filename}`;
    }

    // Check if supporting document is required
    const requiresDocument =
      (requestedCategory === "student" && currentAge >= 19) ||
      requestedCategory === "senior";

    if (requiresDocument && !supportingDocumentUrl) {
      const docType =
        requestedCategory === "senior" ? "Senior Citizen ID" : "School ID";
      return res.status(400).json({
        error: `${docType} is required for ${requestedCategory} category`,
      });
    }

    // Create category change request
    const categoryChangeRequest = {
      requestedCategory,
      currentCategory: user.passengerCategory,
      supportingDocument: supportingDocumentUrl
        ? {
            imageUrl: supportingDocumentUrl,
            uploadDate: new Date(),
          }
        : null,
      requestDate: new Date(),
      status: "pending",
      processed: false,
    };

    // Add to user's category change requests
    if (!user.categoryChangeRequests) {
      user.categoryChangeRequests = [];
    }
    user.categoryChangeRequests.push(categoryChangeRequest);

    await user.save();

    res.json({
      message: "Category change request submitted successfully",
      request: categoryChangeRequest,
    });
  } catch (error) {
    console.error("Error processing category change request:", error);
    res
      .status(500)
      .json({ error: "Failed to process category change request" });
  }
};
