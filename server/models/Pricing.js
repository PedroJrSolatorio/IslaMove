import mongoose from "mongoose";

const pricingSchema = new mongoose.Schema(
  {
    fromZone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
      required: true,
    },
    toZone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
      required: true,
    },
    baseAmount: {
      type: Number,
      required: true,
      description: "Base fare amount for regular passengers",
    },
    pricingType: {
      type: String,
      enum: ["fixed", "minimum", "special"],
      default: "fixed",
    },
    description: {
      type: String, // e.g., "Within same barangay", "Cross-barangay", "Special landmark"
    },
    priority: {
      type: Number,
      default: 1, // Higher number = higher priority for pricing selection
    },
    vehicleType: {
      type: String,
      enum: ["bao-bao"],
      default: "bao-bao",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Index for efficient querying
pricingSchema.index(
  { fromZone: 1, toZone: 1, vehicleType: 1 },
  { unique: true }
);
pricingSchema.index({ priority: -1 });
pricingSchema.index({ pricingType: 1 });

// Add method to calculate fare with discounts
pricingSchema.methods.calculateFare = function (passengerCategory = "regular") {
  const DiscountConfig = mongoose.model("DiscountConfig");

  return DiscountConfig.findOne({ isActive: true }).then((config) => {
    if (!config) return this.baseAmount;

    const discountRate = config.discounts.get(passengerCategory) || 0;
    const discountAmount = this.baseAmount * (discountRate / 100);
    return Math.max(0, this.baseAmount - discountAmount);
  });
};

// Static method to find pricing with hierarchy consideration
pricingSchema.statics.findPricingWithHierarchy = async function (
  fromZoneId,
  toZoneId,
  vehicleType = "bao-bao",
  passengerCategory = "regular"
) {
  // First, try to find exact zone-to-zone pricing
  let pricing = await this.findOne({
    fromZone: fromZoneId,
    toZone: toZoneId,
    vehicleType,
    isActive: true,
  }).populate("fromZone toZone");

  if (pricing) {
    const finalAmount = await pricing.calculateFare(passengerCategory);
    return {
      ...pricing.toObject(),
      finalAmount,
      originalAmount: pricing.baseAmount,
      passengerCategory,
    };
  }

  // If no exact match, check if both zones are in the same barangay
  const Zone = mongoose.model("Zone");
  const fromZone = await Zone.findById(fromZoneId).populate("parentZone");
  const toZone = await Zone.findById(toZoneId).populate("parentZone");

  if (!fromZone || !toZone) {
    return null;
  }

  // Check for same barangay pricing (minimum fare within barangay)
  const fromBarangay =
    fromZone.zoneType === "barangay" ? fromZone : fromZone.parentZone;
  const toBarangay =
    toZone.zoneType === "barangay" ? toZone : toZone.parentZone;

  if (fromBarangay && toBarangay && fromBarangay._id.equals(toBarangay._id)) {
    // Look for within-barangay pricing
    pricing = await this.findOne({
      fromZone: fromBarangay._id,
      toZone: fromBarangay._id,
      vehicleType,
      pricingType: "minimum",
      isActive: true,
    }).populate("fromZone toZone");

    if (pricing) {
      return pricing;
    }
  }

  // Check for barangay-to-barangay pricing
  if (fromBarangay && toBarangay) {
    pricing = await this.findOne({
      fromZone: fromBarangay._id,
      toZone: toBarangay._id,
      vehicleType,
      isActive: true,
    }).populate("fromZone toZone");

    if (pricing) {
      return pricing;
    }
  }

  return null;
};

// Method to get all applicable pricing rules for two locations
pricingSchema.statics.findAllApplicablePricing = async function (
  fromZoneId,
  toZoneId,
  vehicleType = "sedan"
) {
  const pricing = await this.find({
    $or: [
      { fromZone: fromZoneId, toZone: toZoneId },
      // Add more complex queries here if needed for fallback pricing
    ],
    vehicleType,
    isActive: true,
  })
    .populate("fromZone toZone")
    .sort({ priority: -1 });

  return pricing;
};

const Pricing = mongoose.model("Pricing", pricingSchema);

export default Pricing;
