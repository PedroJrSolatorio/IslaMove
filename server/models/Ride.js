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
      type: [locationSchema], // Array of coordinates representing the route
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
  },
  { timestamps: true }
);

const Ride = mongoose.model("Ride", rideSchema);

export default Ride;
