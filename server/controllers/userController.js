import User from "../models/User.js";
import bcrypt from "bcrypt";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get user by email
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

// Get user profile by id
export const getProfileById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user)
      return res
        .status(404)
        .json({ error: "User not found in getProfileById" });
    res.json(user);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: "Error fetching user" });
  }
};

export const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const userId = req.params.id;

    // Get the server URL for file access
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/profiles/${
      req.file.filename
    }`;

    // Find the user and get their current profile image
    const user = await User.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ error: "User not found in uploadProfileImage" });
    }

    // Delete the old profile image if it exists
    if (user.profileImage) {
      try {
        // Construct the full path to the old image
        const uploadsDir = path.resolve(process.cwd(), "uploads", "profiles");
        const oldFilename = path.basename(user.profileImage);
        const oldFilePath = path.join(uploadsDir, oldFilename);

        // Check if file exists before attempting to delete
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
          console.log(`Deleted old profile image: ${oldFilename}`);
        } else {
          console.log("Old image file not found:", oldFilePath);
        }
      } catch (deleteError) {
        console.error("Failed to delete old profile image:", deleteError);
        // Continue even if deletion fails
      }
    }

    // Update user profile with new image URL
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profileImage: fileUrl },
      { new: true }
    );

    res.json({
      success: true,
      imageUrl: fileUrl,
      user: {
        _id: updatedUser._id,
        username: updatedUser.username,
        fullName: updatedUser.fullName,
        profileImage: updatedUser.profileImage,
      },
    });
  } catch (error) {
    console.error("Error uploading profile image:", error);
    res.status(500).json({ error: "Failed to upload image" });
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

      // Hash and update the new password
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(updateData.newPassword, salt);

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

    // Prevent editing of non-editable fields
    if (updateData.birthdate || updateData.age) {
      return res.status(400).json({
        error: "Birthdate and age cannot be modified",
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
      "profileImage",
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
      if (updateData.idDocument !== undefined) {
        updateObject.idDocument = updateData.idDocument;
      }
    } else if (user.role === "driver") {
      // Driver-specific fields
      if (updateData.driverStatus !== undefined) {
        updateObject.driverStatus = updateData.driverStatus;
      }
      if (updateData.vehicle !== undefined) {
        updateObject.vehicle = updateData.vehicle;
      }
      if (updateData.licenseNumber !== undefined) {
        updateObject.licenseNumber = updateData.licenseNumber;
      }
      if (updateData.documents !== undefined) {
        updateObject.documents = updateData.documents;
      }
      // Fields available to both passenger and driver
      if (updateData.homeAddress !== undefined) {
        updateObject.homeAddress = updateData.homeAddress;
      }
      if (updateData.idDocument !== undefined) {
        updateObject.idDocument = updateData.idDocument;
      }
    } else if (user.role === "admin") {
      // Admin users cannot update homeAddress or idDocument
      if (updateData.homeAddress || updateData.idDocument) {
        return res.status(400).json({
          error: "Admin users cannot have home address or ID document",
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
        updateData.licenseNumber ||
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
