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
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {decode} from '@googlemaps/polyline-codec';
import {useAuth} from '../context/AuthContext';
import {isPassengerProfile, useProfile} from '../context/ProfileContext';
import LocationSearchModal from '../components/LocationSearchModal';
import MapTypeSelector from '../components/MapTypeSelector';
import DriverSearchingModal from '../components/DriverSearchingModal';
import DriverDetailsModal from '../components/DriverDetailsModal';
import RatingModal from '../components/RatingModal';
import SocketService from '../services/SocketService';
import {styles} from '../styles/BookRideStyles';
import api from '../../utils/api';

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

const BookRide = () => {
  const navigation = useNavigation();
  const {userToken} = useAuth();
  const {profileData} = useProfile();
  const mapRef = useRef<MapView | null>(null);

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

  // Add this function to handle map press for destination selection
  const handleMapPress = async (event: any) => {
    // Only allow destination selection when in idle state
    if (rideStatus !== 'idle' && rideStatus !== 'selecting_location') {
      return;
    }

    const {latitude, longitude} = event.nativeEvent.coordinate;

    try {
      // Reverse geocoding to get address
      const response = await api.get(`/api/google/geocode`, {
        params: {latlng: `${latitude},${longitude}`},
      });

      const address =
        response.data.results[0]?.formatted_address || 'Unknown location';

      const newLocation: Location = {
        type: 'Point',
        coordinates: [longitude, latitude],
        address: address,
      };

      setTempSelectedLocation(newLocation);
      setShowDestinationConfirmation(true);
    } catch (error) {
      console.error('Error getting location details:', error);
      Alert.alert('Error', 'Failed to get location details');
    }
  };

  // Add this function to confirm destination selection
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

        // FIX: Check if the response has the expected structure
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

        // The fetchFareEstimate will be triggered by the useEffect when toZone is set
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

  // Getting user's current location
  useEffect(() => {
    const fetchCurrentLocation = async () => {
      // Request permission first
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

      Geolocation.getCurrentPosition(
        async position => {
          const {longitude, latitude} = position.coords;

          try {
            // Reverse geocoding to get address
            const response = await api.get(`/api/google/geocode`, {
              params: {latlng: `${latitude},${longitude}`},
            });

            const address =
              response.data.results[0]?.formatted_address || 'Unknown location';

            setCurrentLocation({
              type: 'Point',
              coordinates: [longitude, latitude],
              address: address,
            });

            // Get zone information for current location
            const zoneResponse = await api.get(`/api/zones/lookup`, {
              params: {longitude, latitude},
            });

            console.log(
              'Zone response for current location:',
              zoneResponse.data,
            );

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
        },
        error => {
          console.error(error);
          setLoading(false);
          Alert.alert(
            'Permission Error',
            'Please enable location services to use this feature',
            [{text: 'OK', onPress: () => navigation.goBack()}],
          );
        },
        {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000},
      );
    };

    fetchCurrentLocation();

    // Setup socket connection using SocketService
    const setupSocket = async () => {
      if (!userToken) return;

      try {
        // Connect using the service
        await SocketService.connect(userToken);

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

        SocketService.on('ride_status_update', (data: any) => {
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
                setRideStatus('completed');
                setShowRatingModal(true);
                break;
              case 'cancelled':
                // Show alert with options when driver cancels
                Alert.alert(
                  'Ride Cancelled',
                  data.reason || 'The driver has cancelled the ride',
                  [
                    {
                      text: 'Find Another Driver',
                      onPress: () => {
                        resetRideKeepDestination(); // Preserve destination for rebooking
                      },
                    },
                    {
                      text: 'Change Destination',
                      onPress: () => {
                        resetRide(); // Full reset if user wants to change destination
                      },
                      style: 'cancel',
                    },
                  ],
                );
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
    };
  }, [userToken, currentRideId, rideStatus]);

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

    console.log('Requesting ride with data:', {
      fromZone: fromZone._id,
      toZone: toZone._id,
      passenger: passengerProfile._id,
      estimatedDistance,
      estimatedDuration,
      fareEstimate: fareEstimate.finalAmount,
      baseAmount: fareEstimate.baseAmount,
      discountAmount: fareEstimate.discount.amount,
    });

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
        // Add all the pricing details that the backend expects
        baseFare: fareEstimate.baseAmount,
        discountApplied: fareEstimate.discount.amount,
        discountRate: fareEstimate.discount.rate,
        discountType: fareEstimate.discount.type,
        passengerType: fareEstimate.passenger.category,
        passengerAge: fareEstimate.passenger.age,
        paymentMethod: 'cash',
      };

      console.log('=== FRONTEND RIDE DATA ===');
      console.log('From Zone:', fromZone);
      console.log('To Zone:', toZone);
      console.log('Current Location:', currentLocation);
      console.log('Destination:', destination);
      console.log('Fare Estimate:', fareEstimate);
      console.log('Final ride data:', JSON.stringify(rideData, null, 2));

      // Validation before sending
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
      console.log('Setting current ride ID:', rideId);
      setCurrentRideId(rideId);

      // Set timeout for driver search (can be cancelled by socket event)
      searchTimeoutRef.current = setTimeout(() => {
        console.log('Search timeout triggered');
        console.log('Current ride status at timeout:', rideStatus);

        // Set timeout for driver search
        setRideStatus(currentStatus => {
          console.log('Status check in timeout:', currentStatus);
          if (currentStatus === 'searching_driver') {
            console.log(
              'No driver found - showing alert and preserving destination',
            );
            Alert.alert(
              'No Drivers Available',
              'No drivers accepted your ride request. You can try booking again or select a different destination.',
              [
                {
                  text: 'Try Again',
                  onPress: () => {
                    resetRideKeepDestination(); // Use the new function that preserves destination
                  },
                },
                {
                  text: 'Change Destination',
                  onPress: () => {
                    resetRide(); // Use full reset if user wants to change destination
                  },
                  style: 'cancel',
                },
              ],
            );
            return 'confirming_booking'; // Go back to confirmation screen
          }
          return currentStatus;
        });

        searchTimeoutRef.current = null;
      }, 60000); // 1 minute timeout
    } catch (error: any) {
      console.error('Error requesting ride:', error);

      if (error.response) {
        console.error('Error response data:', error.response.data);
        console.error('Error response status:', error.response.status);

        // Check if it's the "no drivers available" error from backend
        if (
          error.response.status === 400 &&
          error.response.data?.message?.includes('No drivers available')
        ) {
          // Handle this gracefully - don't show error, just let timeout handle it
          console.log(
            'Backend says no drivers available, letting frontend timeout handle it',
          );

          // Still set the ride ID if one was created
          const rideId = error.response.data?.rideId;
          if (rideId) {
            setCurrentRideId(rideId);
          }

          // Keep searching status and let timeout handle it
          return;
        }

        // Show other error messages
        const errorMessage =
          error.response.data?.message ||
          'Failed to request ride. Please try again.';
        Alert.alert('Error', errorMessage);
      } else if (error.request) {
        console.error('Error request:', error.request);
        Alert.alert('Error', 'Network error. Please check your connection.');
      } else {
        console.error('Error message:', error.message);
        Alert.alert('Error', 'An unexpected error occurred.');
      }

      // Clear timeout on error
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
      setRideStatus('confirming_booking');
    }
  };

  const resetRideKeepDestination = () => {
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

  // Submit rating after ride
  const submitRating = async (rating: number, feedback: string) => {
    try {
      await api.post(`/api/rides/${currentRideId}/rate`, {rating, feedback});

      setShowRatingModal(false);
      resetRide();
      Alert.alert('Thank You', 'Your rating has been submitted!');
    } catch (error) {
      console.error('Error submitting rating:', error);
      Alert.alert('Error', 'Failed to submit rating. Please try again.');
    }
  };

  // Reset ride state
  const resetRide = () => {
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
  };

  // Cancel ride
  const cancelRide = async () => {
    // Clear the search timeout if it exists
    if (searchTimeoutRef.current) {
      console.log('Clearing search timeout');
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    // If we're just searching for a driver, offer to preserve destination
    if (rideStatus === 'searching_driver') {
      console.log('Cancelling during driver search');

      Alert.alert('Cancel Ride', 'What would you like to do?', [
        {text: 'Keep Searching', style: 'cancel'},
        {
          text: 'Try Again Later',
          onPress: () => {
            resetRideKeepDestination(); // Preserve destination
          },
        },
        {
          text: 'Change Destination',
          onPress: () => {
            resetRide(); // Full reset
          },
        },
      ]);
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
          try {
            const response = await api.post(
              `/api/rides/${currentRideId}/cancel`,
              {
                reason: 'Cancelled by passenger',
              },
            );
            // For active rides, do full reset since the trip is completely cancelled
            resetRide();
            Alert.alert('Success', 'Ride cancelled successfully');
          } catch (error) {
            console.error('Error canceling ride:', error);
            Alert.alert('Error', 'Failed to cancel ride. Please try again.');
          }
        },
      },
    ]);
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
                      {destination ? destination.address : 'Select destination'}
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
                      <Text>Arriving in {driverEta} minutes</Text>
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

              {/* <Button
                mode="contained"
                icon="phone"
                style={styles.callButton}
                onPress={() => {
                  // Implement call functionality
                }}>
                Call Driver
              </Button> */}

              {rideStatus !== 'in_progress' && (
                <Button
                  mode="outlined"
                  style={styles.cancelButton}
                  onPress={cancelRide}>
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

      <RatingModal
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
        }}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModal}>
            <Text style={styles.confirmationTitle}>Set as Destination?</Text>
            <View style={styles.confirmationContent}>
              <Icon name="map-marker" size={24} color="#e74c3c" />
              <Text style={styles.confirmationAddress} numberOfLines={3}>
                {tempSelectedLocation?.address}
              </Text>
            </View>
            <View style={styles.confirmationButtons}>
              <Button
                mode="outlined"
                style={styles.confirmationButton}
                onPress={() => {
                  setShowDestinationConfirmation(false);
                  setTempSelectedLocation(null);
                }}>
                Cancel
              </Button>
              <Button
                mode="contained"
                style={styles.confirmationButton}
                onPress={confirmDestinationSelection}>
                Confirm
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default BookRide;
