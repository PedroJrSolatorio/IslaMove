import Zone from "../models/Zone.js";
import Fare from "../models/Fare.js";

// Get all fares
export const getFares = async (req, res) => {
  try {
    const fares = await Fare.find({ isActive: true });
    res.json({ success: true, fares });
  } catch (error) {
    console.error("Error fetching fares:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add new fare rule
export const addFare = async (req, res) => {
  try {
    const {
      sourceZone,
      destinationZone,
      isFixedFare,
      fixedFare,
      baseFare,
      perKmRate,
    } = req.body;

    // Validate required fields
    if (!sourceZone || !destinationZone) {
      return res.status(400).json({
        success: false,
        message: "Source and destination zones are required",
      });
    }

    // Validate fare values based on fare type
    if (isFixedFare) {
      if (fixedFare === undefined || isNaN(fixedFare)) {
        return res.status(400).json({
          success: false,
          message: "Fixed fare amount is required and must be a number",
        });
      }
    } else {
      if (
        baseFare === undefined ||
        perKmRate === undefined ||
        isNaN(baseFare) ||
        isNaN(perKmRate)
      ) {
        return res.status(400).json({
          success: false,
          message: "Base fare and per km rate are required and must be numbers",
        });
      }
    }

    // Check if fare rule already exists
    const existingFare = await Fare.findOne({ sourceZone, destinationZone });
    if (existingFare) {
      return res.status(400).json({
        success: false,
        message: "A fare rule for these zones already exists",
      });
    }

    // Create new fare rule
    const fare = new Fare({
      sourceZone,
      destinationZone,
      isFixedFare: isFixedFare || false,
      fixedFare: isFixedFare ? fixedFare : 0,
      baseFare: isFixedFare ? 0 : baseFare,
      perKmRate: isFixedFare ? 0 : perKmRate,
    });

    await fare.save();

    res.status(201).json({
      success: true,
      message: "Fare rule added successfully",
      fare,
    });
  } catch (error) {
    console.error("Error adding fare:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update fare rule
export const updateFare = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      sourceZone,
      destinationZone,
      isFixedFare,
      fixedFare,
      baseFare,
      perKmRate,
    } = req.body;

    // Validate required fields
    if (!sourceZone || !destinationZone) {
      return res.status(400).json({
        success: false,
        message: "Source and destination zones are required",
      });
    }

    // Validate fare values based on fare type
    if (isFixedFare) {
      if (fixedFare === undefined || isNaN(fixedFare)) {
        return res.status(400).json({
          success: false,
          message: "Fixed fare amount is required and must be a number",
        });
      }
    } else {
      if (
        baseFare === undefined ||
        perKmRate === undefined ||
        isNaN(baseFare) ||
        isNaN(perKmRate)
      ) {
        return res.status(400).json({
          success: false,
          message: "Base fare and per km rate are required and must be numbers",
        });
      }
    }

    // Check if fare already exists with these zones (excluding current fare)
    const existingFare = await Fare.findOne({
      _id: { $ne: id },
      sourceZone,
      destinationZone,
    });

    if (existingFare) {
      return res.status(400).json({
        success: false,
        message: "Another fare rule for these zones already exists",
      });
    }

    // Update fare rule
    const updatedFare = await Fare.findByIdAndUpdate(
      id,
      {
        sourceZone,
        destinationZone,
        isFixedFare: isFixedFare || false,
        fixedFare: isFixedFare ? parseFloat(fixedFare) : 0,
        baseFare: isFixedFare ? 0 : parseFloat(baseFare),
        perKmRate: isFixedFare ? 0 : parseFloat(perKmRate),
      },
      { new: true }
    );

    if (!updatedFare) {
      return res.status(404).json({
        success: false,
        message: "Fare rule not found",
      });
    }

    res.json({
      success: true,
      message: "Fare rule updated successfully",
      fare: updatedFare,
    });
  } catch (error) {
    console.error("Error updating fare:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete fare rule
export const deleteFare = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedFare = await Fare.findByIdAndDelete(id);

    if (!deletedFare) {
      return res.status(404).json({
        success: false,
        message: "Fare rule not found",
      });
    }

    res.json({
      success: true,
      message: "Fare rule deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting fare:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get fare by source and destination zones
export const getFareByZones = async (req, res) => {
  try {
    const { sourceZone, destinationZone } = req.query;

    if (!sourceZone || !destinationZone) {
      return res.status(400).json({
        success: false,
        message: "Source and destination zones are required",
      });
    }

    const fare = await Fare.findOne({
      sourceZone,
      destinationZone,
      isActive: true,
    });

    if (!fare) {
      return res.status(404).json({
        success: false,
        message: "No fare rule found for these zones",
      });
    }

    res.json({
      success: true,
      fare,
    });
  } catch (error) {
    console.error("Error getting fare by zones:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Calculate fare based on zones and distance
export const calculateFare = async (req, res) => {
  try {
    const { sourceZone, destinationZone, distance } = req.body;

    if (!sourceZone || !destinationZone) {
      return res.status(400).json({
        success: false,
        message: "Source and destination zones are required",
      });
    }

    // Look for fixed fare between these zones
    const fareRule = await Fare.findOne({
      sourceZone,
      destinationZone,
      isActive: true,
    });

    let calculatedFare;
    let fareDetails = {};

    if (fareRule) {
      if (fareRule.isFixedFare) {
        calculatedFare = fareRule.fixedFare;
        fareDetails = {
          type: "fixed",
          amount: calculatedFare,
        };
      } else {
        // For distance-based fare
        if (!distance || isNaN(parseFloat(distance))) {
          return res.status(400).json({
            success: false,
            message: "Valid distance is required for distance-based fare",
          });
        }

        const distanceValue = parseFloat(distance);
        calculatedFare = fareRule.baseFare + distanceValue * fareRule.perKmRate;
        fareDetails = {
          type: "distance-based",
          baseFare: fareRule.baseFare,
          perKmRate: fareRule.perKmRate,
          distance: distanceValue,
          amount: calculatedFare,
        };
      }
    } else {
      return res.status(404).json({
        success: false,
        message: "No fare rule found for these zones",
      });
    }

    res.json({
      success: true,
      fare: {
        amount: parseFloat(calculatedFare.toFixed(2)),
        details: fareDetails,
      },
    });
  } catch (error) {
    console.error("Error calculating fare:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
