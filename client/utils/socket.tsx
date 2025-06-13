import { io } from "socket.io-client";
import { BACKEND_URL } from "@env";

const socket = io(BACKEND_URL, {
  autoConnect: false,
  transports: ["websocket"],
});

export const connectSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};

export const joinRide = (rideId: string) => {
  socket.emit("joinRide", rideId);
};

export const updateDriverLocation = (data: {
  rideId: string,
  location: any,
}) => {
  socket.emit("updateDriverLocation", data);
};

export const listenToDriverLocation = (callback: (data: any) => void) => {
  socket.on("driverLocationUpdated", callback);
};

export const listenToRideStatus = (callback: (data: any) => void) => {
  socket.on("rideStatusUpdated", callback);
};

export default socket;
