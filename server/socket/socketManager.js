import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

let io;

const activeDrivers = new Map();
const activeRides = new Map();

export const initializeSocket = (server) => {
  const allowedOrigins = [
    process.env.CLIENT_URL,
    process.env.LOCAL_CLIENT_URL,
    "http://localhost:3000", // Common development origin
  ].filter(Boolean);

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Middleware for socket authentication
  io.use(async (socket, next) => {
    try {
      console.log("Socket authentication attempt...");
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.replace("Bearer ", "");

      // console.log(
      //   "Token received:",
      //   token ? `${token.substring(0, 20)}...` : "No token"
      // );
      if (!token) {
        console.error("Authentication failed: No token provided");
        return next(new Error("Authentication error: No token provided"));
      }

      // Verify JWT token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
        // console.log("Token decoded successfully:", {
        //   id: decoded.userId,
        //   role: decoded.role,
        // });
      } catch (jwtError) {
        console.error("JWT verification failed:", jwtError.message);
        return next(new Error("Authentication error: Invalid token"));
      }

      const user = await User.findById(decoded.userId).select("-password");

      if (!user) {
        console.error(`User not found in database for ID: ${decoded.id}`);
        console.log("Available users in DB (for debugging):");

        // Debug: List first few users to verify database connection
        try {
          const users = await User.find({})
            .limit(3)
            .select("_id firstName lastName email role");
          console.log("Sample users:", users);
        } catch (dbError) {
          console.error("Database connection issue:", dbError);
        }
        return next(new Error("User not found"));
      }
      console.log(
        `User authenticated successfully: ${user.firstName} ${user.lastName} (${user.role})`
      );

      socket.userId = user._id.toString();
      socket.userRole = user.role;
      socket.userData = user;
      next();
    } catch (error) {
      console.error("Socket authentication error:", error.message);
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.userId} (${socket.userRole})`);

    // Join user to their personal room
    socket.join(`user_${socket.userId}`);

    // Handle driver-specific connections
    if (socket.userRole === "driver") {
      activeDrivers.set(socket.userId, {
        socketId: socket.id,
        location: null,
        isAvailable: false,
      });
      socket.join("drivers"); // Join drivers room for broadcasting
    }

    // Handle passenger-specific connections
    if (socket.userRole === "passenger") {
      socket.join("passengers");
    }

    // Handle driver availability toggle
    socket.on("driver_availability_toggle", async (data) => {
      if (socket.userRole === "driver") {
        try {
          await User.findByIdAndUpdate(socket.userId, {
            isAvailable: data.isAvailable,
          });

          const driver = activeDrivers.get(socket.userId);
          if (driver) {
            driver.isAvailable = data.isAvailable;
            activeDrivers.set(socket.userId, driver);
          }

          // Notify admin/dispatch about driver availability change
          socket.to("admin").emit("driver_availability_changed", {
            driverId: socket.userId,
            isAvailable: data.isAvailable,
          });

          socket.emit("availability_updated", {
            isAvailable: data.isAvailable,
          });
        } catch (error) {
          console.error("Error updating driver availability:", error);
          socket.emit("error", { message: "Failed to update availability" });
        }
      }
    });

    // Handle driver location updates
    socket.on("driver_location_update", async (data) => {
      if (socket.userRole === "driver") {
        try {
          // Validate location data
          if (!data.location || !data.location.lat || !data.location.lng) {
            socket.emit("error", { message: "Invalid location data" });
            return;
          }

          // Update driver location in database
          await User.findByIdAndUpdate(socket.userId, {
            currentLocation: {
              type: "Point",
              coordinates: [data.location.lng, data.location.lat],
            },
            lastLocationUpdate: new Date(),
          });

          // Update in-memory driver data
          const driver = activeDrivers.get(socket.userId);
          if (driver) {
            driver.location = data.location;
            activeDrivers.set(socket.userId, driver);
          }

          // If driver has an active ride, notify the passenger
          if (data.rideId) {
            socket.to(`ride_${data.rideId}`).emit("driver_location_updated", {
              driverId: socket.userId,
              location: data.location,
              rideId: data.rideId,
              timestamp: new Date(),
            });
          }

          // Notify admin/dispatch about driver location
          socket.to("admin").emit("driver_location_broadcast", {
            driverId: socket.userId,
            location: data.location,
            timestamp: new Date(),
          });
        } catch (error) {
          console.error("Error updating driver location:", error);
          socket.emit("error", { message: "Failed to update location" });
        }
      }
    });

    // Handle ride requests from passengers
    socket.on("ride_request", async (data) => {
      if (socket.userRole === "passenger") {
        try {
          console.log(`Ride request from passenger ${socket.userId}:`, data);

          // Store ride request temporarily
          activeRides.set(data.rideId, {
            passengerId: socket.userId,
            driverId: null,
            status: "pending",
            ...data,
          });

          // Join passenger to ride room
          socket.join(`ride_${data.rideId}`);

          // Broadcast to available drivers
          socket.to("drivers").emit("new_ride_request", {
            rideId: data.rideId,
            passenger: {
              id: socket.userId,
              name: socket.userData.name,
              phone: socket.userData.phone,
            },
            pickup: data.pickup,
            destination: data.destination,
            estimatedFare: data.estimatedFare,
            timestamp: new Date(),
          });

          // Notify admin
          socket.to("admin").emit("ride_request_created", {
            rideId: data.rideId,
            passengerId: socket.userId,
            ...data,
          });
        } catch (error) {
          console.error("Error handling ride request:", error);
          socket.emit("error", { message: "Failed to process ride request" });
        }
      }
    });

    // Handle ride acceptance by driver
    socket.on("ride_accept", async (data) => {
      if (socket.userRole === "driver") {
        try {
          const ride = activeRides.get(data.rideId);
          if (!ride) {
            socket.emit("error", { message: "Ride not found" });
            return;
          }

          if (ride.driverId && ride.driverId !== socket.userId) {
            socket.emit("error", {
              message: "Ride already accepted by another driver",
            });
            return;
          }

          // Update ride with driver info
          ride.driverId = socket.userId;
          ride.status = "accepted";
          activeRides.set(data.rideId, ride);

          // Join driver to ride room
          socket.join(`ride_${data.rideId}`);

          // Notify passenger
          socket.to(`user_${ride.passengerId}`).emit("ride_accepted", {
            rideId: data.rideId,
            driver: {
              id: socket.userId,
              name: socket.userData.name,
              phone: socket.userData.phone,
              vehicle: socket.userData.vehicle,
              location: activeDrivers.get(socket.userId)?.location,
            },
          });

          // Notify other drivers that ride is taken
          socket.to("drivers").emit("ride_taken", { rideId: data.rideId });

          // Notify admin
          socket.to("admin").emit("ride_accepted_admin", {
            rideId: data.rideId,
            driverId: socket.userId,
            passengerId: ride.passengerId,
          });

          socket.emit("ride_accept_confirmed", { rideId: data.rideId });
        } catch (error) {
          console.error("Error accepting ride:", error);
          socket.emit("error", { message: "Failed to accept ride" });
        }
      }
    });

    // Handle ride status updates
    socket.on("ride_status_update", (data) => {
      try {
        const ride = activeRides.get(data.rideId);
        if (!ride) {
          socket.emit("error", { message: "Ride not found" });
          return;
        }

        // Verify user is part of this ride
        if (
          ride.passengerId !== socket.userId &&
          ride.driverId !== socket.userId
        ) {
          socket.emit("error", { message: "Unauthorized to update this ride" });
          return;
        }

        // Update ride status
        ride.status = data.status;
        activeRides.set(data.rideId, ride);

        // Broadcast status update to all ride participants
        socket.to(`ride_${data.rideId}`).emit("ride_status_updated", {
          rideId: data.rideId,
          status: data.status,
          updatedBy: socket.userId,
          timestamp: new Date(),
          ...data,
        });

        // Notify admin
        socket.to("admin").emit("ride_status_admin_update", {
          rideId: data.rideId,
          status: data.status,
          updatedBy: socket.userId,
          timestamp: new Date(),
        });

        // Clean up completed rides
        if (data.status === "completed" || data.status === "cancelled") {
          activeRides.delete(data.rideId);
        }
      } catch (error) {
        console.error("Error updating ride status:", error);
        socket.emit("error", { message: "Failed to update ride status" });
      }
    });

    // Handle ride decline from driver
    socket.on("ride_declined", (data) => {
      if (socket.userRole === "driver") {
        console.log(`Driver ${socket.userId} declined ride ${data.rideId}`);

        // Notify admin about the decline
        socket.to("admin").emit("ride_declined_admin", {
          rideId: data.rideId,
          driverId: socket.userId,
          reason: data.reason,
          timestamp: new Date(),
        });

        // You can implement logic here to find next available driver
        // or notify dispatch system
      }
    });

    // Handle admin connections
    if (socket.userRole === "admin") {
      socket.join("admin");

      // Send current system status to admin
      socket.emit("system_status", {
        activeDrivers: activeDrivers.size,
        activeRides: activeRides.size,
        connectedUsers: io.sockets.sockets.size,
      });
    }

    // Handle disconnection
    socket.on("disconnect", (reason) => {
      console.log(`User disconnected: ${socket.userId} (${reason})`);

      // Clean up driver data
      if (socket.userRole === "driver") {
        activeDrivers.delete(socket.userId);

        // Notify admin about driver going offline
        socket.to("admin").emit("driver_offline", {
          driverId: socket.userId,
          timestamp: new Date(),
        });
      }

      // Handle any active rides
      for (const [rideId, ride] of activeRides.entries()) {
        if (
          ride.passengerId === socket.userId ||
          ride.driverId === socket.userId
        ) {
          socket.to(`ride_${rideId}`).emit("participant_disconnected", {
            rideId,
            userId: socket.userId,
            userRole: socket.userRole,
          });
        }
      }
    });

    // Handle connection errors
    socket.on("error", (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};

// Helper function to emit to specific user
export const emitToUser = (userId, event, data) => {
  if (io) {
    io.to(`user_${userId}`).emit(event, data);
  }
};

// Helper function to emit to all drivers
export const emitToDrivers = (event, data) => {
  if (io) {
    io.to("drivers").emit(event, data);
  }
};

// Helper function to emit to all passengers
export const emitToPassengers = (event, data) => {
  if (io) {
    io.to("passengers").emit(event, data);
  }
};

// Helper function to get active drivers
export const getActiveDrivers = () => {
  return Array.from(activeDrivers.entries()).map(([id, data]) => ({
    id,
    ...data,
  }));
};

// Helper function to get active rides
export const getActiveRides = () => {
  return Array.from(activeRides.entries()).map(([id, data]) => ({
    id,
    ...data,
  }));
};
