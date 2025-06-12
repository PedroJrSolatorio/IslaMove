import mongoose from "mongoose";

const zoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
    },
    coordinates: {
      type: {
        type: String,
        enum: ["Polygon"],
        required: true,
      },
      coordinates: {
        type: [[[Number]]],
        required: true,
      },
    },
    color: {
      type: String,
      default: "#3498db",
    },
    zoneType: {
      type: String,
      enum: ["barangay", "area", "landmark"],
      default: "barangay",
    },
    parentZone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
      default: null, //null for barangay zones, objectId for areas within barangays
    },
    priority: {
      type: Number,
      default: 1, // Higher number = higher priority (areas have higher priority than barangays)
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Create a 2dsphere index for geospatial queries
zoneSchema.index({ coordinates: "2dsphere" });
zoneSchema.index({ zoneType: 1, parentZOne: 1 });
zoneSchema.index({ priority: -1 });

zoneSchema.statics.findByCoordinates = async function (longitude, latitude) {
  // Find all zones that contain this point, sorted by priority (descending)
  const zones = await this.find({
    coordinates: {
      $geoIntersects: {
        $geometry: {
          type: "Point",
          coordinates: [parseFloat(longitude), parseFloat(latitude)],
        },
      },
    },
    isActive: true,
  })
    .populate("parentZone")
    .sort({ priority: -1 });

  return zones; // Return array of zones, first one is highest priority
};

// Method to get the most specific zone for a location
zoneSchema.statics.findMostSpecificZone = async function (longitude, latitude) {
  const zones = await this.findByCoordinates(longitude, latitude);
  return zones.length > 0 ? zones[0] : null; // Return the highest priority zone
};

// Method to get all child zones of a parent zone
zoneSchema.statics.findChildZones = async function (parentZoneId) {
  return this.find({ parentZone: parentZoneId, isActive: true });
};

const Zone = mongoose.model("Zone", zoneSchema);

export default Zone;
