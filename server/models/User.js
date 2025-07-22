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

const vehicleSchema = new mongoose.Schema(
  {
    make: {
      type: String,
      required: function () {
        return (
          this.parent().role === "driver" && this.parent().isProfileComplete
        );
      },
    },
    series: {
      type: String,
      required: function () {
        return (
          this.parent().role === "driver" && this.parent().isProfileComplete
        );
      },
    },
    yearModel: {
      type: Number,
      required: function () {
        return (
          this.parent().role === "driver" && this.parent().isProfileComplete
        );
      },
    },
    color: {
      type: String,
      required: function () {
        return (
          this.parent().role === "driver" && this.parent().isProfileComplete
        );
      },
    },
    type: {
      type: String,
      enum: ["bao-bao"],
      required: function () {
        return (
          this.parent().role === "driver" && this.parent().isProfileComplete
        );
      },
    },
    plateNumber: {
      type: String,
      required: function () {
        return (
          this.parent().role === "driver" && this.parent().isProfileComplete
        );
      },
    },
    bodyNumber: {
      type: String,
      required: function () {
        return (
          this.parent().role === "driver" && this.parent().isProfileComplete
        );
      },
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    lastName: { type: String, required: true },
    firstName: { type: String, required: true },
    middleInitial: {
      type: String,
      required: function () {
        return this.isProfileComplete;
      },
    },
    birthdate: {
      type: Date,
      required: function () {
        return this.isProfileComplete;
      },
    },
    age: {
      type: Number,
      required: function () {
        return this.isProfileComplete;
      },
    },
    username: {
      type: String,
      unique: true,
      sparse: true, // Allows null values but ensures uniqueness when present
      required: function () {
        return !this.isGoogleUser && this.isProfileComplete;
      },
    },
    email: { type: String, unique: true, required: true },
    password: {
      type: String,
      required: function () {
        return !this.isGoogleUser && this.isProfileComplete;
      },
    },
    phone: {
      type: String,
      unique: true,
      sparse: true, // Allows null values but ensures uniqueness when present
      required: function () {
        return this.isProfileComplete;
      },
    },

    // Google authentication fields
    isGoogleUser: {
      type: Boolean,
      default: false,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allows null values but ensures uniqueness when present
    },
    isProfileComplete: {
      type: Boolean,
      default: function () {
        return !this.isGoogleUser; // Regular users start with complete profiles
      },
    },

    // Only for drivers and passengers (not admin)
    homeAddress: {
      street: { type: String },
      city: { type: String },
      state: { type: String },
      zipCode: { type: String },
      coordinates: {
        type: [Number], // [longitude, latitude]
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
      required: function () {
        return this.role === "driver" && this.isProfileComplete;
      },
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
      validate: {
        validator: function (value) {
          return this.role === "driver" || value === undefined;
        },
        message: "Only drivers can have a driver status.",
      },
    },
    vehicle: {
      type: vehicleSchema,
      required: function () {
        return this.role === "driver" && this.isProfileComplete;
      },
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
        return this.role === "driver" ? [] : undefined;
      },
    },

    // Passenger-only field
    passengerCategory: {
      type: String,
      enum: ["regular", "student", "student_child", "senior"],
      required: function () {
        return this.role === "passenger" && this.isProfileComplete;
      },
    },
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
    // Parent/Guardian information for minors
    parentGuardian: {
      type: {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        email: { type: String },
        firstName: { type: String },
        lastName: { type: String },
        relationship: { type: String, enum: ["parent", "guardian"] },
        consentGiven: { type: Boolean, default: false },
        consentDate: { type: Date },
      },
      required: function () {
        return this.role === "passenger" && this.age && this.age < 18;
      },
    },
    // Birth certificate for children 12-13 years old
    birthCertificate: {
      type: {
        imageUrl: { type: String },
        uploadedAt: { type: Date, default: Date.now },
        verified: { type: Boolean, default: false },
        verifiedAt: Date,
        verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        deletedAt: Date, // Track when it was deleted after verification
      },
      required: function () {
        return this.role === "passenger" && this.age === 12;
      },
    },

    // School ID validation tracking for students 19+
    schoolIdValidation: {
      currentSchoolYear: { type: String }, // e.g., "2024-2025"
      lastUploadDate: { type: Date },
      expirationDate: { type: Date }, // August of current school year
      validated: { type: Boolean, default: false },
      validatedAt: { type: Date },
      validatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      reminderSent: { type: Boolean, default: false },
    },
    ageTransitions: [
      {
        fromAge: Number,
        toAge: Number,
        transitionDate: Date,
        categoryChanged: { type: Boolean, default: false },
        previousCategory: String,
        newCategory: String,
      },
    ],
    categoryChangeRequest: {
      requestedCategory: {
        type: String,
        enum: ["regular", "student", "senior", "student_child"],
      },
      requestDate: { type: Date },
      status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
      },
      supportingDocument: {
        type: String,
        imageUrl: String,
        uploadedAt: { type: Date, default: Date.now },
      },
      reviewedAt: Date,
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      rejectionReason: String,
    },

    activeRefreshTokens: [
      {
        token: { type: String, required: true },
        deviceId: { type: String }, // To identify the device
        loggedInAt: { type: Date, default: Date.now },
      },
    ],
    deletionRequested: {
      type: Boolean,
      default: false,
    },
    deletionRequestedAt: {
      type: Date,
    },
    deletionScheduledFor: {
      type: Date,
    },
    deletionReason: {
      type: String,
    },
  },
  { timestamps: true }
);

// Add geospatial index for driver location queries
userSchema.index({ currentLocation: "2dsphere" });

// Add index for age-based queries
userSchema.index({ birthdate: 1 });
userSchema.index({ "schoolIdValidation.expirationDate": 1 });

// Pre-save hook to validate role-specific fields
userSchema.pre("save", function (next) {
  // Clean up admin users - remove fields they shouldn't have
  if (this.role === "admin") {
    // Auto-remove invalid fields for admin users
    if (this.homeAddress !== undefined) {
      this.homeAddress = undefined;
    }
    if (this.idDocument !== undefined) {
      this.idDocument = undefined;
    }
  }

  // For regular (non-Google) users, set profile as complete immediately
  if (!this.isGoogleUser && this.isNew) {
    this.isProfileComplete = true;
  }

  if (this.isGoogleUser) {
    const hasCommonInfo =
      this.lastName &&
      this.firstName &&
      // middleInitial and birthdate are conditionally required based on isProfileComplete
      // We are *trying* to make isProfileComplete true, so these must be present.
      this.middleInitial &&
      this.birthdate &&
      this.age &&
      this.phone; // Phone is conditionally required based on isProfileComplete

    let roleSpecificInfoPresent = false;
    if (this.role === "driver") {
      roleSpecificInfoPresent =
        this.licenseNumber &&
        this.homeAddress &&
        this.homeAddress.street && // Assuming street is enough for address validation here
        this.vehicle &&
        this.vehicle.make &&
        this.vehicle.series &&
        this.vehicle.yearModel &&
        this.vehicle.color &&
        this.vehicle.type &&
        this.vehicle.plateNumber &&
        this.vehicle.bodyNumber &&
        this.idDocument &&
        this.idDocument.imageUrl;
    } else if (this.role === "passenger") {
      roleSpecificInfoPresent =
        this.passengerCategory &&
        this.homeAddress &&
        this.homeAddress.street &&
        this.idDocument &&
        this.idDocument.imageUrl; // Ensure ID document is required for passengers too
    }

    const hasUsername = this.username;

    // If it's already true, keep it true.
    const shouldBeComplete =
      hasCommonInfo && roleSpecificInfoPresent && hasUsername;

    if (shouldBeComplete) {
      this.isProfileComplete = true;
    } else {
      this.isProfileComplete = false; // Keep it false if anything is missing
    }
  }
  next();
});

// Pre-save hook to handle age transitions and category updates
userSchema.pre("save", async function (next) {
  // Calculate current age
  if (this.birthdate) {
    const today = new Date();
    const birthDate = new Date(this.birthdate);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    const previousAge = this.age;
    this.age = age;

    // Handle age transitions for passengers
    if (this.role === "passenger" && previousAge && previousAge !== age) {
      this.ageTransitions.push({
        fromAge: previousAge,
        toAge: age,
        transitionDate: new Date(),
        categoryChanged: false,
        previousCategory: this.passengerCategory,
      });

      // Auto-update category based on age transitions
      if (previousAge === 12 && age === 13) {
        // Transition from student_child to student
        if (this.passengerCategory === "student_child") {
          this.passengerCategory = "student";
          this.ageTransitions[
            this.ageTransitions.length - 1
          ].categoryChanged = true;
          this.ageTransitions[this.ageTransitions.length - 1].newCategory =
            "student";
        }
      }

      if (age === 19 && this.passengerCategory === "student") {
        // Set school ID validation requirement
        const currentYear = new Date().getFullYear();
        const nextAugust = new Date(currentYear, 7, 31); // August 31st

        this.schoolIdValidation = {
          currentSchoolYear: `${currentYear}-${currentYear + 1}`,
          expirationDate: nextAugust,
          validated: false,
          reminderSent: false,
        };
      }
    }
  }
  next();
});

// Method to check if school ID validation is required
userSchema.methods.requiresSchoolIdValidation = function () {
  if (
    this.role !== "passenger" ||
    this.passengerCategory !== "student" ||
    this.age < 19
  ) {
    return false;
  }

  if (!this.schoolIdValidation || !this.schoolIdValidation.expirationDate) {
    return true;
  }

  return (
    new Date() > this.schoolIdValidation.expirationDate &&
    !this.schoolIdValidation.validated
  );
};

// Method to check if user is eligible for category change
userSchema.methods.canChangeCategory = function () {
  const eligibleCategories = [];

  if (this.age >= 18) {
    eligibleCategories.push("regular");
  }

  if (this.age >= 12) {
    eligibleCategories.push("student");
  }

  if (this.age >= 60) {
    eligibleCategories.push("senior");
  }

  return eligibleCategories.filter((cat) => cat !== this.passengerCategory);
};

const User = mongoose.model("User", userSchema);

export default User;
