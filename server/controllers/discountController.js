import DiscountConfig from "../models/DiscountConfig.js";
import User from "../models/User.js";

// Get current discount configuration
export const getDiscountConfig = async (req, res) => {
  try {
    let config = await DiscountConfig.findOne({ isActive: true });

    if (!config) {
      // Create default config if none exists
      config = new DiscountConfig({
        name: "Default Discount Configuration",
        discounts: new Map([
          ["regular", 0],
          ["student", 20],
          ["senior", 20],
          ["student_child", 50],
        ]),
        ageBasedRules: {
          studentChildMaxAge: 12,
          enableAgeBasedDiscounts: true,
        },
        description:
          "System-wide discount configuration for passenger categories",
        isActive: true,
      });
      await config.save();
    }

    // Convert Map to plain object for response
    const responseData = {
      ...config.toObject(),
      discounts: config.discounts
        ? Object.fromEntries(config.discounts)
        : {
            regular: 0,
            student: 20,
            senior: 20,
            student_child: 50,
          },
    };

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Error fetching discount config:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update discount configuration
export const updateDiscountConfig = async (req, res) => {
  try {
    const { discounts, description, ageBasedRules } = req.body;

    console.log("Received update request:", {
      discounts,
      description,
      ageBasedRules,
    }); // Debug log

    // Validate discount percentages
    if (discounts) {
      for (const [category, percentage] of Object.entries(discounts)) {
        if (
          typeof percentage !== "number" ||
          percentage < 0 ||
          percentage > 100
        ) {
          return res.status(400).json({
            success: false,
            message: `Invalid discount percentage for ${category}. Must be between 0-100%`,
          });
        }
      }
    }

    // Validate age-based rules
    if (ageBasedRules) {
      if (ageBasedRules.studentChildMaxAge !== undefined) {
        if (
          typeof ageBasedRules.studentChildMaxAge !== "number" ||
          ageBasedRules.studentChildMaxAge < 0 ||
          ageBasedRules.studentChildMaxAge > 25
        ) {
          return res.status(400).json({
            success: false,
            message: "Student child max age must be between 0-25 years",
          });
        }
      }
    }

    let config = await DiscountConfig.findOne({ isActive: true });

    if (!config) {
      // Create new config if none exists
      config = new DiscountConfig({
        name: "Default Discount Configuration",
        isActive: true,
      });
    }

    // Update discounts if provided
    if (discounts) {
      config.discounts = new Map(Object.entries(discounts));
    }

    // Update age-based rules if provided
    if (ageBasedRules) {
      config.ageBasedRules = {
        ...config.ageBasedRules,
        ...ageBasedRules,
      };
    }

    // Update description if provided
    if (description !== undefined) {
      config.description = description;
    }

    // Save the config
    await config.save();

    console.log("Config saved successfully:", config); // Debug log

    // Convert Map to plain object for response
    const responseData = {
      ...config.toObject(),
      discounts: config.discounts
        ? Object.fromEntries(config.discounts)
        : {
            regular: 0,
            student: 20,
            senior: 20,
            student_child: 50,
          },
    };

    res.json({
      success: true,
      message: "Discount configuration updated successfully",
      data: responseData,
    });
  } catch (error) {
    console.error("Error updating discount config:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get fare calculation preview
export const getFarePreview = async (req, res) => {
  try {
    const {
      baseAmount,
      passengerCategory = "regular",
      passengerId,
      passengerAge,
    } = req.query;

    if (!baseAmount || isNaN(parseFloat(baseAmount))) {
      return res.status(400).json({
        success: false,
        message: "Valid base amount is required",
      });
    }

    const config = await DiscountConfig.findOne({ isActive: true });

    let discountRate = 0;
    let discountType = passengerCategory;
    let age = null;

    // Get passenger age if passenger ID is provided
    if (passengerId) {
      try {
        const passenger = await User.findById(passengerId).select(
          "age passengerCategory"
        );
        if (passenger) {
          age = passenger.age;
          // Use the passenger's actual category from database
          discountType = passenger.passengerCategory || passengerCategory;
        }
      } catch (error) {
        console.warn("Could not fetch passenger info:", error.message);
      }
    } else if (passengerAge) {
      // Use provided age if passenger ID is not available
      age = parseInt(passengerAge);
    }

    if (config) {
      if (age !== null) {
        // Use the enhanced method that considers age
        discountRate = config.getDiscountForPassenger(discountType, age);
      } else {
        // Fallback to category-only discount
        if (config.discounts instanceof Map) {
          discountRate = config.discounts.get(discountType) || 0;
        } else {
          discountRate = config.discounts[discountType] || 0;
        }
      }
    }

    const discountAmount = parseFloat(baseAmount) * (discountRate / 100);
    const finalAmount = Math.max(0, parseFloat(baseAmount) - discountAmount);

    // Determine the applied discount type for response
    let appliedDiscountType = discountType;
    if (
      discountType === "student" &&
      age !== null &&
      age <= (config?.ageBasedRules?.studentChildMaxAge || 12)
    ) {
      appliedDiscountType = "student_child";
    }

    res.json({
      success: true,
      data: {
        baseAmount: parseFloat(baseAmount),
        passengerCategory: discountType,
        appliedDiscountType,
        passengerAge: age,
        discountRate,
        discountAmount: Math.round(discountAmount * 100) / 100,
        finalAmount: Math.round(finalAmount * 100) / 100,
        ageBasedDiscount: appliedDiscountType === "student_child",
      },
    });
  } catch (error) {
    console.error("Error calculating fare preview:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// get discount for a specific passenger
export const getPassengerDiscount = async (req, res) => {
  try {
    const { passengerId } = req.params;
    const { baseAmount } = req.query;

    const passenger = await User.findById(passengerId).select(
      "age passengerCategory firstName lastName"
    );

    if (!passenger) {
      return res.status(404).json({
        success: false,
        message: "Passenger not found",
      });
    }

    const config = await DiscountConfig.findOne({ isActive: true });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: "Discount configuration not found",
      });
    }

    const discountRate = config.getDiscountForPassenger(
      passenger.passengerCategory,
      passenger.age
    );

    let appliedDiscountType = passenger.passengerCategory;
    if (
      passenger.passengerCategory === "student" &&
      passenger.age <= (config.ageBasedRules?.studentChildMaxAge || 12)
    ) {
      appliedDiscountType = "student_child";
    }

    const response = {
      success: true,
      data: {
        passenger: {
          id: passenger._id,
          name: `${passenger.firstName} ${passenger.lastName}`,
          age: passenger.age,
          category: passenger.passengerCategory,
        },
        discount: {
          rate: discountRate,
          type: appliedDiscountType,
          ageBasedDiscount: appliedDiscountType === "student_child",
        },
      },
    };

    // If base amount is provided, calculate the fare
    if (baseAmount && !isNaN(parseFloat(baseAmount))) {
      const discountAmount = parseFloat(baseAmount) * (discountRate / 100);
      const finalAmount = Math.max(0, parseFloat(baseAmount) - discountAmount);

      response.data.fareCalculation = {
        baseAmount: parseFloat(baseAmount),
        discountAmount: Math.round(discountAmount * 100) / 100,
        finalAmount: Math.round(finalAmount * 100) / 100,
      };
    }

    res.json(response);
  } catch (error) {
    console.error("Error getting passenger discount:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
