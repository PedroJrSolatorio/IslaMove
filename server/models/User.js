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
    series: { type: String, required: true },
    yearModel: { type: Number, required: true },
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
    lastName: { type: String, required: true },
    firstName: { type: String, required: true },
    middleInitial: { type: String, required: true },
    birthdate: { type: Date, required: true }, // Non-editable (viewable)
    age: { type: Number, required: true }, // Non-editable (viewable)
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    phone: { type: String, unique: true, required: true },

    // Only for drivers and passengers (not admin)
    homeAddress: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      zipCode: { type: String },
      coordinates: {
        type: [Number], // [longitude, latitude]
        index: "2dsphere",
      },
    },

    passengerCategory: {
      type: String,
      enum: ["regular", "student", "senior"],
      required: function () {
        return this.userType === "passenger";
      },
    },

    // Only for drivers and passengers (not admin)
    idDocument: {
      type: {
        type: String,
        enum: ["school_id", "senior_id", "valid_id", "drivers_license"],
      },
      imageUrl: { type: String },
      uploadedAt: { type: Date, default: Date.now },
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    },

    role: {
      type: String,
      enum: ["passenger", "driver", "admin"],
      required: true,
    },

    // Current active profile image
    profileImage: {
      type: String,
      default: "",
    },

    // Pending profile image awaiting admin approval
    pendingProfileImage: {
      imageUrl: { type: String },
      uploadedAt: { type: Date, default: Date.now },
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
      },
      reviewedAt: { type: Date },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Admin who reviewed
      rejectionReason: { type: String },
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
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "under_review", "approved", "rejected"],
      default: "pending",
    },
    agreementsAccepted: [
      {
        documentType: {
          type: String,
          enum: ["terms_and_conditions", "privacy_policy"],
          required: true,
        },
        version: { type: String, required: true },
        acceptedAt: { type: Date, default: Date.now },
        ipAddress: String,
        userAgent: String,
      },
    ],

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
    documents: {
      type: [
        {
          documentType: {
            type: String,
            enum: [
              "Official Receipt (OR)",
              "Certificate of Registration (CR)",
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

// Pre-save hook to validate role-specific fields
userSchema.pre("save", function (next) {
  // Validate that admin users don't have homeAddress or idDocument
  if (this.role === "admin") {
    if (this.homeAddress && Object.keys(this.homeAddress).length > 0) {
      return next(new Error("Admin users cannot have home address"));
    }
    if (this.idDocument && Object.keys(this.idDocument).length > 0) {
      return next(new Error("Admin users cannot have ID document"));
    }
  }

  next();
});

const User = mongoose.model("User", userSchema);

export default User;
