import mongoose from "mongoose";

const fareSchema = new mongoose.Schema(
  {
    sourceZone: {
      type: String,
      required: true,
    },
    destinationZone: {
      type: String,
      required: true,
    },
    isFixedFare: {
      type: Boolean,
      default: false,
    },
    fixedFare: {
      type: Number,
      default: 0,
    },
    baseFare: {
      type: Number,
      default: 0,
    },
    perKmRate: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Create a compound index for fast lookup of fare rules
fareSchema.index({ sourceZone: 1, destinationZone: 1 }, { unique: true });

const Fare = mongoose.model("Fare", fareSchema);

export default Fare;
