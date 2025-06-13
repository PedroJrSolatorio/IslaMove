import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  PermissionsAndroid,
  Pressable,
} from 'react-native';
import {
  Text,
  Button,
  Card,
  Title,
  Paragraph,
  RadioButton,
  Divider,
  Avatar,
} from 'react-native-paper';
import MapView, {Marker, PROVIDER_GOOGLE, Polyline} from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {decode} from '@googlemaps/polyline-codec';
import {useAuth} from '../context/AuthContext';
import {useProfile} from '../context/ProfileContext';
import LocationSearchModal from '../components/LocationSearchModal';
import DriverSearchingModal from '../components/DriverSearchingModal';
import DriverDetailsModal from '../components/DriverDetailsModal';
import RatingModal from '../components/RatingModal';
import SocketService from '../services/SocketService';
import {styles} from '../styles/BookRideStyles';
import api from '../../utils/api';

// Interface for fare types
interface FareInfo {
  regular: number;
  student: number;
  senior: number;
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

// Passenger type
type PassengerType = 'regular' | 'student' | 'senior';

const BookRide = () => {
  const navigation = useNavigation();
  const {userToken} = useAuth();
  const {profileData} = useProfile();
  const mapRef = useRef<MapView | null>(null);

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
  const [passengerType, setPassengerType] = useState<PassengerType>('regular');
  const [assignedDriver, setAssignedDriver] = useState<Driver | null>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [driverEta, setDriverEta] = useState(0);

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

            if (zoneResponse.data) {
              setFromZone(zoneResponse.data);
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
                setRideStatus('idle');
                Alert.alert(
                  'Ride Cancelled',
                  data.reason || 'The ride has been cancelled',
                );
                resetRide();
                break;
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
    };
  }, [userToken, currentRideId, rideStatus]);

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
      // Disconnect the socket service when component unmounts
      SocketService.disconnect();
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

  // Fetch fare estimate based on zones and distance
  const fetchFareEstimate = async (distance: number) => {
    if (!fromZone || !toZone) return;

    try {
      const response = await api.get('/api/fares/estimate', {
        params: {fromZone: fromZone._id, toZone: toZone._id, distance},
      });

      setFareEstimate(response.data);
    } catch (error) {
      console.error('Error fetching fare estimate:', error);
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

      if (zoneResponse.data) {
        setToZone(zoneResponse.data);
      } else {
        Alert.alert(
          'Zone Not Found',
          'Service is not available in this destination area',
        );
      }
    } catch (error) {
      console.error('Error getting zone info:', error);
    }

    setShowLocationModal(false);

    if (currentLocation && destination) {
      setRideStatus('confirming_booking');
    }
  };

  // Request a ride
  const requestRide = async () => {
    if (!currentLocation || !destination || !fromZone || !toZone) {
      Alert.alert(
        'Error',
        'Please select both pickup and destination locations',
      );
      return;
    }

    setRideStatus('searching_driver');

    try {
      const rideData = {
        pickupLocation: currentLocation,
        destinationLocation: destination,
        fromZone: fromZone._id,
        toZone: toZone._id,
        estimatedDistance,
        estimatedDuration,
        passengerType,
        price:
          passengerType === 'regular'
            ? fareEstimate?.regular
            : passengerType === 'student'
            ? fareEstimate?.student
            : fareEstimate?.senior,
      };

      const response = await api.post(`/api/rides/request`, rideData);

      setCurrentRideId(response.data._id);

      // Set timeout for driver search (can be cancelled by socket event)
      const searchTimeout = setTimeout(() => {
        if (rideStatus === 'searching_driver') {
          Alert.alert(
            'No Drivers Available',
            'No drivers accepted your ride request. Please try again later.',
          );
          setRideStatus('idle');
        }
      }, 60000); // 1 minute timeout

      return () => clearTimeout(searchTimeout);
    } catch (error) {
      console.error('Error requesting ride:', error);
      Alert.alert('Error', 'Failed to request ride. Please try again.');
      setRideStatus('confirming_booking');
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
    setRideStatus('idle');
    setFareEstimate(null);
    setRouteCoordinates([]);
    setEstimatedDistance(0);
    setEstimatedDuration(0);
    setAssignedDriver(null);
    setCurrentRideId(null);
  };

  // Cancel ride
  const cancelRide = async () => {
    if (!currentRideId) return;

    Alert.alert('Cancel Ride', 'Are you sure you want to cancel this ride?', [
      {text: 'No', style: 'cancel'},
      {
        text: 'Yes',
        onPress: async () => {
          try {
            await api.post(`/api/rides/${currentRideId}/cancel`, {
              reason: 'Cancelled by passenger',
            });

            resetRide();
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

                <Title style={styles.fareTitle}>Fare Options</Title>

                <RadioButton.Group
                  onValueChange={value =>
                    setPassengerType(value as PassengerType)
                  }
                  value={passengerType}>
                  <View style={styles.fareOption}>
                    <View style={styles.fareOptionDetails}>
                      <RadioButton value="regular" />
                      <View>
                        <Text style={styles.fareOptionText}>Regular</Text>
                        <Text style={styles.fareOptionSubtext}>
                          Standard fare
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.farePrice}>
                      ₱{fareEstimate?.regular.toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.fareOption}>
                    <View style={styles.fareOptionDetails}>
                      <RadioButton value="student" />
                      <View>
                        <Text style={styles.fareOptionText}>Student</Text>
                        <Text style={styles.fareOptionSubtext}>
                          Valid student ID required
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.farePrice}>
                      ₱{fareEstimate?.student.toFixed(2)}
                    </Text>
                  </View>

                  <View style={styles.fareOption}>
                    <View style={styles.fareOptionDetails}>
                      <RadioButton value="senior" />
                      <View>
                        <Text style={styles.fareOptionText}>
                          Senior Citizen
                        </Text>
                        <Text style={styles.fareOptionSubtext}>
                          Senior Citizen ID required
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.farePrice}>
                      ₱{fareEstimate?.senior.toFixed(2)}
                    </Text>
                  </View>
                </RadioButton.Group>
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

              <Button
                mode="contained"
                icon="phone"
                style={styles.callButton}
                onPress={() => {
                  // Implement call functionality
                }}>
                Call Driver
              </Button>

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
      {/* Custom Back Button */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}>
        <Icon name="arrow-left" size={28} color="black" />
      </TouchableOpacity>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
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
        {currentLocation && (
          <Marker
            coordinate={{
              latitude: currentLocation.coordinates[1],
              longitude: currentLocation.coordinates[0],
            }}
            title="Pickup"
            pinColor="#3498db"
          />
        )}

        {destination && (
          <Marker
            coordinate={{
              latitude: destination.coordinates[1],
              longitude: destination.coordinates[0],
            }}
            title="Destination"
            pinColor="#e74c3c"
          />
        )}

        {assignedDriver && rideStatus !== 'completed' && (
          <Marker
            coordinate={{
              latitude: assignedDriver.currentLocation.coordinates[1],
              longitude: assignedDriver.currentLocation.coordinates[0],
            }}
            title={`Driver: ${assignedDriver.fullName}`}>
            <Icon name="car" size={30} color="#27ae60" />
          </Marker>
        )}

        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={4}
            strokeColor="#3498db"
          />
        )}
      </MapView>

      <View style={styles.contentContainer}>{renderContent()}</View>

      {/* Location Search Modal */}
      <LocationSearchModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onLocationSelected={handleLocationSelected}
        searching={
          selectingFor === 'destination' ? 'destination' : 'saveAddress'
        }
        savedAddresses={profileData.savedAddresses}
      />

      {/* Rating Modal */}
      <RatingModal
        visible={showRatingModal}
        onClose={() => {
          setShowRatingModal(false);
          resetRide();
        }}
        onSubmit={submitRating}
        driverName={assignedDriver?.fullName || 'your driver'}
      />
    </View>
  );
};

export default BookRide;
