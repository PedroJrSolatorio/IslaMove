import mongoose from "mongoose";

const discountConfigSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      default: "Default Discount Configuration",
    },
    discounts: {
      type: Map,
      of: Number,
      default: () =>
        new Map([
          ["regular", 0],
          ["student", 20],
          ["senior", 20],
          ["student_child", 50],
        ]),
    },
    ageBasedRules: {
      studentChildMaxAge: {
        type: Number,
        default: 12, // Default max age for student child discount
        min: 0,
        max: 12, // max age limit
      },
      enableAgeBasedDiscounts: {
        type: Boolean,
        default: true,
      },
    },
    description: {
      type: String,
      default: "System-wide discount configuration for passenger categories",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    validFrom: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
      default: null, // null means no expiry
    },
  },
  {
    timestamps: true,
    // Ensure Maps are properly serialized
    toJSON: {
      transform: function (doc, ret) {
        if (ret.discounts && ret.discounts instanceof Map) {
          ret.discounts = Object.fromEntries(ret.discounts);
        }
        return ret;
      },
    },
    toObject: {
      transform: function (doc, ret) {
        if (ret.discounts && ret.discounts instanceof Map) {
          ret.discounts = Object.fromEntries(ret.discounts);
        }
        return ret;
      },
    },
  }
);

// Ensure only one active config at a time
discountConfigSchema.pre("save", async function (next) {
  if (this.isActive) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { isActive: false }
    );
  }
  next();
});

// method to get discount value based on passanger info
discountConfigSchema.methods.getDiscountForPassenger = function (
  passengerCategory,
  age
) {
  if (!this.discounts) return 0;

  // Check for age-based discount for students
  if (
    passengerCategory === "student" &&
    this.ageBasedRules?.enableAgeBasedDiscounts &&
    age <= (this.ageBasedRules?.studentChildMaxAge || 12)
  ) {
    const childDiscount =
      this.discounts instanceof Map
        ? this.discounts.get("student_child")
        : this.discounts["student_child"];

    if (childDiscount !== undefined) {
      return childDiscount;
    }
  }

  // Default category-based discount
  if (this.discounts instanceof Map) {
    return this.discounts.get(passengerCategory) || 0;
  }

  return this.discounts[passengerCategory] || 0;
};

// method to get discount value safely
discountConfigSchema.methods.getDiscountValue = function (category) {
  if (!this.discounts) return 0;

  if (this.discounts instanceof Map) {
    return this.discounts.get(category) || 0;
  }

  return this.discounts[category] || 0;
};

const DiscountConfig = mongoose.model("DiscountConfig", discountConfigSchema);

export default DiscountConfig;
