import Ride from "../models/Ride.js";

export const updateDriverLocation = async (req, res) => {
  try {
    const { longitude, latitude } = req.body;
    const driverId = req.user.id; // From authentication middleware

    // Update driver's current location
    await User.findByIdAndUpdate(driverId, {
      currentLocation: {
        type: "Point",
        coordinates: [longitude, latitude],
      },
    });

    // If driver is on an active ride, update the ride's location tracking
    const activeRide = await Ride.findOne({
      driver: driverId,
      status: { $in: ["accepted", "arrived", "inProgress"] },
    });

    if (activeRide) {
      await Ride.findByIdAndUpdate(activeRide._id, {
        $push: {
          driverLocationUpdates: {
            location: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
          },
        },
      });
    }

    res.status(200).json({ message: "Location updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
