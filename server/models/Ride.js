import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
    },
    address: {
      type: String,
    },
    mainText: {
      type: String,
    },
    secondaryText: {
      type: String,
    },
  },
  { _id: false }
);

const rideSchema = new mongoose.Schema(
  {
    passenger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    pickupLocation: {
      type: locationSchema,
      required: true,
    },
    destinationLocation: {
      type: locationSchema,
      required: true,
    },
    estimatedDistance: {
      type: Number, // in kilometers
      required: true,
    },
    estimatedDuration: {
      type: Number, // in minutes
      required: true,
    },
    actualDistance: {
      type: Number, // in kilometers
    },
    actualDuration: {
      type: Number, // in minutes
    },
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
    status: {
      type: String,
      enum: [
        "requested", // Initial state
        "searching", // Looking for driver
        "accepted", // Driver accepted
        "arrived", // Driver arrived at pickup
        "inProgress", // Ride started
        "completed", // Ride completed
        "cancelled", // Ride cancelled
      ],
      default: "requested",
    },
    price: {
      type: Number,
      required: true,
    },
    pricingDetails: {
      baseFare: Number,
      discountApplied: Number,
      discountRate: Number,
      discountType: String,
      passengerType: String,
      passengerAge: Number,
    },
    paymentMethod: {
      type: String,
      enum: ["cash"],
      default: "cash",
    },
    requestTime: {
      type: Date,
      default: Date.now,
    },
    acceptedTime: {
      type: Date,
    },
    arrivedTime: {
      type: Date,
    },
    startTime: {
      type: Date,
    },
    endTime: {
      type: Date,
    },
    passengerRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    driverRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    passengerFeedback: {
      type: String,
    },
    driverFeedback: {
      type: String,
    },
    cancellationReason: {
      type: String,
    },
    cancellationInitiator: {
      type: String,
      enum: ["passenger", "driver", "system"],
    },
    cancellationTime: {
      type: Date,
    },
    routePath: {
      type: [String], // Array of encoded polyline strings
    },
    driverLocationUpdates: {
      type: [
        {
          location: locationSchema,
          timestamp: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    driverQueue: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    currentDriverIndex: {
      type: Number,
      default: 0,
    },
    lastNotificationTime: {
      type: Date,
    },
    skippedDrivers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

// Index for geospatial queries
rideSchema.index({ pickupLocation: "2dsphere" });
rideSchema.index({ destinationLocation: "2dsphere" });

const Ride = mongoose.model("Ride", rideSchema);

export default Ride;
