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

const vehicleSchema = new mongoose.Schema(
  {
    make: { type: String, required: true },
    model: { type: String, required: true },
    year: { type: Number, required: true },
    color: { type: String, required: true },
    type: {
      type: String,
      enum: ["bao-bao"],
      required: true,
    },
    plateNumber: { type: String, required: true },
    bodyNumber: { type: String, required: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    phone: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["passenger", "driver", "admin"],
      required: true,
    },
    profileImage: {
      type: String,
      default: "",
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    blockReason: {
      type: String,
      default: "",
    },
    warnings: [
      {
        message: { type: String, required: true },
        Date: { type: Date, default: Date.now },
        readStatus: { type: Boolean, default: false },
      },
    ],
    currentLocation: {
      type: locationSchema,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
    totalRides: {
      type: Number,
      default: 0,
    },
    totalRatings: {
      type: Number,
      default: 0,
    },

    // Driver-only fields
    licenseNumber: {
      type: String,
      validate: {
        validator: function (value) {
          return this.role === "driver" || !value;
        },
        message: "Only drivers can have a license number.",
      },
    },
    driverStatus: {
      type: String,
      enum: ["available", "busy", "offline"],
      // default: "offline", //commented this default so that it will not be added as empty string for other user role
      validate: {
        validator: function (value) {
          return this.role === "driver" || value === undefined;
        },
        message: "Only drivers can have a driver status.",
      },
    },
    vehicle: {
      type: vehicleSchema,
      validate: {
        validator: function (value) {
          return this.role === "driver" || value === undefined;
        },
        message: "Only drivers can have vehicle information.",
      },
    },
    isVerified: {
      type: Boolean,
      // default: false,
      validate: {
        validator: function (value) {
          return this.role === "driver" || value === undefined;
        },
        message: "Only drivers need verification.",
      },
    },
    documents: {
      type: [
        {
          documentType: {
            type: String,
            enum: [
              "License",
              "Registration",
              "MODA Certificate",
              "Vehicle Photo",
            ],
          },
          fileURL: { type: String },
          verified: { type: Boolean, default: false },
          uploadDate: { type: Date, default: Date.now },
        },
      ],
      validate: {
        validator: function (value) {
          return this.role === "driver" || value === undefined;
        },
        message: "Only drivers can upload verification documents.",
      },
      default: function () {
        return this.role === "driver" ? [] : undefined; //set this with undefined so that it will not be added as empty string for other user role
      },
    },

    // Passenger-only field
    savedAddresses: {
      type: [
        {
          label: { type: String, required: true },
          address: { type: String, required: true },
          location: { type: locationSchema, required: true },
        },
      ],
      validate: {
        validator: function (value) {
          return this.role === "passenger" || value === undefined;
        },
        message: "Only passengers can have saved addresses.",
      },
      default: function () {
        return this.role === "passenger" ? [] : undefined;
      },
    },
  },
  { timestamps: true }
);

// Add geospatial index for driver location queries
userSchema.index({ currentLocation: "2dsphere" });

const User = mongoose.model("User", userSchema);

export default User;
