import User from "../models/User.js";
import Ride from "../models/Ride.js";
import UserAgreement from "../models/UserAgreement.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

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
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const userId = req.params.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent upload if a pending image already exists
    if (
      user.pendingProfileImage &&
      user.pendingProfileImage.status === "pending"
    ) {
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

    await user.save();

    return res.json({
      success: true,
      message: "Profile image uploaded and pending admin approval.",
      pendingImageUrl: fileUrl,
    });
  } catch (error) {
    console.error("Error uploading profile image:", error);
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

// Request account deletion
export const requestAccountDeletion = async (req, res) => {
  try {
    const userId = req.params.id;
    const { reason } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if deletion is already requested
    if (user.deletionRequested) {
      return res.status(400).json({
        error: "Account deletion already requested",
        scheduledFor: user.deletionScheduledFor,
      });
    }

    // Set deletion request
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30); // 30 days from now

    user.deletionRequested = true;
    user.deletionRequestedAt = new Date();
    user.deletionScheduledFor = deletionDate;
    user.deletionReason = reason || "User requested deletion";

    await user.save();

    res.json({
      message: "Account deletion requested successfully",
      scheduledFor: deletionDate,
      daysRemaining: 30,
      note: "Your account will be permanently deleted in 30 days. You can cancel this request by logging in before the deletion date.",
    });
  } catch (error) {
    console.error("Error requesting account deletion:", error);
    res.status(500).json({ error: "Failed to request account deletion" });
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

    // Verify authentication
    if (user.isGoogleUser) {
      // Verify Google ID token
      if (!googleIdToken) {
        return res.status(400).json({
          error: "Google authentication required",
          requiresGoogle: true,
        });
      }

      try {
        // Verify Google ID token (you'll need to implement this)
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
      // Verify password
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

    // Set deletion request
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);

    user.deletionRequested = true;
    user.deletionRequestedAt = new Date();
    user.deletionScheduledFor = deletionDate;
    user.deletionReason = reason || "User verified deletion";

    await user.save();

    res.json({
      message: "Account deletion verified and scheduled",
      scheduledFor: deletionDate,
      daysRemaining: 30,
      note: "Your account will be permanently deleted in 30 days. You can cancel this by logging in before the deletion date.",
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
        // Delete user's related data (rides, ratings, etc.)
        console.log(
          `Starting deletion process for user: ${user.email} (${user._id})`
        );

        // 1. Delete user's rides (as passenger and driver)
        const ridesDeleted = await Ride.deleteMany({
          $or: [{ passenger: user._id }, { driver: user._id }],
        });
        console.log(
          `Deleted ${ridesDeleted.deletedCount} rides for user ${user._id}`
        );

        // 2. Delete user agreements
        const agreementsDeleted = await UserAgreement.deleteMany({
          userId: user._id,
        });
        console.log(
          `Deleted ${agreementsDeleted.deletedCount} user agreements for user ${user._id}`
        );

        // Delete the user
        await User.findByIdAndDelete(user._id);

        console.log(`Deleted user: ${user.email} (${user._id})`);
      } catch (error) {
        console.error(`Failed to delete user ${user._id}:`, error);
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

// Cancel account deletion
export const cancelAccountDeletion = async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.deletionRequested) {
      return res.status(400).json({ error: "No deletion request found" });
    }

    // Cancel deletion request
    user.deletionRequested = false;
    user.deletionRequestedAt = undefined;
    user.deletionScheduledFor = undefined;
    user.deletionReason = undefined;

    await user.save();

    res.json({
      message: "Account deletion cancelled successfully",
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    console.error("Error cancelling account deletion:", error);
    res.status(500).json({ error: "Failed to cancel account deletion" });
  }
};
