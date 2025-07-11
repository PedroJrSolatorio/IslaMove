import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import {Text, Button, Card, Title} from 'react-native-paper';
import MapView, {Marker, PROVIDER_GOOGLE, MapType} from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import {useNavigation, useRoute} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MapTypeSelector from './MapTypeSelector';
import api from '../../utils/api';
import {styles} from '../styles/MapLocationPickerStyles';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Location {
  type: string;
  coordinates: [number, number];
  address: string;
}

interface MapLocationPickerProps {
  onLocationSelected: (location: Location) => void;
  preselectedLocation?: Location;
}

const MapLocationPicker = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const mapRef = useRef<MapView | null>(null);

  // Get the callback function and preselected location from route params
  const {onLocationSelected, preselectedLocation} =
    route.params as MapLocationPickerProps;

  // States
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(
    preselectedLocation || null, // Initialize with preselected location if available
  );
  const [mapType, setMapType] = useState<MapType>('satellite');
  const [showMapTypeSelector, setShowMapTypeSelector] = useState(false);
  const [processingLocation, setProcessingLocation] = useState(false);

  // Function to request location permissions
  const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'This app needs access to your location to show the map.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return false;
  };

  // Get current location on component mount
  useEffect(() => {
    const fetchCurrentLocation = async () => {
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
  }, []);

  // Focus map on preselected location when map is ready
  useEffect(() => {
    if (!loading && preselectedLocation && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.animateToRegion(
          {
            latitude: preselectedLocation.coordinates[1],
            longitude: preselectedLocation.coordinates[0],
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          1000,
        );
      }, 500);
    }
  }, [loading, preselectedLocation]);

  // Handle map press to select location
  const handleMapPress = async (event: any) => {
    const {latitude, longitude} = event.nativeEvent.coordinate;
    setProcessingLocation(true);

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

      setSelectedLocation(newLocation);
    } catch (error) {
      console.error('Error getting location details:', error);
      Alert.alert('Error', 'Failed to get location details');
    } finally {
      setProcessingLocation(false);
    }
  };

  // Confirm selected location
  const confirmLocation = async () => {
    if (selectedLocation) {
      try {
        const storedRecent = await AsyncStorage.getItem('recentLocations');
        const recentLocations = storedRecent ? JSON.parse(storedRecent) : [];

        const updatedRecentLocations = [
          selectedLocation,
          ...recentLocations
            .filter((loc: Location) => loc.address !== selectedLocation.address)
            .slice(0, 4),
        ];

        await AsyncStorage.setItem(
          'recentLocations',
          JSON.stringify(updatedRecentLocations),
        );
      } catch (error) {
        console.error('Error saving recent location:', error);
      }

      onLocationSelected(selectedLocation);
      navigation.goBack();
    }
  };

  // Get initial region based on preselected location or current location
  const getInitialRegion = () => {
    if (preselectedLocation) {
      return {
        latitude: preselectedLocation.coordinates[1],
        longitude: preselectedLocation.coordinates[0],
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    } else if (currentLocation) {
      return {
        latitude: currentLocation.coordinates[1],
        longitude: currentLocation.coordinates[0],
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }
    return undefined;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Loading map...</Text>
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
        initialRegion={getInitialRegion()}>
        {currentLocation && (
          <Marker
            coordinate={{
              latitude: currentLocation.coordinates[1],
              longitude: currentLocation.coordinates[0],
            }}
            title="Your Location"
            pinColor="#3498db"
          />
        )}

        {selectedLocation && (
          <Marker
            coordinate={{
              latitude: selectedLocation.coordinates[1],
              longitude: selectedLocation.coordinates[0],
            }}
            title="Selected Location"
            pinColor="#e74c3c"
          />
        )}
      </MapView>

      <TouchableOpacity
        style={styles.mapTypeButton}
        onPress={() => setShowMapTypeSelector(true)}>
        <Icon name="layers" size={24} color="#000" />
      </TouchableOpacity>

      {/* Instructions Card */}
      <Card style={styles.instructionsCard}>
        <Card.Content>
          <Title style={styles.instructionsTitle}>
            {preselectedLocation ? 'Confirm or Adjust' : 'Select Location'}
          </Title>
          <Text style={styles.instructionsText}>
            {preselectedLocation
              ? 'Tap elsewhere to adjust'
              : 'Tap anywhere to select'}
          </Text>
        </Card.Content>
      </Card>

      {/* Selected Location Card */}
      {selectedLocation && (
        <Card style={styles.selectedLocationCard}>
          <Card.Content>
            <View style={styles.selectedLocationContent}>
              <Icon name="map-marker" size={24} color="#e74c3c" />
              <View style={styles.selectedLocationText}>
                <Text style={styles.selectedLocationAddress} numberOfLines={2}>
                  {selectedLocation.address}
                </Text>
              </View>
            </View>
            <View style={styles.buttonRow}>
              <Button
                mode="outlined"
                style={styles.cancelButton}
                onPress={() =>
                  setSelectedLocation(preselectedLocation || null)
                }>
                {preselectedLocation ? 'Reset' : 'Clear'}
              </Button>
              <Button
                mode="contained"
                style={styles.confirmButton}
                onPress={confirmLocation}
                disabled={processingLocation}>
                {processingLocation ? 'Processing...' : 'Confirm'}
              </Button>
            </View>
          </Card.Content>
        </Card>
      )}

      {processingLocation && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="#3498db" />
          <Text style={styles.processingText}>Getting location details...</Text>
        </View>
      )}

      <MapTypeSelector
        visible={showMapTypeSelector}
        currentMapType={mapType}
        onClose={() => setShowMapTypeSelector(false)}
        onMapTypeSelect={setMapType}
      />
    </View>
  );
};

export default MapLocationPicker;
