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

      // Save user with new password
      await user.save();

      // Return success response
      return res.json({
        message: "Password updated successfully",
        user: {
          _id: user._id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
        },
      });
    }

    // Handle normal profile update
    // Basic validation for regular profile updates
    if (
      updateData.fullName !== undefined &&
      updateData.username !== undefined &&
      updateData.email !== undefined &&
      updateData.phone !== undefined
    ) {
      // Check if username changed and if it's taken by another user
      if (updateData.username !== user.username) {
        const existingUsername = await User.findOne({
          username: updateData.username,
          _id: { $ne: userId }, // Exclude current user
        });

        if (existingUsername) {
          return res.status(400).json({ error: "Username already taken" });
        }
      }

      // Check if email changed and if it's used by another user
      if (updateData.email !== user.email) {
        const existingEmail = await User.findOne({
          email: updateData.email,
          _id: { $ne: userId }, // Exclude current user
        });

        if (existingEmail) {
          return res.status(400).json({ error: "Email already registered" });
        }
      }

      // Update basic user fields
      user.fullName = updateData.fullName;
      user.username = updateData.username;
      user.email = updateData.email;
      user.phone = updateData.phone;

      if (updateData.profileImage) {
        user.profileImage = updateData.profileImage;
      }

      // Role-specific updates
      if (user.role === "passenger" && updateData.savedAddresses) {
        user.savedAddresses = updateData.savedAddresses;
      }

      if (user.role === "driver") {
        // Only update driver-specific fields if provided
        if (updateData.driverStatus) {
          user.driverStatus = updateData.driverStatus;
        }
        if (updateData.vehicle) {
          user.vehicle = updateData.vehicle;
        }
        // Additional driver fields can be added here
      }
    }

    // Save the updated user
    const updatedUser = await user.save();

    // Return the updated user data (excluding password)
    const userResponse = updatedUser.toObject();
    delete userResponse.password;

    res.json(userResponse);
  } catch (error) {
    console.error("Error updating profile:", error);
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
