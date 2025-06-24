import Pricing from "../models/Pricing.js";
import DiscountConfig from "../models/DiscountConfig.js";
import Zone from "../models/Zone.js";

export const createPricing = async (req, res) => {
  try {
    const {
      fromZone,
      toZone,
      baseAmount,
      vehicleType,
      pricingType,
      description,
      priority,
    } = req.body;

    // Validate required fields
    if (
      !fromZone ||
      !toZone ||
      baseAmount === undefined ||
      isNaN(parseFloat(baseAmount))
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
      vehicleType: vehicleType || "bao-bao",
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
      baseAmount: parseFloat(baseAmount),
      vehicleType: vehicleType || "bao-bao",
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
    const {
      pricingType,
      vehicleType,
      passengerCategory = "regular",
    } = req.query;

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

    // Get discount config for fare calculations
    const discountConfig = await DiscountConfig.findOne({ isActive: true });
    const discountRate = discountConfig?.discounts?.get(passengerCategory) || 0;

    // Calculate final amounts for each pricing rule
    const pricingWithCalculations = pricing.map((rule) => {
      const discountAmount = rule.baseAmount * (discountRate / 100);
      const finalAmount = Math.max(0, rule.baseAmount - discountAmount);

      return {
        ...rule.toObject(),
        discountRate,
        discountAmount: Math.round(discountAmount * 100) / 100,
        finalAmount: Math.round(finalAmount * 100) / 100,
        passengerCategory,
      };
    });

    res.json({
      success: true,
      data: pricingWithCalculations,
      discountConfig: discountConfig
        ? {
            discounts: Object.fromEntries(discountConfig.discounts),
            updatedAt: discountConfig.updatedAt,
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching pricing rules:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get pricing for specific route with hierarchy consideration and discounts
export const getPricingForRoute = async (req, res) => {
  try {
    const { fromZone, toZone, passengerCategory = "regular" } = req.query;

    if (!fromZone || !toZone) {
      return res.status(400).json({
        success: false,
        message: "Both fromZone and toZone are required",
      });
    }

    const pricing = await Pricing.findPricingWithHierarchy(
      fromZone,
      toZone,
      "bao-bao",
      passengerCategory
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
      baseAmount,
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
        baseAmount:
          baseAmount !== undefined
            ? parseFloat(baseAmount)
            : pricing.baseAmount,
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
