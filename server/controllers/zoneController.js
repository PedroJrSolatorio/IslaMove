import Zone from "../models/Zone.js";
import Pricing from "../models/Pricing.js";

// Create a new zone
export const createZone = async (req, res) => {
  try {
    const {
      name,
      coordinates,
      color,
      description,
      zoneType,
      parentZone,
      priority,
    } = req.body;

    // Validate required fields
    if (
      !name ||
      !coordinates ||
      typeof coordinates !== "object" ||
      coordinates.type !== "Polygon" ||
      !Array.isArray(coordinates.coordinates)
    ) {
      return res.status(400).json({
        success: false,
        message: "Name and valid GeoJSON Polygon coordinates are required",
      });
    }

    // Validate zone type
    if (zoneType && !["barangay", "area", "landmark"].includes(zoneType)) {
      return res.status(400).json({
        success: false,
        message: "Zone type must be 'barangay', 'area', or 'landmark'",
      });
    }

    // Validate parent zone if provided
    if (parentZone) {
      const parent = await Zone.findById(parentZone);
      if (!parent) {
        return res.status(400).json({
          success: false,
          message: "Parent zone does not exist",
        });
      }

      // Areas and landmarks should have barangay parents
      if (zoneType === "area" && parent.zoneType !== "barangay") {
        return res.status(400).json({
          success: false,
          message: "Area zones must have a barangay as parent",
        });
      }
    }

    // Check if zone with this name already exists
    const existingZone = await Zone.findOne({ name });
    if (existingZone) {
      return res.status(400).json({
        success: false,
        message: "A zone with this name already exists",
      });
    }

    // Set default priority based on zone type
    let zonePriority = priority;
    if (!zonePriority) {
      switch (zoneType) {
        case "landmark":
          zonePriority = 3;
          break;
        case "area":
          zonePriority = 2;
          break;
        case "barangay":
        default:
          zonePriority = 1;
          break;
      }
    }

    // Create new zone
    const zone = new Zone({
      name,
      coordinates,
      color: color || "#3498db",
      description: description || "",
      zoneType: zoneType || "barangay",
      parentZone: parentZone || null,
      priority: zonePriority,
    });

    await zone.save();

    // Populate parent zone for response
    const populatedZone = await Zone.findById(zone._id).populate("parentZone");

    res.status(201).json({
      success: true,
      message: "Zone created successfully",
      zone: populatedZone,
    });
  } catch (error) {
    console.error("Error creating zone:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all zones with hierarchy information
export const getAllZones = async (req, res) => {
  try {
    const { zoneType, parentZone } = req.query;

    let query = {};
    if (zoneType) query.zoneType = zoneType;
    if (parentZone) query.parentZone = parentZone;

    const zones = await Zone.find(query)
      .populate("parentZone")
      .sort({ zoneType: 1, priority: -1, name: 1 });

    res.json({ success: true, zones });
  } catch (error) {
    console.error("Error fetching zones:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get barangay zones only
export const getBarangayZones = async (req, res) => {
  try {
    const barangays = await Zone.find({ zoneType: "barangay" }).sort({
      name: 1,
    });

    res.json({ success: true, zones: barangays });
  } catch (error) {
    console.error("Error fetching barangay zones:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get child zones of a parent zone
export const getChildZones = async (req, res) => {
  try {
    const { parentId } = req.params;

    const childZones = await Zone.findChildZones(parentId);

    res.json({ success: true, zones: childZones });
  } catch (error) {
    console.error("Error fetching child zones:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get zone by ID
export const getZoneById = async (req, res) => {
  try {
    const { id } = req.params;
    const zone = await Zone.findById(id).populate("parentZone");

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found",
      });
    }

    // Also get child zones
    const childZones = await Zone.findChildZones(id);

    res.json({
      success: true,
      zone: {
        ...zone.toObject(),
        childZones,
      },
    });
  } catch (error) {
    console.error("Error fetching zone:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update zone
export const updateZone = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      coordinates,
      color,
      description,
      zoneType,
      parentZone,
      priority,
    } = req.body;

    // Check if zone exists
    const zone = await Zone.findById(id);
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found",
      });
    }

    // Validate parent zone if being changed
    if (parentZone && parentZone !== zone.parentZone?.toString()) {
      const parent = await Zone.findById(parentZone);
      if (!parent) {
        return res.status(400).json({
          success: false,
          message: "Parent zone does not exist",
        });
      }
    }

    // Check if another zone with this name exists
    if (name && name !== zone.name) {
      const existingZone = await Zone.findOne({ name });
      if (existingZone && existingZone._id.toString() !== id) {
        return res.status(400).json({
          success: false,
          message: "Another zone with this name already exists",
        });
      }
    }

    // Update zone
    const updatedZone = await Zone.findByIdAndUpdate(
      id,
      {
        name: name || zone.name,
        coordinates: coordinates || zone.coordinates,
        color: color || zone.color,
        description: description !== undefined ? description : zone.description,
        zoneType: zoneType || zone.zoneType,
        parentZone: parentZone !== undefined ? parentZone : zone.parentZone,
        priority: priority !== undefined ? priority : zone.priority,
      },
      { new: true }
    ).populate("parentZone");

    res.json({
      success: true,
      message: "Zone updated successfully",
      zone: updatedZone,
    });
  } catch (error) {
    console.error("Error updating zone:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete zone
export const deleteZone = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if zone exists
    const zone = await Zone.findById(id);
    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Zone not found",
      });
    }

    // Check if zone has child zones
    const childZones = await Zone.findChildZones(id);
    if (childZones.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete zone: it has child zones. Delete child zones first.",
      });
    }

    // Check if zone is used in any pricing rules
    const pricingRules = await Pricing.find({
      $or: [{ fromZone: id }, { toZone: id }],
    });

    if (pricingRules.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete zone: it is used in existing pricing rules",
      });
    }

    // Delete zone
    await Zone.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Zone deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting zone:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lookup zone by coordinates
export const lookupZoneByCoordinates = async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    // Validate input parameters
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    // Get the most specific zone for this location
    const zone = await Zone.findMostSpecificZone(lng, lat);

    if (!zone) {
      return res.json({
        success: false,
        message: "No zone found for these coordinates",
        data: null,
      });
    }

    // Also get all zones that contain this point for context
    const allZones = await Zone.findByCoordinates(lng, lat);

    res.json({
      success: true,
      data: zone,
      allMatchingZones: allZones, // For debugging/context
    });
  } catch (error) {
    console.error("Error looking up zone:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
