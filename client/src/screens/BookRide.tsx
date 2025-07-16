import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  PermissionsAndroid,
  Pressable,
  Modal,
  Vibration,
  AppState,
} from 'react-native';
import {
  Text,
  Button,
  Card,
  Title,
  Paragraph,
  Divider,
  Avatar,
} from 'react-native-paper';
import MapView, {
  Marker,
  PROVIDER_GOOGLE,
  Polyline,
  MapType,
} from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {decode} from '@googlemaps/polyline-codec';
import {useAuth} from '../context/AuthContext';
import {isPassengerProfile, useProfile} from '../context/ProfileContext';
import LocationSearchModal from '../components/LocationSearchModal';
import MapTypeSelector from '../components/MapTypeSelector';
import DriverSearchingModal from '../components/DriverSearchingModal';
import DriverDetailsModal from '../components/DriverDetailsModal';
import PassengerRatingModal from '../components/PassengerRatingModal';
import SocketService from '../services/SocketService';
import {styles} from '../styles/BookRideStyles';
import api from '../../utils/api';
import SoundUtils from '../../utils/SoundUtils';
import Toast from 'react-native-toast-message';
import DeviceInfo from 'react-native-device-info';
import {useGeocoding} from '../hooks/useGeocoding';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Interface for fare types
interface FareInfo {
  _id: string;
  fromZone: Zone;
  toZone: Zone;
  baseAmount: number;
  finalAmount: number;
  originalAmount: number;
  pricingType: string;
  description?: string;
  priority: number;
  vehicleType: string;
  isActive: boolean;
  discount: {
    rate: number;
    amount: number;
    type: string;
    ageBasedDiscount: boolean;
  };
  passenger: {
    category: string;
    age: number | null;
    appliedDiscountType: string;
  };
}

// Interface for Zone data
interface Zone {
  _id: string;
  name: string;
  description?: string;
}

// Interface for Driver data
interface Driver {
  _id: string;
  fullName: string;
  profileImage: string;
  rating: number;
  totalRides: number;
  vehicle: {
    make: string;
    model: string;
    color: string;
    plateNumber: string;
  };
  currentLocation: Location;
}

interface LatLng {
  latitude: number;
  longitude: number;
}

interface Location {
  type: string;
  coordinates: [number, number];
  address: string;
  mainText?: string;
  secondaryText?: string;
}

// Ride status type
type RideStatus =
  | 'idle'
  | 'selecting_location'
  | 'confirming_booking'
  | 'searching_driver'
  | 'driver_found'
  | 'driver_arrived'
  | 'in_progress'
  | 'completed';

// storage keys
const STORAGE_KEYS = {
  RIDE_STATE: 'bookride_state',
  RIDE_DATA: 'bookride_data',
};

const BookRide = () => {
  const navigation = useNavigation();
  const {userToken} = useAuth();
  const {profileData} = useProfile();
  const mapRef = useRef<MapView | null>(null);

  // Use the enhanced geocoding hook
  const {
    debouncedGeocodeWithProcessing,
    getCurrentLocationWithGeocoding,
    createImmediateLocation,
    hasValidAddress,
  } = useGeocoding();

  // Type guard to ensure we're working with passenger profile
  const passengerProfile = isPassengerProfile(profileData) ? profileData : null;

  // States
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectingFor, setSelectingFor] = useState<'pickup' | 'destination'>(
    'pickup',
  );
  const [rideStatus, setRideStatus] = useState<RideStatus>('idle');
  const [fareEstimate, setFareEstimate] = useState<FareInfo | null>(null);
  const [fromZone, setFromZone] = useState<Zone | null>(null);
  const [toZone, setToZone] = useState<Zone | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<any[]>([]);
  const [estimatedDistance, setEstimatedDistance] = useState(0);
  const [estimatedDuration, setEstimatedDuration] = useState(0);
  const [assignedDriver, setAssignedDriver] = useState<Driver | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [driverEta, setDriverEta] = useState(0);
  const [mapType, setMapType] = useState<MapType>('satellite');
  const [showMapTypeSelector, setShowMapTypeSelector] = useState(false);
  const [showDestinationConfirmation, setShowDestinationConfirmation] =
    useState(false);
  const [tempSelectedLocation, setTempSelectedLocation] =
    useState<Location | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [canCancel, setCanCancel] = useState(true);
  const [notifiedArrival, setNotifiedArrival] = useState(false);
  const cancelWindowTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [soundsInitialized, setSoundsInitialized] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isRestoringState, setIsRestoringState] = useState(false);

  // Function to request location permissions
  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      // Android permission request
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message:
            'This app needs access to your location to find rides near you.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }

    return false;
  };

  // function to handle map press for destination selection
  const handleMapPress = async (event: any) => {
    // Only allow destination selection when in idle state
    if (rideStatus !== 'idle' && rideStatus !== 'selecting_location') {
      return;
    }

    const {latitude, longitude} = event.nativeEvent.coordinate;

    // Show coordinates immediately using the shared utility
    const immediateLocation = createImmediateLocation(latitude, longitude);
    setTempSelectedLocation(immediateLocation);
    setShowDestinationConfirmation(true);
    setIsGeocoding(true);

    // Geocode in background with debounce
    // Geocode in background using the enhanced hook
    debouncedGeocodeWithProcessing(
      latitude,
      longitude,
      (processedLocation: Location) => {
        setTempSelectedLocation(processedLocation);
        setIsGeocoding(false);
      },
      1500,
    );
  };

  // function to confirm destination selection
  const confirmDestinationSelection = async () => {
    if (tempSelectedLocation) {
      setDestination(tempSelectedLocation);

      // Get zone for destination location
      try {
        const zoneResponse = await api.get('/api/zones/lookup', {
          params: {
            longitude: tempSelectedLocation.coordinates[0],
            latitude: tempSelectedLocation.coordinates[1],
          },
        });

        console.log('Zone response for map selection:', zoneResponse.data);

        let destinationZone = null;

        // Check if the response has the expected structure
        if (
          zoneResponse.data &&
          zoneResponse.data.success &&
          zoneResponse.data.data
        ) {
          destinationZone = zoneResponse.data.data;
        } else if (zoneResponse.data && zoneResponse.data._id) {
          // If the API returns the zone object directly
          destinationZone = zoneResponse.data;
        } else {
          console.error(
            'Unexpected zone response structure:',
            zoneResponse.data,
          );
          Alert.alert(
            'Zone Not Found',
            'Service is not available in this destination area',
          );
          setShowDestinationConfirmation(false);
          setTempSelectedLocation(null);
          return;
        }

        // Set the zone first
        setToZone(destinationZone);

        // Calculate route if current location exists
        if (currentLocation) {
          await calculateRoute(currentLocation, tempSelectedLocation);
        }
      } catch (error) {
        console.error('Error getting zone info:', error);
        Alert.alert(
          'Error',
          'Failed to get zone information for selected location',
        );
      }

      setShowDestinationConfirmation(false);
      setTempSelectedLocation(null);

      if (currentLocation) {
        setRideStatus('selecting_location');
      }
    }
  };

  const calculateRoute = async (pickup: Location, dest: Location) => {
    try {
      // Calculate route using Google Directions API or your preferred service
      const response = await api.get('/api/google/directions', {
        params: {
          origin: `${pickup.coordinates[1]},${pickup.coordinates[0]}`,
          destination: `${dest.coordinates[1]},${dest.coordinates[0]}`,
        },
      });

      if (
        response.data &&
        response.data.routes &&
        response.data.routes.length > 0
      ) {
        const route = response.data.routes[0];
        const leg = route.legs[0];

        // Set distance and duration
        setEstimatedDistance(leg.distance.value / 1000); // Convert to km
        setEstimatedDuration(Math.ceil(leg.duration.value / 60)); // Convert to minutes

        // Decode polyline for route display
        if (route.overview_polyline?.points) {
          const decodedCoords = decode(route.overview_polyline.points);
          const routeCoords = decodedCoords.map(([lat, lng]) => ({
            latitude: lat,
            longitude: lng,
          }));
          setRouteCoordinates(routeCoords);
        }
      }
    } catch (error) {
      console.error('Error calculating route:', error);
    }
  };

  const getDiscountLabel = (
    discountType: string,
    ageBasedDiscount: boolean,
  ): string => {
    if (ageBasedDiscount && discountType === 'student_child') {
      return 'Child Discount (50% off)';
    } else if (discountType === 'student') {
      return 'Student Discount (20% off)';
    } else if (discountType === 'senior') {
      return 'Senior Citizen Discount (20% off)';
    }
    return 'Regular Fare';
  };

  const getPassengerTypeLabel = (
    discountType: string,
    ageBasedDiscount: boolean,
  ): string => {
    if (ageBasedDiscount && discountType === 'student_child') {
      return 'Child';
    } else if (discountType === 'student') {
      return 'Student';
    } else if (discountType === 'senior') {
      return 'Senior Citizen';
    }
    return 'Regular';
  };

  // Save ride state to AsyncStorage
  const saveRideState = async (stateData: any) => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.RIDE_STATE,
        JSON.stringify(stateData),
      );
    } catch (error) {
      console.error('Error saving ride state:', error);
    }
  };

  // Load ride state from AsyncStorage
  const loadRideState = async () => {
    try {
      const savedState = await AsyncStorage.getItem(STORAGE_KEYS.RIDE_STATE);
      if (savedState) {
        return JSON.parse(savedState);
      }
      return null;
    } catch (error) {
      console.error('Error loading ride state:', error);
      return null;
    }
  };

  // Clear saved ride state
  const clearRideState = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.RIDE_STATE);
    } catch (error) {
      console.error('Error clearing ride state:', error);
    }
  };

  // Restore ride state when component mounts or comes into focus
  const restoreRideState = async () => {
    setIsRestoringState(true);
    try {
      const savedState = await loadRideState();
      if (savedState) {
        console.log('Restoring ride state:', savedState);

        // Restore all relevant state
        if (savedState.rideStatus) setRideStatus(savedState.rideStatus);
        if (savedState.destination) setDestination(savedState.destination);
        if (savedState.toZone) setToZone(savedState.toZone);
        if (savedState.fromZone) setFromZone(savedState.fromZone);
        if (savedState.fareEstimate) setFareEstimate(savedState.fareEstimate);
        if (savedState.routeCoordinates)
          setRouteCoordinates(savedState.routeCoordinates);
        if (savedState.estimatedDistance)
          setEstimatedDistance(savedState.estimatedDistance);
        if (savedState.estimatedDuration)
          setEstimatedDuration(savedState.estimatedDuration);
        if (savedState.currentRideId)
          setCurrentRideId(savedState.currentRideId);
        if (savedState.assignedDriver)
          setAssignedDriver(savedState.assignedDriver);
        if (savedState.driverEta) setDriverEta(savedState.driverEta);
        if (savedState.canCancel !== undefined)
          setCanCancel(savedState.canCancel);

        // If there's an active ride, reconnect to socket events
        if (
          savedState.currentRideId &&
          [
            'searching_driver',
            'driver_found',
            'driver_arrived',
            'in_progress',
          ].includes(savedState.rideStatus)
        ) {
          console.log('Reconnecting to active ride:', savedState.currentRideId);
          // The socket setup in useEffect will handle reconnection
        }
      }
    } catch (error) {
      console.error('Error restoring ride state:', error);
    } finally {
      setIsRestoringState(false);
    }
  };

  // Save state whenever relevant state changes
  useEffect(() => {
    if (!isRestoringState && !loading) {
      const stateToSave = {
        rideStatus,
        destination,
        toZone,
        fromZone,
        fareEstimate,
        routeCoordinates,
        estimatedDistance,
        estimatedDuration,
        currentRideId,
        assignedDriver,
        driverEta,
        canCancel,
        timestamp: Date.now(),
      };

      // Only save if there's meaningful state to preserve
      if (rideStatus !== 'idle' || destination || currentRideId) {
        saveRideState(stateToSave);
      }
    }
  }, [
    rideStatus,
    destination,
    toZone,
    fromZone,
    fareEstimate,
    routeCoordinates,
    estimatedDistance,
    estimatedDuration,
    currentRideId,
    assignedDriver,
    driverEta,
    canCancel,
    isRestoringState,
    loading,
  ]);

  // Use focus effect to restore state when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (!loading) {
        restoreRideState();
      }
    }, [loading]),
  );

  // Getting user's current location
  useEffect(() => {
    const fetchCurrentLocation = async () => {
      try {
        // Check if saved state is still valid
        const isStateValid = await checkRideStateExpiry();
        if (!isStateValid) {
          await resetRide();
        }
        const hasPermission = await requestLocationPermission();

        if (!hasPermission) {
          setLoading(false);
          Alert.alert(
            'Permission Error',
            'Please enable location services to use this feature',
            [{text: 'OK', onPress: () => navigation.goBack()}],
          );
          return;
        }

        // Use the enhanced geocoding hook to get current location
        const location = await getCurrentLocationWithGeocoding(
          Geolocation.getCurrentPosition,
          {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
        );

        setCurrentLocation(location);

        // Get zone information for current location
        const zoneResponse = await api.get(`/api/zones/lookup`, {
          params: {
            longitude: location.coordinates[0],
            latitude: location.coordinates[1],
          },
        });

        console.log('Zone response for current location:', zoneResponse.data);

        // Check if the response has the expected structure
        if (
          zoneResponse.data &&
          zoneResponse.data.success &&
          zoneResponse.data.data
        ) {
          // If the API returns {success: true, data: {zone object}}
          setFromZone(zoneResponse.data.data);
        } else if (zoneResponse.data && zoneResponse.data._id) {
          // If the API returns the zone object directly
          setFromZone(zoneResponse.data);
        } else {
          console.error(
            'Unexpected zone response structure:',
            zoneResponse.data,
          );
          Alert.alert(
            'Zone Not Found',
            'Service is not available in your current location area',
          );
        }

        setLoading(false);
      } catch (error) {
        console.error('Error in location processing:', error);
        setLoading(false);
        Alert.alert('Error', 'Failed to get your current location details');
      }
    };

    fetchCurrentLocation();

    // Setup socket connection using SocketService
    const setupSocket = async () => {
      if (!userToken) return;

      const deviceId = await DeviceInfo.getUniqueId();

      try {
        // Connect using the service
        await SocketService.connect(userToken, deviceId);

        // Set up event listeners
        SocketService.on('driver_location_update', (data: any) => {
          if (data.rideId === currentRideId) {
            setAssignedDriver(prev => {
              if (!prev) return null;
              return {
                ...prev,
                currentLocation: data.location,
              };
            });

            // Update ETA
            if (rideStatus === 'driver_found') {
              setDriverEta(data.eta || 0);
            }
          }
        });

        SocketService.on('ride_status_update', async (data: any) => {
          if (data.rideId === currentRideId) {
            switch (data.status) {
              case 'accepted':
                // Clear the search timeout since driver was found
                if (searchTimeoutRef.current) {
                  clearTimeout(searchTimeoutRef.current);
                  searchTimeoutRef.current = null;
                }
                setRideStatus('driver_found');
                setAssignedDriver(data.driver);
                break;
              case 'arrived':
                setRideStatus('driver_arrived');
                break;
              case 'inProgress':
                setRideStatus('in_progress');
                break;
              case 'completed':
                await handleRideCompletion();
                // Show a toast
                Toast.show({
                  type: 'success', // or 'info', 'error'
                  text1: 'Ride Completed',
                  text2: 'Ride has been completed successfully!',
                  visibilityTime: 4000, // 4 seconds
                });

                // Increment totalRides for the driver
                try {
                  await api.post('/api/rides/increment-totalRides');
                } catch (err) {
                  console.error('Failed to increment totalRides:', err);
                }
                break;
            }
          }
        });

        SocketService.on('ride_accepted', (data: any) => {
          // Only handle if this is the current ride
          if (
            data.ride &&
            (data.ride._id === currentRideId || data.rideId === currentRideId)
          ) {
            // Set driver info and update status
            setAssignedDriver(data.driver || data.ride.driver);
            setRideStatus('driver_found');
            // Optionally clear the search timeout
            if (searchTimeoutRef.current) {
              clearTimeout(searchTimeoutRef.current);
              searchTimeoutRef.current = null;
            }
          }
        });

        SocketService.on('ride_cancelled', (data: any) => {
          if (data.rideId === currentRideId) {
            Alert.alert(
              'Ride Cancelled',
              data.reason || 'The driver has cancelled the ride',
              [
                {
                  text: 'Find Another Driver',
                  onPress: () => {
                    resetRideKeepDestination();
                  },
                },
                {
                  text: 'Change Destination',
                  onPress: () => {
                    resetRide();
                  },
                  style: 'cancel',
                },
              ],
            );
          }
        });
      } catch (error) {
        console.error('Socket connection error:', error);
      }
    };

    setupSocket();

    // Cleanup on unmount
    return () => {
      SocketService.off('driver_location_update');
      SocketService.off('ride_status_update');
      SocketService.off('ride_accepted');
      SocketService.off('ride_cancelled');
    };
  }, [userToken, currentRideId, rideStatus]);

  // adding small delay for fair estimation
  useEffect(() => {
    if (fromZone && toZone) {
      // Add a small delay to ensure state is stable
      const timeoutId = setTimeout(() => {
        if (estimatedDistance > 0) {
          fetchFareEstimate(estimatedDistance);
        } else {
          fetchFareEstimate();
        }
      }, 100); // 100ms delay

      return () => clearTimeout(timeoutId);
    }
  }, [fromZone, toZone, estimatedDistance]);

  // Handle map region changes based on selected locations
  useEffect(() => {
    if (mapRef.current && currentLocation && destination) {
      // Fit map to show both markers
      const coordinates = [
        {
          latitude: currentLocation.coordinates[1],
          longitude: currentLocation.coordinates[0],
        },
        {
          latitude: destination.coordinates[1],
          longitude: destination.coordinates[0],
        },
      ];

      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: {top: 100, right: 100, bottom: 100, left: 100},
        animated: true,
      });

      // Get route between the two points
      fetchRouteDetails();
    }
  }, [currentLocation, destination]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear search timeout on component unmount
      if (searchTimeoutRef.current) {
        console.log('Clearing search timeout on unmount');
        clearTimeout(searchTimeoutRef.current);
      }
      // // Disconnect the socket service when component unmounts
      // SocketService.disconnect();
    };
  }, []);

  // setting up cancel window
  useEffect(() => {
    if (rideStatus === 'driver_found') {
      Toast.show({
        type: 'info',
        text1: 'Ride Accepted',
        text2: 'Driver is on the way.',
        visibilityTime: 4000,
      });

      setCanCancel(true);
      // Clear any previous timeout
      if (cancelWindowTimeoutRef.current) {
        clearTimeout(cancelWindowTimeoutRef.current);
      }
      // Start 20-second timer
      cancelWindowTimeoutRef.current = setTimeout(() => {
        setCanCancel(false);
        Toast.show({
          type: 'info', // or 'info', 'error'
          text1: 'Notice',
          text2: 'You can no longer cancel the ride.',
          visibilityTime: 4000, // 4 seconds
        });
      }, 20000);
    } else {
      // Reset cancel ability when not in driver_found status
      setCanCancel(true);
      if (cancelWindowTimeoutRef.current) {
        clearTimeout(cancelWindowTimeoutRef.current);
        cancelWindowTimeoutRef.current = null;
      }
    }
    // Cleanup on unmount or status change
    return () => {
      if (cancelWindowTimeoutRef.current) {
        clearTimeout(cancelWindowTimeoutRef.current);
        cancelWindowTimeoutRef.current = null;
      }
    };
  }, [rideStatus]);

  // sound initialization
  useEffect(() => {
    const initializeSounds = async () => {
      try {
        await SoundUtils.initializeSounds();
        setSoundsInitialized(true);
        console.log('Sounds initialized');
      } catch (error) {
        console.error('Failed to initialize sounds:', error);
      }
    };

    initializeSounds();

    return () => {
      SoundUtils.releaseSounds();
    };
  }, []);

  // play sound notification when driver is arriving
  useEffect(() => {
    const playNotificationSound = async () => {
      if (
        rideStatus === 'driver_found' &&
        driverEta !== null &&
        driverEta * 60 <= 20 &&
        !notifiedArrival &&
        soundsInitialized
      ) {
        setNotifiedArrival(true);

        // Vibrate
        Vibration.vibrate(1000);

        // Play sound
        await SoundUtils.playDing();

        // Alert.alert('Driver is arriving!', 'Driver will arrive in 20 seconds!');
        Toast.show({
          type: 'info', // or 'info', 'error'
          text1: 'Driver is arriving!',
          text2: 'Driver will arrive in 20 seconds!',
          visibilityTime: 4000, // 4 seconds
        });
      }
    };

    playNotificationSound();
    // Reset notification if ETA increases again (e.g., driver stuck in traffic)
    if (
      rideStatus === 'driver_found' &&
      driverEta * 60 > 20 &&
      notifiedArrival
    ) {
      setNotifiedArrival(false);
    }
  }, [driverEta, rideStatus, notifiedArrival, soundsInitialized]);

  // Fetch route details between two points
  const fetchRouteDetails = async () => {
    if (!currentLocation || !destination) return;

    try {
      const origin = `${currentLocation.coordinates[1]},${currentLocation.coordinates[0]}`;
      const dest = `${destination.coordinates[1]},${destination.coordinates[0]}`;

      const response = await api.get('/api/google/directions', {
        params: {origin, destination: dest},
      });

      if (
        response.data.routes &&
        response.data.routes.length > 0 &&
        response.data.routes[0].legs &&
        response.data.routes[0].legs.length > 0
      ) {
        const route = response.data.routes[0];
        const leg = route.legs[0];

        // Check if polyline data exists
        if (route.overview_polyline?.points) {
          // Use the imported decode function
          const points = decode(route.overview_polyline.points);

          // Use the proper type for coordinates
          const routeCoords: LatLng[] = points.map((point: number[]) => ({
            latitude: point[0],
            longitude: point[1],
          }));

          // Optimize the polyline for better performance
          if (routeCoords.length > 100) {
            const sampleEvery = Math.floor(routeCoords.length / 100);
            const sampledCoords = routeCoords.filter(
              (_, index) => index % sampleEvery === 0,
            );
            // Make sure we include the last point
            if (
              routeCoords.length > 0 &&
              sampledCoords[sampledCoords.length - 1] !==
                routeCoords[routeCoords.length - 1]
            ) {
              sampledCoords.push(routeCoords[routeCoords.length - 1]);
            }
            setRouteCoordinates(sampledCoords);
          } else {
            setRouteCoordinates(routeCoords);
          }

          // Get estimated distance and duration
          const distanceInKm = leg.distance.value / 1000;
          const durationInMinutes = Math.ceil(leg.duration.value / 60);

          setEstimatedDistance(distanceInKm);
          setEstimatedDuration(durationInMinutes);

          // Get fare estimate
          if (fromZone && toZone) {
            fetchFareEstimate(distanceInKm);
          }
        } else {
          console.error('No polyline data available in the response');
          Alert.alert('Error', 'Could not calculate route between locations');
        }
      } else {
        Alert.alert('Error', 'No route found between these locations');
      }
    } catch (error) {
      console.error('Error fetching route:', error);
      Alert.alert('Error', 'Failed to calculate route between locations');
    }
  };

  // check if zone is valid
  const validateZoneData = (zone: Zone | null, zoneName: string): boolean => {
    if (!zone) {
      console.error(`${zoneName} is null`);
      return false;
    }

    if (!zone._id) {
      console.error(`${zoneName} has no _id:`, zone);
      return false;
    }

    // Basic MongoDB ObjectId format check (24 hex characters)
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!objectIdRegex.test(zone._id)) {
      console.error(`${zoneName} has invalid _id format:`, zone._id);
      return false;
    }

    return true;
  };

  // Fetch fare estimate based on zones
  const fetchFareEstimate = async (distance?: number) => {
    if (!passengerProfile) {
      console.error('No passenger profile available');
      return;
    }

    if (!fromZone || !toZone) {
      console.log('Zones not yet available, skipping fare estimation');
      return;
    }

    // Validate zones only when we're sure they should be available
    if (
      !validateZoneData(fromZone, 'fromZone') ||
      !validateZoneData(toZone, 'toZone')
    ) {
      Alert.alert(
        'Error',
        'Invalid zone data. Please try selecting locations again.',
      );
      return;
    }

    try {
      // Prepare request parameters
      const params: any = {
        fromZone: fromZone._id,
        toZone: toZone._id,
        passengerId: passengerProfile._id,
        passengerCategory: passengerProfile.passengerCategory,
        passengerAge: passengerProfile.age,
      };

      if (distance && distance > 0) {
        params.distance = distance;
      }

      console.log('Fetching fare with params:', params); // Debug log

      const response = await api.get('/api/pricing/route', {params});

      console.log('Fare response:', response.data); // Debug log

      if (response.data.success && response.data.data) {
        setFareEstimate(response.data.data);
      } else {
        Alert.alert('Error', 'No pricing information available for this route');
      }
    } catch (error: any) {
      console.error('Error fetching fare estimate:', error);
      if (error.response) {
        console.error('Error response:', error.response.data);
        console.error('Error status:', error.response.status);
      }
      Alert.alert('Error', 'Failed to calculate fare estimate');
    }
  };

  // Handle location selection
  const handleLocationSelected = async (location: Location) => {
    setDestination(location);

    // Get zone for destination location
    try {
      const zoneResponse = await api.get('/api/zones/lookup', {
        params: {
          longitude: location.coordinates[0],
          latitude: location.coordinates[1],
        },
      });

      console.log('Zone response for destination:', zoneResponse.data);
      let destinationZone = null;

      // Check if the response has the expected structure
      if (
        zoneResponse.data &&
        zoneResponse.data.success &&
        zoneResponse.data.data
      ) {
        destinationZone = zoneResponse.data.data;
      } else if (zoneResponse.data && zoneResponse.data._id) {
        // If the API returns the zone object directly
        destinationZone = zoneResponse.data;
      } else {
        console.error('Unexpected zone response structure:', zoneResponse.data);
        Alert.alert(
          'Zone Not Found',
          'Service is not available in this destination area',
        );
        setShowLocationModal(false);
        return; // Don't proceed if no valid zone
      }

      // Set the zone
      setToZone(destinationZone);
    } catch (error) {
      console.error('Error getting zone info:', error);
      Alert.alert('Error', 'Failed to get zone information');
    }

    setShowLocationModal(false);

    if (currentLocation && location) {
      setRideStatus('selecting_location');
    }
  };

  // cleanup effect to prevent multiple calls
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    // Debounce the fare estimation calls
    if (fromZone && toZone) {
      timeoutId = setTimeout(() => {
        if (estimatedDistance > 0) {
          fetchFareEstimate(estimatedDistance);
        } else {
          fetchFareEstimate();
        }
      }, 300); // 300ms debounce
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [fromZone?._id, toZone?._id, estimatedDistance]);

  // Request a ride
  const requestRide = async () => {
    if (
      !currentLocation ||
      !destination ||
      !fromZone ||
      !toZone ||
      !fareEstimate
    ) {
      Alert.alert(
        'Error',
        'Please select both pickup and destination locations',
      );
      return;
    }

    // zone validation
    if (
      !validateZoneData(fromZone, 'fromZone') ||
      !validateZoneData(toZone, 'toZone')
    ) {
      Alert.alert(
        'Error',
        'Invalid zone data. Please try selecting locations again.',
      );
      return;
    }

    // passenger profile validation
    if (!passengerProfile?._id) {
      Alert.alert(
        'Error',
        'Passenger profile not found. Please refresh the app.',
      );
      return;
    }

    setRideStatus('searching_driver');

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    try {
      const rideData = {
        pickupLocation: {
          type: 'Point',
          coordinates: currentLocation.coordinates,
          address: currentLocation.address,
        },
        destinationLocation: {
          type: 'Point',
          coordinates: destination.coordinates,
          address: destination.address,
        },
        fromZone: fromZone._id,
        toZone: toZone._id,
        estimatedDistance: estimatedDistance || 0,
        estimatedDuration: estimatedDuration || 0,
        price: fareEstimate.finalAmount,
        baseFare: fareEstimate.baseAmount,
        discountApplied: fareEstimate.discount.amount,
        discountRate: fareEstimate.discount.rate,
        discountType: fareEstimate.discount.type,
        passengerType: fareEstimate.passenger.category,
        passengerAge: fareEstimate.passenger.age,
        paymentMethod: 'cash',
      };

      if (!currentLocation?.coordinates || !destination?.coordinates) {
        Alert.alert('Error', 'Invalid location coordinates');
        return;
      }

      if (!fromZone?._id || !toZone?._id) {
        Alert.alert('Error', 'Invalid zone information');
        return;
      }

      if (!fareEstimate?.finalAmount) {
        Alert.alert('Error', 'Invalid fare information');
        return;
      }

      const response = await api.post(`/api/rides/request`, rideData);
      console.log('Ride request successful:', response.data);

      // Make sure to get the ride ID from response
      const rideId = response.data._id || response.data.data?._id;
      setCurrentRideId(rideId);

      // Set timeout for driver search (can be cancelled by socket event)
      searchTimeoutRef.current = setTimeout(async () => {
        console.log('Search timeout triggered, cancelling ride request');

        // Clear the timeout reference immediately
        searchTimeoutRef.current = null;

        try {
          // Cancel the ride request on the backend FIRST
          await cancelRideRequest();

          // Then show the alert to user
          Alert.alert(
            'No Drivers Available',
            'No drivers accepted your ride request. You can try booking again or select a different destination.',
            [
              {
                text: 'Try Again',
                onPress: () => {
                  resetRideKeepDestination(true); // Skip internal cancellation since already done
                },
              },
              {
                text: 'Change Destination',
                onPress: () => {
                  resetRide(true); // Skip internal cancellation since already done
                },
                style: 'cancel',
              },
            ],
          );
        } catch (error) {
          console.error('Error during timeout cancellation:', error);
          // Even if cancellation fails, reset the UI to prevent stuck state
          Alert.alert(
            'Error',
            'Failed to cancel previous request. Please try again later.',
          );
          resetRide(true); // Force reset
        }
      }, 60000); // 1 minute timeout
    } catch (error: any) {
      console.error('Error requesting ride:', error);

      // Clear timeout immediately on any error during request
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }

      // Auto-cancel any created ride request on error
      if (currentRideId) {
        await cancelRideRequest();
      }

      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);

        // Check if it's the "no drivers available" error from backend
        if (
          error.response.status === 400 &&
          error.response.data?.message?.includes('No drivers available')
        ) {
          console.log(
            'Backend says no drivers available, handling gracefully.',
          );
          const rideId = error.response.data?.rideId;
          if (rideId) {
            setCurrentRideId(rideId);
            await cancelRideRequest(); // Cancel on backend
            Alert.alert(
              'No Drivers Available',
              'The system found no drivers available for your request. Please try again.',
              [
                {
                  text: 'Try Again',
                  onPress: () => resetRideKeepDestination(true),
                },
                {
                  text: 'Change Destination',
                  onPress: () => resetRide(true),
                },
              ],
            );
            return;
          }
        } else if (
          error.response.status === 409 &&
          error.response.data?.message?.includes(
            'You already have an active ride request',
          )
        ) {
          Alert.alert(
            'Active Ride',
            'You already have an active ride request. Please cancel it or wait for a driver to accept.',
            [{text: 'OK', onPress: () => resetRide(true)}],
          );
        } else {
          const errorMessage =
            error.response.data?.message ||
            'Failed to request ride. Please try again.';
          Alert.alert('Error', errorMessage);
        }
      } else if (error.request) {
        console.error('Error request:', error.request);
        Alert.alert('Error', 'Network error. Please check your connection.');
      } else {
        console.error('Error message:', error.message);
        Alert.alert('Error', 'An unexpected error occurred.');
      }

      // Ensure a reset to a stable state
      resetRide(true);
    }
  };

  const resetRideKeepDestination = async (skipCancelRequest = false) => {
    // Cancel any active ride request first
    if (currentRideId && !skipCancelRequest) {
      await cancelRideRequest();
    }
    // Keep destination, toZone, and related route information. Only reset ride-specific states
    setRideStatus('confirming_booking');
    setFareEstimate(null); // Will be recalculated below
    setAssignedDriver(null);
    setCurrentRideId(null);
    setDriverEta(0);
    setTempSelectedLocation(null);
    setShowDestinationConfirmation(false);

    // Recalculate fare estimate since we're keeping the zones
    if (fromZone && toZone && estimatedDistance > 0) {
      fetchFareEstimate(estimatedDistance);
    }
  };

  // Check for expired ride state
  const checkRideStateExpiry = async () => {
    try {
      const savedState = await loadRideState();
      if (savedState && savedState.timestamp) {
        const now = Date.now();
        const stateAge = now - savedState.timestamp;
        const maxAge = 30 * 60 * 1000; // 30 minutes

        if (stateAge > maxAge) {
          console.log('Ride state expired, clearing...');
          await clearRideState();
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('Error checking ride state expiry:', error);
      return false;
    }
  };

  const handleRideCompletion = async () => {
    setRideStatus('completed');

    // Clear the saved state since ride is completed
    await clearRideState();

    // Show rating modal after 2 seconds
    setTimeout(() => {
      setShowRatingModal(true);
    }, 2000);
  };

  // Submit rating after ride
  const submitRating = async (rating: number, feedback: string) => {
    try {
      await api.post(`/api/rides/${currentRideId}/rate-driver`, {
        rating,
        feedback,
      });

      setShowRatingModal(false);
      resetRide();
      Toast.show({
        type: 'success', // or 'info', 'error'
        text1: 'Rating Submitted',
        text2: 'Thank you for your feedback!',
        visibilityTime: 4000, // 4 seconds
      });
    } catch (error) {
      console.error('Error submitting rating:', error);
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
    }
  };

  // Reset ride state
  const resetRide = async (skipCancelRequest = false) => {
    // Cancel any active ride request first
    if (currentRideId && !skipCancelRequest) {
      await cancelRideRequest();
    }
    setDestination(null);
    setToZone(null);
    setRideStatus('idle');
    setFareEstimate(null);
    setRouteCoordinates([]);
    setEstimatedDistance(0);
    setEstimatedDuration(0);
    setAssignedDriver(null);
    setCurrentRideId(null);
    setDriverEta(0);
    setTempSelectedLocation(null);
    setShowDestinationConfirmation(false);
    await clearRideState();
  };

  // useEffect to handle app state changes (when user closes app)
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: string) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // If user is searching for driver and app goes to background, cancel the request
        if (rideStatus === 'searching_driver' && currentRideId) {
          console.log(
            'App going to background during driver search, cancelling ride request',
          );
          await cancelRideRequest();
        }
      }
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    return () => {
      subscription?.remove();
    };
  }, [rideStatus, currentRideId]);

  // Cancel ride
  const cancelRide = async () => {
    // Clear the search timeout if it exists
    if (searchTimeoutRef.current) {
      console.log('Clearing search timeout');
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    // If we're just searching for a driver, immediately cancel the backend request
    if (rideStatus === 'searching_driver') {
      // Cancel the ride request on backend immediately
      const cancelled = await cancelRideRequest();
      if (cancelled) {
        Alert.alert('Cancel Ride', 'What would you like to do?', [
          {
            text: 'Try Again',
            onPress: () => {
              resetRideKeepDestination(true);
            },
          },
          {
            text: 'Try Again Later',
            onPress: () => {
              resetRideKeepDestination(true);
            },
          },
          {
            text: 'Change Destination',
            onPress: () => {
              resetRide(true);
            },
          },
        ]);
      } else {
        // If cancellation failed, still reset UI but inform user
        Alert.alert(
          'Warning',
          'There was an issue cancelling the ride request. Please try again.',
          [{text: 'OK', onPress: () => resetRide(true)}],
        );
      }
      return;
    }

    if (!currentRideId) {
      console.log('No currentRideId found'); // Add this line
      return;
    }

    Alert.alert('Cancel Ride', 'Are you sure you want to cancel this ride?', [
      {text: 'No', style: 'cancel'},
      {
        text: 'Yes',
        onPress: async () => {
          const cancelled = await cancelRideRequest();
          if (cancelled) {
            resetRide();
            Toast.show({
              type: 'success',
              text1: 'Success',
              text2: 'Ride cancelled successfully!',
              visibilityTime: 4000,
            });
          } else {
            Toast.show({
              type: 'error',
              text1: 'Error',
              text2: 'Failed to cancel ride. Please try again.',
              visibilityTime: 4000,
            });
          }
        },
      },
    ]);
  };

  const cancelRideRequest = async () => {
    if (!currentRideId) {
      console.log('No currentRideId to cancel');
      // Ensure local states are clean even if currentRideId is null unexpectedly
      setCurrentRideId(null);
      setRideStatus('confirming_booking'); // Or 'idle'
      return true;
    }

    const rideIdToCancel = currentRideId;
    setCurrentRideId(null);
    setRideStatus('confirming_booking');
    try {
      const response = await api.post(`/api/rides/${rideIdToCancel}/cancel`, {
        reason: 'No drivers available - timeout',
      });
      return true;
    } catch (error) {
      console.error('Error canceling ride on backend:', error);
      // to prevent UI from being stuck
      return false;
    }
  };

  // Render UI based on ride status
  const renderContent = () => {
    switch (rideStatus) {
      case 'idle':
      case 'selecting_location':
        return (
          <>
            <Card style={styles.locationCard}>
              <Card.Content>
                <Title>Your Trip</Title>

                <Pressable
                  onPress={() => {
                    Alert.alert(
                      'Pickup Location',
                      'Pickup location is set to your current location.',
                    );
                  }}>
                  <Text style={styles.floatingLabel}>Pickup Location</Text>
                  <View style={styles.locationInput}>
                    <Icon name="map-marker" size={24} color="#3498db" />
                    <Text style={styles.locationText}>
                      {currentLocation?.address}
                    </Text>
                  </View>
                </Pressable>

                <View style={{position: 'relative', marginBottom: 20}}>
                  <Text style={styles.floatingLabel}>Destination</Text>
                  <TouchableOpacity
                    style={styles.locationInput}
                    onPress={() => {
                      setSelectingFor('destination');
                      setShowLocationModal(true);
                    }}>
                    <Icon name="flag-checkered" size={24} color="#e74c3c" />
                    <Text style={styles.locationText}>
                      {destination
                        ? `${destination.mainText}${
                            destination.secondaryText
                              ? ', ' + destination.secondaryText
                              : ''
                          }`
                        : 'Select destination'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {fromZone && toZone && destination && (
                  <Button
                    mode="contained"
                    style={styles.button}
                    onPress={() => setRideStatus('confirming_booking')}>
                    Continue
                  </Button>
                )}
              </Card.Content>
            </Card>
          </>
        );

      case 'confirming_booking':
        if (!fareEstimate) {
          return (
            <Card style={styles.confirmBookingCard}>
              <Card.Content>
                <ActivityIndicator animating={true} />
                <Text>Calculating fare...</Text>
              </Card.Content>
            </Card>
          );
        }

        return (
          <Card style={styles.confirmBookingCard}>
            <Card.Content>
              <Title>Confirm Your Ride</Title>

              <View style={styles.tripDetails}>
                <View style={styles.locationSummary}>
                  <View style={styles.locationSummaryItem}>
                    <Icon name="map-marker" size={20} color="#3498db" />
                    <Text style={styles.locationSummaryText} numberOfLines={1}>
                      {currentLocation?.address}
                    </Text>
                  </View>

                  <View style={styles.verticalLine} />

                  <View style={styles.locationSummaryItem}>
                    <Icon name="flag-checkered" size={20} color="#e74c3c" />
                    <Text style={styles.locationSummaryText} numberOfLines={1}>
                      {destination?.address}
                    </Text>
                  </View>
                </View>

                <Divider style={styles.divider} />

                <View style={styles.tripInfo}>
                  <View style={styles.tripInfoItem}>
                    <Icon
                      name="map-marker-distance"
                      size={18}
                      color="#3498db"
                    />
                    <Text>{estimatedDistance.toFixed(1)} km</Text>
                  </View>
                  <View style={styles.tripInfoItem}>
                    <Icon name="clock-outline" size={18} color="#3498db" />
                    <Text>{estimatedDuration} min</Text>
                  </View>
                </View>

                <Divider style={styles.divider} />

                <Title style={styles.fareTitle}>Fare Information</Title>

                <View style={styles.fareDisplayContainer}>
                  <View style={styles.fareBreakdown}>
                    <View style={styles.fareRow}>
                      <Text style={styles.fareLabel}>Base Fare:</Text>
                      <Text style={styles.fareAmount}>
                        ₱{fareEstimate.baseAmount.toFixed(2)}
                      </Text>
                    </View>

                    {fareEstimate.discount.rate > 0 && (
                      <>
                        <View style={styles.fareRow}>
                          <Text style={styles.discountLabel}>
                            {getDiscountLabel(
                              fareEstimate.discount.type,
                              fareEstimate.discount.ageBasedDiscount,
                            )}
                            :
                          </Text>
                          <Text style={styles.discountAmount}>
                            -₱{fareEstimate.discount.amount.toFixed(2)}
                          </Text>
                        </View>
                        <Divider style={styles.fareDivider} />
                      </>
                    )}

                    <View style={styles.fareRow}>
                      <Text style={styles.totalFareLabel}>Total Fare:</Text>
                      <Text style={styles.totalFareAmount}>
                        ₱{fareEstimate.finalAmount.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.passengerTypeInfo}>
                    <Icon
                      name={
                        fareEstimate.discount.ageBasedDiscount
                          ? 'account-child'
                          : fareEstimate.passenger.category === 'student'
                          ? 'school'
                          : fareEstimate.passenger.category === 'senior'
                          ? 'account-supervisor'
                          : 'account'
                      }
                      size={20}
                      color="#3498db"
                    />
                    <Text style={styles.passengerTypeText}>
                      {getPassengerTypeLabel(
                        fareEstimate.discount.type,
                        fareEstimate.discount.ageBasedDiscount,
                      )}{' '}
                      Passenger
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.buttonRow}>
                <Button
                  mode="outlined"
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => setRideStatus('idle')}>
                  Back
                </Button>
                <Button
                  mode="contained"
                  style={[styles.button, styles.confirmButton]}
                  onPress={requestRide}>
                  Book Now
                </Button>
              </View>
            </Card.Content>
          </Card>
        );

      case 'searching_driver':
        return (
          <Card style={styles.searchingCard}>
            <Card.Content style={styles.searchingContent}>
              <ActivityIndicator size="large" color="#3498db" />
              <Title style={styles.searchingTitle}>Finding a Driver</Title>
              <Paragraph>Searching for the best driver near you...</Paragraph>
              <Button
                mode="outlined"
                style={styles.cancelSearchButton}
                onPress={cancelRide}>
                Cancel
              </Button>
            </Card.Content>
          </Card>
        );

      case 'driver_found':
      case 'driver_arrived':
      case 'in_progress':
        return (
          <Card style={styles.rideInProgressCard}>
            <Card.Content>
              <View style={styles.driverInfo}>
                <Avatar.Image
                  size={60}
                  source={
                    assignedDriver?.profileImage
                      ? {uri: assignedDriver.profileImage}
                      : require('../assets/images/avatar-default-icon.png')
                  }
                />
                <View style={styles.driverDetails}>
                  <Title style={styles.driverName}>
                    {assignedDriver?.fullName}
                  </Title>
                  <View style={styles.ratingContainer}>
                    <Icon name="star" size={16} color="#f39c12" />
                    <Text style={styles.ratingText}>
                      {assignedDriver?.rating.toFixed(1)} •{' '}
                      {assignedDriver?.totalRides} rides
                    </Text>
                  </View>
                  <Text style={styles.vehicleInfo}>
                    {assignedDriver?.vehicle.color}{' '}
                    {assignedDriver?.vehicle.make}{' '}
                    {assignedDriver?.vehicle.model}
                  </Text>
                  <Text style={styles.plateNumber}>
                    {assignedDriver?.vehicle.plateNumber}
                  </Text>
                </View>
              </View>

              <Divider style={styles.divider} />

              <View style={styles.rideStatusContainer}>
                {rideStatus === 'driver_found' && (
                  <>
                    <Icon name="car-connected" size={24} color="#3498db" />
                    <View style={styles.rideStatusText}>
                      <Text style={styles.rideStatusTitle}>
                        Driver is on the way
                      </Text>
                      <Text>
                        Arriving in {Math.floor(driverEta)} min{' '}
                        {Math.round((driverEta % 1) * 60)} sec
                      </Text>
                      {!canCancel && (
                        <Text style={{color: 'red', fontWeight: 'bold'}}>
                          You can no longer cancel the ride.
                        </Text>
                      )}
                    </View>
                  </>
                )}

                {rideStatus === 'driver_arrived' && (
                  <>
                    <Icon name="map-marker-check" size={24} color="#27ae60" />
                    <View style={styles.rideStatusText}>
                      <Text style={styles.rideStatusTitle}>
                        Driver has arrived
                      </Text>
                      <Text>Please proceed to the pickup location</Text>
                    </View>
                  </>
                )}

                {rideStatus === 'in_progress' && (
                  <>
                    <Icon name="car-arrow-right" size={24} color="#8e44ad" />
                    <View style={styles.rideStatusText}>
                      <Text style={styles.rideStatusTitle}>
                        Ride in progress
                      </Text>
                      <Text>
                        Estimated arrival: {estimatedDuration} minutes
                      </Text>
                    </View>
                  </>
                )}
              </View>

              <Divider style={styles.divider} />

              <View style={styles.tripDetails}>
                <View style={styles.locationSummary}>
                  <View style={styles.locationSummaryItem}>
                    <Icon name="map-marker" size={20} color="#3498db" />
                    <Text style={styles.locationSummaryText} numberOfLines={1}>
                      {currentLocation?.address}
                    </Text>
                  </View>

                  <View style={styles.verticalLine} />

                  <View style={styles.locationSummaryItem}>
                    <Icon name="flag-checkered" size={20} color="#e74c3c" />
                    <Text style={styles.locationSummaryText} numberOfLines={1}>
                      {destination?.address}
                    </Text>
                  </View>
                </View>
              </View>

              {!['driver_arrived', 'in_progress', 'completed'].includes(
                rideStatus,
              ) && (
                <Button
                  mode="outlined"
                  style={styles.cancelButton}
                  onPress={cancelRide}
                  disabled={!canCancel}>
                  Cancel Ride
                </Button>
              )}
            </Card.Content>
          </Card>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  if (isRestoringState) {
    return (
      <View
        style={[
          styles.container,
          {justifyContent: 'center', alignItems: 'center'},
        ]}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={{marginTop: 10}}>Restoring ride state...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}>
        <Icon name="arrow-left" size={24} color="black" />
      </TouchableOpacity>

      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        mapType={mapType}
        style={styles.map}
        showsUserLocation={true}
        showsCompass={true}
        showsMyLocationButton={true}
        onPress={handleMapPress}
        initialRegion={
          currentLocation
            ? {
                latitude: currentLocation.coordinates[1],
                longitude: currentLocation.coordinates[0],
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }
            : undefined
        }>
        {currentLocation &&
          Array.isArray(currentLocation.coordinates) &&
          currentLocation.coordinates.length === 2 && (
            <Marker
              coordinate={{
                latitude: currentLocation.coordinates[1],
                longitude: currentLocation.coordinates[0],
              }}
              title="Pickup"
              pinColor="#3498db"
            />
          )}

        {destination &&
          Array.isArray(destination.coordinates) &&
          destination.coordinates.length === 2 && (
            <Marker
              coordinate={{
                latitude: destination.coordinates[1],
                longitude: destination.coordinates[0],
              }}
              title="Destination"
              pinColor="#e74c3c"
            />
          )}

        {assignedDriver &&
          assignedDriver.currentLocation &&
          Array.isArray(assignedDriver.currentLocation.coordinates) &&
          assignedDriver.currentLocation.coordinates.length === 2 &&
          rideStatus !== 'completed' && (
            <Marker
              coordinate={{
                latitude: assignedDriver.currentLocation.coordinates[1],
                longitude: assignedDriver.currentLocation.coordinates[0],
              }}
              title={`Driver: ${assignedDriver.fullName}`}>
              <Icon
                name="car"
                size={30}
                color="#00e676"
                style={{
                  textShadowColor: '#000',
                  textShadowOffset: {width: 1, height: 1},
                  textShadowRadius: 2,
                }}
              />
            </Marker>
          )}

        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={4}
            strokeColor="#3498db"
          />
        )}

        {tempSelectedLocation && (
          <Marker
            coordinate={{
              latitude: tempSelectedLocation.coordinates[1],
              longitude: tempSelectedLocation.coordinates[0],
            }}
            title="Selected Destination"
            pinColor="#f39c12"
          />
        )}
      </MapView>

      <TouchableOpacity
        style={styles.mapTypeButton}
        onPress={() => setShowMapTypeSelector(true)}>
        <Icon name="layers" size={24} color="#000" />
      </TouchableOpacity>

      <View style={styles.contentContainer}>{renderContent()}</View>

      <LocationSearchModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onLocationSelected={handleLocationSelected}
        searching={
          selectingFor === 'destination' ? 'destination' : 'saveAddress'
        }
        savedAddresses={
          (passengerProfile?.savedAddresses?.filter(
            addr => addr._id,
          ) as any[]) || []
        }
      />

      <PassengerRatingModal
        visible={showRatingModal}
        onClose={() => {
          setShowRatingModal(false);
          resetRide();
        }}
        onSubmit={submitRating}
        driverName={assignedDriver?.fullName || 'your driver'}
      />

      <MapTypeSelector
        visible={showMapTypeSelector}
        currentMapType={mapType}
        onClose={() => setShowMapTypeSelector(false)}
        onMapTypeSelect={setMapType}
      />

      {/* Destination Confirmation Modal */}
      <Modal
        visible={showDestinationConfirmation}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowDestinationConfirmation(false);
          setTempSelectedLocation(null);
          setIsGeocoding(false);
        }}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModal}>
            <Text style={styles.confirmationTitle}>Set as Destination?</Text>
            <View style={styles.confirmationContent}>
              <Icon name="map-marker" size={24} color="#e74c3c" />
              <View style={styles.confirmationAddressContainer}>
                <Text
                  style={styles.confirmationAddress}
                  numberOfLines={2}
                  ellipsizeMode="tail">
                  {tempSelectedLocation?.address}
                </Text>
                {/* Show geocoding indicator */}
                {isGeocoding && (
                  <View style={styles.geocodingIndicator}>
                    <ActivityIndicator size="small" color="#3498db" />
                    <Text style={styles.geocodingText}>Getting address...</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.confirmationButtons}>
              <Button
                mode="outlined"
                style={styles.confirmationButton}
                onPress={() => {
                  setShowDestinationConfirmation(false);
                  setTempSelectedLocation(null);
                  setIsGeocoding(false);
                }}>
                Cancel
              </Button>
              <Button
                mode="contained"
                style={styles.confirmationButton}
                onPress={confirmDestinationSelection}
                disabled={isGeocoding || !hasValidAddress(tempSelectedLocation)}
                loading={isGeocoding}>
                {isGeocoding ? 'Loading...' : 'Confirm'}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default BookRide;
