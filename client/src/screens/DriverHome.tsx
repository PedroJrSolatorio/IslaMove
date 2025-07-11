import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  Alert,
  ScrollView,
  Modal,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  Vibration,
  TextInput,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Switch,
  Avatar,
  Divider,
  Badge,
} from 'react-native-paper';
import MapView, {Marker, PROVIDER_GOOGLE, Polyline} from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {decode} from '@googlemaps/polyline-codec';
import {useAuth} from '../context/AuthContext';
import {useProfile} from '../context/ProfileContext';
import SocketService from '../services/SocketService';
import {GlobalStyles} from '../styles/GlobalStyles';
import {TabsStyles} from '../styles/TabsStyles';
import api from '../../utils/api';
import DriverRatingModal from '../components/DriverRatingModal';
import {styles} from '../styles/DriverHomeStyles';
import {useFocusEffect} from '@react-navigation/native';
import SoundUtils from '../../utils/SoundUtils';
import Toast from 'react-native-toast-message';
import DeviceInfo from 'react-native-device-info';

// Driver status type
type DriverStatus = 'offline' | 'available' | 'busy';

// Ride status type
type RideStatus =
  | 'requested'
  | 'accepted'
  | 'arrived'
  | 'inProgress'
  | 'completed';

// Interfaces
interface Location {
  type: string;
  coordinates: [number, number];
  address: string;
}

interface Passenger {
  _id: string;
  firstName: string;
  lastName: string;
  middleInitial: string;
  profileImage?: string;
  phoneNumber: string;
  rating: number;
}

interface RideRequest {
  _id: string;
  passenger: Passenger;
  pickupLocation: Location;
  destinationLocation: Location;
  estimatedDistance: number;
  estimatedDuration: number;
  price: number;
  status: RideStatus;
  requestTime: string;
  fromZone: {
    _id: string;
    name: string;
  };
  toZone: {
    _id: string;
    name: string;
  };
  routePath?: string[];
}

const DriverHome = () => {
  const {logout, userToken, userRole} = useAuth();
  const {profileData, refreshProfile} = useProfile();
  const mapRef = useRef<MapView | null>(null);
  const [mapKey, setMapKey] = useState(0);

  // States
  const [driverStatus, setDriverStatus] = useState<DriverStatus>('offline');
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [activeRides, setActiveRides] = useState<RideRequest[]>([]);
  const [pendingRequest, setPendingRequest] = useState<RideRequest | null>(
    null,
  );
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedRideForRating, setSelectedRideForRating] =
    useState<RideRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationUpdateInterval, setLocationUpdateInterval] =
    useState<NodeJS.Timeout | null>(null);
  const [requestTimer, setRequestTimer] = useState<NodeJS.Timeout | null>(null);
  const [requestTimeRemaining, setRequestTimeRemaining] = useState(20);
  const [routeCoordinates, setRouteCoordinates] = useState<{
    [key: string]: any[];
  }>({});
  const driverStatusRef = useRef(driverStatus);
  const activeRidesRef = useRef(activeRides);
  const requestTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [networkError, setNetworkError] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelRideId, setCancelRideId] = useState<string | null>(null);

  useEffect(() => {
    driverStatusRef.current = driverStatus;
  }, [driverStatus]);
  useEffect(() => {
    activeRidesRef.current = activeRides;
  }, [activeRides]);
  useEffect(() => {
    requestTimerRef.current = requestTimer;
  }, [requestTimer]);

  // Constants
  const MAX_PASSENGERS = 5;
  const REQUEST_TIMEOUT = 20; // seconds

  // Request location permissions
  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message:
            'This app needs access to your location to find nearby ride requests.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return false;
  };

  // Get current location
  const getCurrentLocation = () => {
    return new Promise<Location>((resolve, reject) => {
      Geolocation.getCurrentPosition(
        async position => {
          const {longitude, latitude} = position.coords;

          try {
            const response = await api.get('/api/google/geocode', {
              params: {latlng: `${latitude},${longitude}`},
              timeout: 10000,
            });

            const address =
              response.data.results[0]?.formatted_address || 'Unknown location';

            const location: Location = {
              type: 'Point',
              coordinates: [longitude, latitude],
              address: address,
            };

            resolve(location);
          } catch (error) {
            console.error('Error getting address:', error);
            // Still resolve with coordinates even if geocoding fails
            resolve({
              type: 'Point',
              coordinates: [longitude, latitude],
              address: 'Unknown location',
            });
          }
        },
        error => {
          console.error(error);
          reject(error);
        },
        {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
      );
    });
  };

  const initializeDriver = async () => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Location permission is required to receive ride requests.',
        );
        setLoading(false);
        setNetworkError(true);
        return;
      }

      const location = await getCurrentLocation();
      setCurrentLocation(location);

      const deviceId = await DeviceInfo.getUniqueId();
      // Setup socket connection
      if (userToken) {
        console.log(
          'Connecting with token:',
          userToken.substring(0, 20) + '...',
        ); // Log first 20 chars for debugging
        await SocketService.connect(userToken, deviceId);
        setupSocketListeners();
      } else {
        console.error('No user token available for socket connection');
        Alert.alert('Authentication Error', 'Please log in again to continue.');
        setNetworkError(true);
        return;
      }

      setLoading(false);
      setNetworkError(false);
    } catch (error) {
      console.error('Error initializing driver:', error);
      setLoading(false);
      setNetworkError(true);
    }
  };

  // Initialize location and socket
  useEffect(() => {
    initializeDriver();

    return () => {
      if (locationUpdateInterval) {
        clearInterval(locationUpdateInterval);
      }
      if (requestTimer) {
        clearTimeout(requestTimer);
      }
      SocketService.disconnect();
    };
  }, [userToken]);

  // Verify authentication and profile access
  useEffect(() => {
    const verifyAuth = async () => {
      if (!userToken) {
        console.error('No userToken available');
        Alert.alert('Authentication Error', 'Please log in again to continue.');
        logout();
        return;
      }

      console.log('Token available:', userToken.substring(0, 20) + '...');

      // First check if we have profile data from context
      if (profileData) {
        console.log('Profile data available from context:', {
          id: profileData._id,
          name: profileData.firstName + ' ' + profileData.lastName,
          role: profileData.role,
          // driverStatus: profileData.driverStatus
        });
        return;
      }

      // If no profile data, check if it's being loaded
      console.log(
        'No profile data available from context - may still be loading',
      );
    };

    verifyAuth();
  }, [userToken, profileData]);

  useFocusEffect(
    useCallback(() => {
      // Force MapView to re-mount
      setMapKey(prev => prev + 1);
    }, []),
  );

  useEffect(() => {
    SoundUtils.initializeSounds();
    return () => {
      SoundUtils.releaseSounds();
    };
  }, []);

  useEffect(() => {
    if (!SocketService) return;
    SocketService.on(
      'driver_rated',
      (data: {rating: number; totalRatings: number}) => {
        // Optionally show a toast or alert
        // Example: Alert.alert('You were rated!', `New rating: ${data.rating}`);
        refreshProfile();
      },
    );
    return () => {
      SocketService.off('driver_rated');
    };
  }, [refreshProfile]);

  // Setup socket event listeners
  const setupSocketListeners = () => {
    // can just remove the lines for connect and disconnect, but it can also be used if want to show a connection indicator in UI
    SocketService.on('connect', () => {
      console.log('Socket connected successfully');
    });
    SocketService.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    SocketService.on('error', (error: any) => {
      console.error('Socket error:', error);
      Alert.alert(
        'Connection Error',
        'Failed to connect to server. Please check your internet connection.',
      );
    });

    SocketService.on('ride_request', (request: RideRequest) => {
      console.log('Received new ride request:', request);
      if (
        driverStatusRef.current === 'available' &&
        activeRidesRef.current.length < MAX_PASSENGERS
      ) {
        Vibration.vibrate(1000);
        SoundUtils.playDing();
        setPendingRequest(request);
        setShowRequestModal(true);
        setRequestTimeRemaining(REQUEST_TIMEOUT);

        // Clear any existing timer
        if (requestTimerRef.current) {
          clearTimeout(requestTimerRef.current);
        }

        // Start countdown timer
        const timer = setInterval(() => {
          setRequestTimeRemaining(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              handleDeclineRequest();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        setRequestTimer(timer);
        requestTimerRef.current = timer;
      } else {
        console.log('Driver not available for new rides:', {
          driverStatus: driverStatusRef.current,
          activeRidesCount: activeRidesRef.current.length,
          maxPassengers: MAX_PASSENGERS,
        });
      }
    });

    SocketService.on(
      'ride_cancelled',
      (data: {rideId: string; reason: string}) => {
        setActiveRides(prev => prev.filter(ride => ride._id !== data.rideId));

        Toast.show({
          type: 'info', // or 'info', 'error'
          text1: 'Ride Cancelled',
          text2: `Passenger cancelled the ride: ${data.reason}`,
          visibilityTime: 4000, // 4 seconds
        });
      },
    );

    SocketService.on('ride_completed', (data: {rideId: string}) => {
      const completedRide = activeRides.find(ride => ride._id === data.rideId);
      if (completedRide) {
        setSelectedRideForRating(completedRide);
        setShowRatingModal(true);
        setActiveRides(prev => prev.filter(ride => ride._id !== data.rideId));
      }
    });

    // Add listener for ride acceptance confirmation
    SocketService.on('ride_accept_confirmed', (data: {rideId: string}) => {
      console.log('Ride acceptance confirmed:', data);
      // Handle successful ride acceptance
    });

    // Add listener for when ride is taken by another driver
    SocketService.on('ride_taken', (data: {rideId: string}) => {
      console.log('Ride taken by another driver:', data);
      // Clear any pending request if it matches
      if (pendingRequest?._id === data.rideId) {
        setPendingRequest(null);
        setShowRequestModal(false);
        if (requestTimer) {
          clearTimeout(requestTimer);
        }
      }
    });
  };

  // Toggle driver status
  const toggleDriverStatus = async () => {
    if (driverStatus === 'offline') {
      try {
        if (!currentLocation) {
          const location = await getCurrentLocation();
          setCurrentLocation(location);
        }

        // Update status on server
        await api.post('/api/drivers/status', {
          status: 'available',
          location: currentLocation,
        });

        setDriverStatus('available');
        startLocationUpdates();
        Toast.show({
          type: 'success', // or 'info', 'error'
          text1: 'Status Updated',
          text2: 'You’re online and available for trips.',
          visibilityTime: 4000, // 4 seconds
        });
      } catch (error) {
        console.error('Error updating status:', error);
        Alert.alert('Error', 'Failed to update status. Please try again.');
      }
    } else {
      if (activeRides.length > 0) {
        Alert.alert(
          'Active Rides',
          'You have active rides. Please complete them before going offline.',
        );
        return;
      }

      try {
        await api.post('/api/drivers/status', {
          status: 'offline',
          isOnline: false,
          isAvailable: false,
        });
        setDriverStatus('offline');
        stopLocationUpdates();
        Toast.show({
          type: 'success', // or 'info', 'error'
          text1: 'Status Updated',
          text2: 'You are now offline.',
          visibilityTime: 4000, // 4 seconds
        });
      } catch (error) {
        console.error('Error updating status:', error);
        Alert.alert('Error', 'Failed to update status. Please try again.');
      }
    }
  };

  // Start location updates
  const startLocationUpdates = () => {
    const interval = setInterval(async () => {
      try {
        const location = await getCurrentLocation();
        setCurrentLocation(location);

        // Send location update to server
        try {
          await api.post(
            '/api/drivers/location',
            {
              location: {
                type: 'Point',
                coordinates: location.coordinates,
                address: location.address,
              },
            },
            {
              timeout: 8000, // 8 second timeout
            },
          );
        } catch (locationError) {
          console.error('Failed to update location on server:', locationError);
          // Don't throw - just log the error and continue
        }

        // Update location for active rides
        activeRides.forEach(ride => {
          if (SocketService.isConnected()) {
            SocketService.emit('driver_location_update', {
              rideId: ride._id,
              location: {
                lat: location.coordinates[1],
                lng: location.coordinates[0],
              },
              driverId: profileData?._id,
            });
          }
        });
      } catch (error) {
        console.error('Error updating location:', error);
      }
    }, 10000); // Update every 10 seconds

    setLocationUpdateInterval(interval);
  };

  // Stop location updates
  const stopLocationUpdates = () => {
    if (locationUpdateInterval) {
      clearInterval(locationUpdateInterval);
      setLocationUpdateInterval(null);
    }
  };

  // Helper function to construct full name
  const getFullName = (passenger: Passenger): string => {
    return `${passenger.firstName} ${passenger.middleInitial}. ${passenger.lastName}`.trim();
  };

  const joinRideRoom = (rideId: string) => {
    SocketService.emit('join_ride_room', {rideId});
  };

  // Accept ride request
  const handleAcceptRequest = async () => {
    if (!pendingRequest) return;

    try {
      const response = await api.post(
        `/api/rides/${pendingRequest._id}/accept`,
      );

      setPendingRequest(null);
      setShowRequestModal(false);

      if (requestTimer) {
        clearTimeout(requestTimer);
        setRequestTimer(null);
      }

      // Join the ride room for real-time updates
      joinRideRoom(pendingRequest._id);

      // Only set to busy if this will reach the max passengers
      setActiveRides(prev => {
        const alreadyExists = prev.some(r => r._id === pendingRequest!._id);
        if (alreadyExists) return prev;

        const newRides = [
          ...prev,
          {...pendingRequest!, status: 'accepted' as RideStatus},
        ];
        if (newRides.length >= MAX_PASSENGERS) {
          setDriverStatus('busy');
        } else {
          setDriverStatus('available');
        }
        return newRides;
      });

      // Calculate route to pickup location
      calculateRoute(
        pendingRequest._id,
        currentLocation!,
        pendingRequest.pickupLocation,
      );

      Toast.show({
        type: 'success', // or 'info', 'error'
        text1: 'You’re On It!',
        text2: 'Navigate to the pickup location!',
        visibilityTime: 4000, // 4 seconds
      });
    } catch (error) {
      console.error('Error accepting ride:', error);
      Alert.alert('Error', 'Failed to accept ride. Please try again.');
    }
  };

  // Decline ride request
  const handleDeclineRequest = () => {
    if (pendingRequest) {
      SocketService.emit('ride_declined', {rideId: pendingRequest._id});
    }

    setPendingRequest(null);
    setShowRequestModal(false);

    if (requestTimer) {
      clearTimeout(requestTimer);
      setRequestTimer(null);
    }
  };

  // Calculate route
  const calculateRoute = async (
    rideId: string,
    origin: Location,
    destination: Location,
  ) => {
    try {
      const response = await api.get('/api/google/directions', {
        params: {
          origin: `${origin.coordinates[1]},${origin.coordinates[0]}`,
          destination: `${destination.coordinates[1]},${destination.coordinates[0]}`,
        },
      });

      if (response.data.routes && response.data.routes.length > 0) {
        const route = response.data.routes[0];
        if (route.overview_polyline?.points) {
          const points = decode(route.overview_polyline.points);
          const routeCoords = points.map((point: number[]) => ({
            latitude: point[0],
            longitude: point[1],
          }));

          setRouteCoordinates(prev => ({
            ...prev,
            [rideId]: routeCoords,
          }));
        }
      }
    } catch (error) {
      console.error('Error calculating route:', error);
    }
  };

  // Update ride status
  const updateRideStatus = async (rideId: string, status: RideStatus) => {
    try {
      console.log(`Updating ride ${rideId} to status: ${status}`);
      // First emit via socket for real-time updates
      if (SocketService.isConnected()) {
        SocketService.emit('ride_status_update', {
          rideId,
          status,
          driverId: profileData?._id,
          timestamp: new Date().toISOString(),
        });
      }

      // Then update via API
      const response = await api.put(
        `/api/rides/${rideId}`,
        {
          status,
          updatedAt: new Date().toISOString(),
          ...(status === 'completed' && {
            completedAt: new Date().toISOString(),
          }),
        },
        {
          timeout: 10000, // 10 second timeout
        },
      );

      console.log('Ride status update response:', response.data);

      setActiveRides(prev =>
        prev.map(ride => (ride._id === rideId ? {...ride, status} : ride)),
      );

      // Handle different status updates
      switch (status) {
        case 'arrived':
          Toast.show({
            type: 'success', // or 'info', 'error'
            text1: 'Arrived',
            text2: 'You have arrived at the pickup location!',
            visibilityTime: 4000, // 4 seconds
          });
          break;
        case 'inProgress':
          Toast.show({
            type: 'success', // or 'info', 'error'
            text1: 'Ride Started',
            text2: 'Ride is now in progress!',
            visibilityTime: 4000, // 4 seconds
          });
          const ride = activeRides.find(r => r._id === rideId);
          if (ride) {
            calculateRoute(rideId, currentLocation!, ride.destinationLocation);
          }
          break;
        case 'completed':
          // Show a toast
          Toast.show({
            type: 'success', // or 'info', 'error'
            text1: 'Ride Completed',
            text2: 'Ride has been completed successfully!',
            visibilityTime: 4000, // 4 seconds
          });
          // Remove the completed ride
          const completedRide = activeRides.find(r => r._id === rideId);
          const remainingRides = activeRides.filter(r => r._id !== rideId);
          setActiveRides(remainingRides);

          // Show rating modal for the completed ride
          if (completedRide) {
            setTimeout(() => {
              setSelectedRideForRating(completedRide);
              setShowRatingModal(true);
            }, 2000); // 2000 ms = 2 seconds delay before rating modal shows
          }

          // Update driver status based on remaining rides
          if (remainingRides.length < MAX_PASSENGERS) {
            setDriverStatus('available');
            // Update server status
            try {
              await api.post(
                '/api/drivers/status',
                {
                  status: 'available',
                  isAvailable: true,
                },
                {
                  timeout: 8000,
                },
              );
            } catch (statusError) {
              console.error('Failed to update driver status:', statusError);
            }
          }
          // Update totalRides on the backend
          try {
            await api.post('/api/rides/increment-totalRides');
          } catch (err) {
            console.error('Failed to increment totalRides:', err);
          }
          refreshProfile();
          break;
      }
    } catch (error: any) {
      console.error('Error updating ride status:', error);
      // Provide more specific error messages
      let errorMessage = 'Failed to update ride status.';
      if (error.response?.status === 400) {
        errorMessage =
          'Invalid ride status update. Please check the ride details.';
      } else if (error.response?.status === 404) {
        errorMessage = 'Ride not found. It may have been cancelled.';
      } else if (error.code === 'NETWORK_ERROR' || !error.response) {
        errorMessage =
          'Network error. Please check your connection and try again.';
      }

      Alert.alert('Error', errorMessage);
    }
  };

  // Submit passenger rating
  const submitPassengerRating = async (rating: number, feedback: string) => {
    if (!selectedRideForRating) return;

    try {
      await api.post(`/api/rides/${selectedRideForRating._id}/rate-passenger`, {
        rating,
        feedback,
      });

      setShowRatingModal(false);
      setSelectedRideForRating(null);
      Toast.show({
        type: 'success', // or 'info', 'error'
        text1: 'Rating Submitted',
        text2: 'Thank you for your feedback!',
        visibilityTime: 4000, // 4 seconds
      });
    } catch (error) {
      console.error('Error submitting rating:', error);
      Alert.alert('Error', 'Failed to submit rating.');
    }
  };

  // Render ride request modal
  const renderRequestModal = () => (
    <Modal
      visible={showRequestModal}
      transparent
      animationType="slide"
      onRequestClose={() => {}}>
      <View style={styles.modalOverlay}>
        <Card style={styles.requestModal}>
          <Card.Content>
            <View style={styles.requestHeader}>
              <Title>New Ride Request</Title>
              <Badge
                style={styles.timerBadge}>{`${requestTimeRemaining}s`}</Badge>
            </View>

            {pendingRequest && (
              <>
                <View style={styles.passengerInfo}>
                  <Avatar.Image
                    size={50}
                    source={
                      pendingRequest.passenger.profileImage
                        ? {uri: pendingRequest.passenger.profileImage}
                        : require('../assets/images/avatar-default-icon.png')
                    }
                  />
                  <View style={styles.passengerDetails}>
                    <Text style={styles.passengerName}>
                      {getFullName(pendingRequest.passenger)}
                    </Text>
                    <View style={styles.ratingContainer}>
                      <Icon name="star" size={16} color="#f39c12" />
                      <Text>{pendingRequest.passenger.rating.toFixed(1)}</Text>
                    </View>
                  </View>
                </View>

                <Divider style={styles.divider} />

                <View style={styles.rideDetails}>
                  <View style={styles.locationItem}>
                    <Icon name="map-marker" size={20} color="#3498db" />
                    <Text style={styles.locationText} numberOfLines={2}>
                      {pendingRequest.pickupLocation.address}
                    </Text>
                  </View>

                  <View style={styles.locationItem}>
                    <Icon name="flag-checkered" size={20} color="#e74c3c" />
                    <Text style={styles.locationText} numberOfLines={2}>
                      {pendingRequest.destinationLocation.address}
                    </Text>
                  </View>

                  <View style={styles.tripInfo}>
                    <View style={styles.tripInfoItem}>
                      <Icon name="map-marker-distance" size={16} color="#666" />
                      <Text style={styles.tripInfoText}>
                        {pendingRequest.estimatedDistance.toFixed(1)} km
                      </Text>
                    </View>
                    <View style={styles.tripInfoItem}>
                      <Icon name="clock-outline" size={16} color="#666" />
                      <Text style={styles.tripInfoText}>
                        {pendingRequest.estimatedDuration} min
                      </Text>
                    </View>
                    <View style={styles.tripInfoItem}>
                      <Icon name="currency-php" size={16} color="#27ae60" />
                      <Text style={styles.tripInfoText}>
                        ₱{pendingRequest.price}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.requestButtons}>
                  <Button
                    mode="outlined"
                    style={styles.declineButton}
                    onPress={handleDeclineRequest}>
                    Decline
                  </Button>
                  <Button
                    mode="contained"
                    style={styles.acceptButton}
                    onPress={handleAcceptRequest}>
                    Accept
                  </Button>
                </View>
              </>
            )}
          </Card.Content>
        </Card>
      </View>
    </Modal>
  );

  // Render active ride item
  const renderActiveRide = (ride: RideRequest) => (
    <Card key={ride._id} style={styles.rideCard}>
      <Card.Content>
        <View style={styles.rideHeader}>
          <View style={styles.passengerInfo}>
            <Avatar.Image
              size={40}
              source={
                ride.passenger.profileImage
                  ? {uri: ride.passenger.profileImage}
                  : require('../assets/images/avatar-default-icon.png')
              }
            />
            <View style={styles.passengerDetails}>
              <Text style={styles.passengerName}>
                {getFullName(ride.passenger)}
              </Text>
              <Text style={styles.ridePrice}>₱{ride.price}</Text>
            </View>
          </View>
          <Badge style={getStatusBadgeStyle(ride.status)}>
            {ride.status.toUpperCase()}
          </Badge>
        </View>

        <View style={styles.locationsList}>
          <View style={styles.locationItem}>
            <Icon name="map-marker" size={16} color="#3498db" />
            <Text style={styles.locationText} numberOfLines={1}>
              {ride.pickupLocation.address}
            </Text>
          </View>
          <View style={styles.locationItem}>
            <Icon name="flag-checkered" size={16} color="#e74c3c" />
            <Text style={styles.locationText} numberOfLines={1}>
              {ride.destinationLocation.address}
            </Text>
          </View>
        </View>

        <View style={styles.rideActions}>
          {ride.status === 'accepted' && (
            <>
              <Button
                mode="contained"
                onPress={() => updateRideStatus(ride._id, 'arrived')}>
                Mark as Arrived
              </Button>
              <Button
                mode="outlined"
                style={{marginTop: 8}}
                onPress={() => {
                  setCancelRideId(ride._id);
                  setShowCancelModal(true);
                }}>
                Cancel Ride
              </Button>
            </>
          )}
          {ride.status === 'arrived' && (
            <Button
              mode="contained"
              onPress={() => updateRideStatus(ride._id, 'inProgress')}>
              Start Ride
            </Button>
          )}
          {ride.status === 'inProgress' && (
            <Button
              mode="contained"
              onPress={() => updateRideStatus(ride._id, 'completed')}>
              Complete Ride
            </Button>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  const getStatusBadgeStyle = (status: RideStatus) => {
    const baseStyle = {marginLeft: 8};
    switch (status) {
      case 'accepted':
        return {...baseStyle, backgroundColor: '#3498db'};
      case 'arrived':
        return {...baseStyle, backgroundColor: '#f39c12'};
      case 'inProgress':
        return {...baseStyle, backgroundColor: '#27ae60'};
      default:
        return {...baseStyle, backgroundColor: '#95a5a6'};
    }
  };

  if (loading) {
    return (
      <View style={GlobalStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading profile...</Text>
        {networkError && (
          <Button
            mode="contained"
            style={{marginTop: 16}}
            onPress={() => {
              setLoading(true);
              setNetworkError(false);
              initializeDriver();
            }}>
            Retry
          </Button>
        )}
      </View>
    );
  }

  if (!userToken || userRole !== 'driver') {
    logout();
    return null;
  }

  return (
    <>
      <View style={GlobalStyles.header}>
        <Text style={GlobalStyles.headerTitle}>
          Welcome back, {profileData?.firstName?.split(' ')[0] || 'Passenger'}!
        </Text>
        <View style={{height: 46}} />
      </View>

      {/* Status Card */}
      <Card style={TabsStyles.rideCard}>
        <Card.Content>
          <View style={TabsStyles.rideCardRow}>
            <View>
              <Title>Driver Status</Title>
              <Text style={styles.statusText}>
                {driverStatus === 'offline'
                  ? 'Offline'
                  : driverStatus === 'available'
                  ? 'Online & Available'
                  : 'Busy'}
              </Text>
            </View>
            <Switch
              value={driverStatus !== 'offline'}
              onValueChange={toggleDriverStatus}
              disabled={driverStatus === 'busy'}
            />
          </View>

          {activeRides.length > 0 && (
            <View style={styles.activeRidesInfo}>
              <Text style={styles.activeRidesText}>
                Active Rides: {activeRides.length}/{MAX_PASSENGERS}
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Map */}
      {currentLocation && (
        <View style={styles.mapContainer}>
          <MapView
            key={mapKey}
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            region={{
              latitude: currentLocation.coordinates[1],
              longitude: currentLocation.coordinates[0],
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            showsUserLocation={true}
            showsMyLocationButton={true}>
            {/* Driver location */}
            <Marker
              coordinate={{
                latitude: currentLocation.coordinates[1],
                longitude: currentLocation.coordinates[0],
              }}
              title="Your Location">
              <Icon name="car" size={30} color="#3498db" />
            </Marker>

            {/* Active ride markers and routes */}
            {activeRides.map(ride => (
              <React.Fragment key={ride._id}>
                <Marker
                  coordinate={{
                    latitude: ride.pickupLocation.coordinates[1],
                    longitude: ride.pickupLocation.coordinates[0],
                  }}
                  title={`Pickup - ${getFullName(ride.passenger)}`}
                  pinColor="#3498db"
                />
                <Marker
                  coordinate={{
                    latitude: ride.destinationLocation.coordinates[1],
                    longitude: ride.destinationLocation.coordinates[0],
                  }}
                  title={`Destination - ${getFullName(ride.passenger)}`}
                  pinColor="#e74c3c"
                />

                {routeCoordinates[ride._id] && (
                  <Polyline
                    coordinates={routeCoordinates[ride._id]}
                    strokeWidth={3}
                    strokeColor="#3498db"
                  />
                )}
              </React.Fragment>
            ))}
          </MapView>
        </View>
      )}

      {/* Active Rides List */}
      <ScrollView style={styles.ridesContainer}>
        {activeRides.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Active Rides</Text>
            {activeRides.map(renderActiveRide)}
          </>
        ) : (
          driverStatus === 'available' && (
            <Card style={styles.emptyCard}>
              <Card.Content style={styles.emptyContent}>
                <Icon name="car-clock" size={64} color="#bdc3c7" />
                <Title style={styles.emptyTitle}>
                  Waiting for ride requests
                </Title>
                <Paragraph style={styles.emptyText}>
                  You're online and ready to receive ride requests!
                </Paragraph>
              </Card.Content>
            </Card>
          )
        )}
      </ScrollView>

      {/* Modals */}
      {renderRequestModal()}

      <DriverRatingModal
        visible={showRatingModal}
        onClose={() => {
          setShowRatingModal(false);
          setSelectedRideForRating(null);
        }}
        onSubmit={submitPassengerRating}
        passengerName={
          selectedRideForRating
            ? getFullName(selectedRideForRating.passenger)
            : 'passenger'
        }
      />

      <Modal visible={showCancelModal} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#00000088',
          }}>
          <Card style={{width: 300, padding: 16}}>
            <Title>Cancel Ride</Title>
            <TextInput
              placeholder="Reason for cancellation"
              value={cancelReason}
              onChangeText={setCancelReason}
            />
            <Button
              mode="contained"
              onPress={async () => {
                if (!cancelReason.trim()) {
                  Alert.alert('Error', 'Reason is required.');
                  return;
                }
                try {
                  await api.post(`/api/rides/${cancelRideId}/cancel`, {
                    reason: cancelReason,
                  });
                  setActiveRides(prev =>
                    prev.filter(r => r._id !== cancelRideId),
                  );
                  Toast.show({
                    type: 'success',
                    text1: 'Ride Cancelled',
                    text2: 'You have cancelled the ride.',
                    visibilityTime: 4000,
                  });
                  setShowCancelModal(false);
                  setCancelReason('');
                  setCancelRideId(null);
                } catch (error) {
                  Alert.alert('Error', 'Failed to cancel ride.');
                }
              }}>
              Submit
            </Button>
            <Button onPress={() => setShowCancelModal(false)}>Cancel</Button>
          </Card>
        </View>
      </Modal>
    </>
  );
};

export default DriverHome;
