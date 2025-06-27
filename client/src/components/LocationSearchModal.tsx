import React, {useState, useEffect} from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import {Text, Searchbar, Divider, IconButton, Button} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import axios from 'axios';
import debounce from 'lodash/debounce';
import Geolocation from 'react-native-geolocation-service';
import {useAuth} from '../context/AuthContext';
import {BACKEND_URL} from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {styles} from '../styles/LocationSMStyles';
import {useNavigation} from '@react-navigation/native';

interface Address {
  _id: string;
  label: string;
  address: string;
  location?: Location;
}

interface Location {
  type: string;
  coordinates: [number, number];
  address: string;
}

interface LocationSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onLocationSelected: (location: Location) => void;
  onMapPickerRequest?: () => void;
  searching: 'saveAddress' | 'destination';
  savedAddresses: Address[];
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

const LocationSearchModal: React.FC<LocationSearchModalProps> = ({
  visible,
  onClose,
  onLocationSelected,
  searching,
  savedAddresses = [],
}) => {
  const {userToken} = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [recentLocations, setRecentLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const navigation = useNavigation<any>();

  // Load recent locations from storage
  useEffect(() => {
    const loadRecentLocations = async () => {
      try {
        const stored = await AsyncStorage.getItem('recentLocations');
        if (stored) {
          setRecentLocations(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Error loading recent locations:', error);
      }
    };

    loadRecentLocations();
  }, []);

  // Get user's current location when modal opens
  useEffect(() => {
    if (visible) {
      getCurrentLocation();
    }
  }, [visible]);

  // Request location permission and get current location
  const getCurrentLocation = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message:
              'This app needs access to your location to show nearby places.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.log('Location permission denied');
          return;
        }
      }

      Geolocation.getCurrentPosition(
        position => {
          const {latitude, longitude} = position.coords;
          setUserLocation({latitude, longitude});
          console.log('Current location:', latitude, longitude);
        },
        error => {
          console.error('Error getting location:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        },
      );
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
  };

  // Search for locations
  const searchLocations = debounce(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      // Build query parameters
      const params = new URLSearchParams({
        input: query,
      });

      // Add location bias if user location is available
      if (userLocation) {
        params.append('lat', userLocation.latitude.toString());
        params.append('lng', userLocation.longitude.toString());
        params.append('radius', '50000'); // 50km radius
      }

      const response = await axios.get(
        `${BACKEND_URL}/api/places/autocomplete?${params.toString()}`,
        {headers: {Authorization: `Bearer ${userToken}`}},
      );

      setSearchResults(response.data.predictions || []);
    } catch (error) {
      console.error('Error searching for locations:', error);
    } finally {
      setLoading(false);
    }
  }, 500);

  // Get details for a place
  const getPlaceDetails = async (placeId: string) => {
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/places/details?placeId=${placeId}`,
        {headers: {Authorization: `Bearer ${userToken}`}},
      );

      const place = response.data.result;
      if (place && place.geometry) {
        const newLocation: Location = {
          type: 'Point',
          coordinates: [
            place.geometry.location.lng,
            place.geometry.location.lat,
          ],
          address: place.formatted_address || place.name,
        };
        // Check if we're in destination mode (coming from BookRide)
        if (searching === 'destination') {
          // Save to recent locations
          await saveToRecent(newLocation);
          // Close modal and pass location back to BookRide
          onLocationSelected(newLocation);
          onClose();
        } else {
          // Navigate to map picker for address saving
          navigateToMapPicker(newLocation);
        }
      }
    } catch (error) {
      console.error('Error getting place details:', error);
    }
  };

  const navigateToMapPicker = (preselectedLocation?: Location) => {
    onClose(); // Close the search modal first

    navigation.navigate('MapLocationPicker', {
      onLocationSelected: (location: Location) => {
        onLocationSelected(location);
      },
      preselectedLocation: preselectedLocation, // Pass the preselected location
    });
  };

  // Handle search input change
  const onChangeSearch = (query: string) => {
    setSearchQuery(query);
    searchLocations(query);
  };

  // Handle saved address selection
  const handleSavedAddressSelection = (address: Address) => {
    if (address.location) {
      if (searching === 'destination') {
        // Coming from BookRide - pass location back directly
        onLocationSelected(address.location);
        onClose();
      } else {
        // Going to map picker for address saving
        navigateToMapPicker(address.location);
      }
    } else {
      console.error('Location data is missing for this address');
    }
  };

  // Handle recent location selection
  const handleRecentLocationSelection = (location: Location) => {
    if (searching === 'destination') {
      // Coming from BookRide - pass location back directly
      onLocationSelected(location);
      onClose();
    } else {
      // Going to map picker for address saving
      navigateToMapPicker(location);
    }
  };

  // helper function to save locations to recent
  const saveToRecent = async (location: Location) => {
    try {
      // Add to recent locations (avoid duplicates)
      const updatedRecent = [
        location,
        ...recentLocations.filter(
          recent => recent.address !== location.address,
        ),
      ].slice(0, 5); // Keep only 5 recent locations

      setRecentLocations(updatedRecent);
      await AsyncStorage.setItem(
        'recentLocations',
        JSON.stringify(updatedRecent),
      );
    } catch (error) {
      console.error('Error saving to recent locations:', error);
    }
  };

  // function to handle "Choose on Map" button
  const handleChooseOnMap = () => {
    if (searching === 'destination') {
      // Close modal and let user select on BookRide map
      onClose();
    } else if (searching === 'saveAddress') {
      navigateToMapPicker();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" size={24} onPress={onClose} />
          <Text style={styles.headerTitle}>
            {searching === 'saveAddress' ? 'Set Address' : 'Set Destination'}
          </Text>
        </View>

        <Searchbar
          placeholder={
            searching === 'saveAddress'
              ? 'Search address'
              : 'Search destination'
          }
          onChangeText={onChangeSearch}
          value={searchQuery}
          style={styles.searchbar}
        />

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#3498db" />
          </View>
        )}

        <FlatList
          data={searchResults}
          keyExtractor={item => item.place_id}
          ItemSeparatorComponent={() => <Divider />}
          ListHeaderComponent={() => (
            <>
              {/* Current Location Indicator */}
              {userLocation && searchQuery.trim() && (
                <View style={styles.locationIndicator}>
                  <Icon name="crosshairs-gps" size={16} color="#27ae60" />
                  <Text style={styles.locationIndicatorText}>
                    Showing places near your location
                  </Text>
                </View>
              )}

              {/* Saved Addresses Section */}
              {!searchQuery.trim() && savedAddresses.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Saved Addresses</Text>
                  {savedAddresses.map(address => (
                    <React.Fragment key={`saved-${address._id}`}>
                      <TouchableOpacity
                        style={styles.locationItem}
                        onPress={() => handleSavedAddressSelection(address)}>
                        <Icon name="bookmark" size={24} color="#3498db" />
                        <View style={styles.locationItemContent}>
                          <Text style={styles.locationName} numberOfLines={1}>
                            {address.label}
                          </Text>
                          <Text
                            style={styles.locationAddress}
                            numberOfLines={1}>
                            {address.address}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <Divider />
                    </React.Fragment>
                  ))}
                </>
              )}

              {/* Recent Locations Section */}
              {!searchQuery.trim() && recentLocations.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Recent Locations</Text>
                  {recentLocations.map((location, index) => (
                    <React.Fragment key={`recent-${index}`}>
                      <TouchableOpacity
                        style={styles.locationItem}
                        onPress={() => handleRecentLocationSelection(location)}>
                        <Icon name="history" size={24} color="#7f8c8d" />
                        <View style={styles.locationItemContent}>
                          <Text
                            style={styles.locationAddress}
                            numberOfLines={1}>
                            {location.address}
                          </Text>
                        </View>
                      </TouchableOpacity>
                      <Divider />
                    </React.Fragment>
                  ))}
                  {searchQuery.trim() && (
                    <Text style={styles.sectionTitle}>Search Results</Text>
                  )}
                </>
              )}
            </>
          )}
          renderItem={({item}) => (
            <TouchableOpacity
              style={styles.locationItem}
              onPress={() => getPlaceDetails(item.place_id)}>
              <Icon name="map-marker" size={24} color="#3498db" />
              <View style={styles.locationItemContent}>
                <Text style={styles.locationName} numberOfLines={1}>
                  {item.structured_formatting?.main_text || item.description}
                </Text>
                <Text style={styles.locationAddress} numberOfLines={1}>
                  {item.structured_formatting?.secondary_text || ''}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={() =>
            !loading && searchQuery.trim() ? (
              <View style={styles.emptyContainer}>
                <Text>No results found</Text>
              </View>
            ) : null
          }
        />
        <Button
          mode="outlined"
          icon={({color}) => (
            <Icon name="gesture-tap" size={28} color={color} />
          )}
          style={styles.chooseOnMapButton}
          onPress={handleChooseOnMap}>
          Tap on the Map
        </Button>
      </View>
    </Modal>
  );
};

export default LocationSearchModal;
