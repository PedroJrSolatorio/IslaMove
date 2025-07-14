import React, {useState, useEffect, useRef, useCallback} from 'react';
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
  mainText?: string;
  secondaryText?: string;
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

const generateSessionToken = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

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

  // Generate unique session token per modal session
  const [sessionToken] = useState(() => generateSessionToken());

  // Cache for search results to avoid redundant API calls
  const searchCache = useRef<Map<string, any[]>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Clear cache when modal closes
  useEffect(() => {
    if (!visible) {
      searchCache.current.clear();
    }
  }, [visible]);

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
  const searchLocations = useCallback(
    debounce(async (query: string) => {
      console.log('searchLocations called with query:', query);
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Only search if query has 3+ characters
      if (!query.trim() || query.trim().length < 3) {
        setSearchResults([]);
        return;
      }

      // Check cache first
      const cacheKey = `${query}-${userLocation?.latitude}-${userLocation?.longitude}`;
      if (searchCache.current.has(cacheKey)) {
        console.log('Using cached results for:', query);
        setSearchResults(searchCache.current.get(cacheKey)!);
        return;
      }

      setLoading(true);
      abortControllerRef.current = new AbortController();

      try {
        const params = new URLSearchParams({
          input: query,
          sessionToken, // Use unique session token
        });

        // Add location bias if user location is available
        if (userLocation) {
          params.append('lat', userLocation.latitude.toString());
          params.append('lng', userLocation.longitude.toString());
          params.append('radius', '6000'); // 6km radius, this is used to filter results based on proximity from user's location
        }

        console.log('Making API call with params:', params.toString());

        const response = await axios.get(
          `${BACKEND_URL}/api/places/autocomplete?${params.toString()}`,
          {
            headers: {Authorization: `Bearer ${userToken}`},
            timeout: 8000, // Cancel request if it takes longer than 8s to prevent UI freeze
            signal: abortControllerRef.current.signal,
          },
        );

        console.log('API response:', response.data);

        const results = response.data.predictions || [];
        // Cache results for this query
        searchCache.current.set(cacheKey, results);
        setSearchResults(results);
      } catch (error: any) {
        if (error.name !== 'CanceledError') {
          console.error('Error searching for locations:', error);
          setSearchResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, 1000), // Debounce to avoid excessive API calls, delays 1 second before calling API
    [],
  );

  // Only call details when user actually selects a prediction
  const handleLocationSelect = async (prediction: any) => {
    try {
      setLoading(true);
      // Still calls the Places API Place Details istead of just using the Places API Autocomplete because Autocomplete results don't include coordinates
      const response = await axios.get(`${BACKEND_URL}/api/places/details`, {
        params: {
          placeId: prediction.place_id,
          sessionToken, // Same session token for billing optimization
        },
        headers: {Authorization: `Bearer ${userToken}`},
      });

      const place = response.data.result;
      if (place && place.geometry) {
        const newLocation: Location = {
          type: 'Point',
          coordinates: [
            place.geometry.location.lng,
            place.geometry.location.lat,
          ],
          address: place.formatted_address,
          mainText:
            prediction.structured_formatting?.main_text ||
            prediction.description,
          secondaryText: prediction.structured_formatting?.secondary_text || '',
        };
        // Check if we're in destination mode (coming from BookRide)
        if (searching === 'destination') {
          // Save to recent locations
          await saveToRecent(newLocation);
          // Close modal and pass location back to BookRide
          onLocationSelected(newLocation);
          onClose();
        } else {
          await saveToRecent(newLocation);
          // Navigate to map picker for address saving
          navigateToMapPicker(newLocation);
        }
      }
    } catch (error) {
      console.error('Error getting place details:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateToMapPicker = (preselectedLocation?: Location) => {
    onClose(); // Close the search modal first

    // Create a unique callback ID to avoid passing functions in params
    const callbackId = `location_callback_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Store the callback globally or in a context
    (global as any).locationCallbacks = (global as any).locationCallbacks || {};
    (global as any).locationCallbacks[callbackId] = (location: Location) => {
      // Preserve the structured format from the original preselected location
      const locationWithStructuredFormat = {
        ...location,
        mainText: preselectedLocation?.mainText || location.mainText,
        secondaryText:
          preselectedLocation?.secondaryText || location.secondaryText,
      };
      onLocationSelected(locationWithStructuredFormat);
      // Clean up the callback after use
      delete (global as any).locationCallbacks[callbackId];
    };

    navigation.navigate('MapLocationPicker', {
      callbackId: callbackId,
      preselectedLocation: preselectedLocation,
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
      // Ensure the location has proper display text
      const locationWithDisplayText = {
        ...address.location,
        mainText: address.location.mainText || address.label || 'Saved Address',
        secondaryText: address.location.secondaryText || address.address || '',
      };
      if (searching === 'destination') {
        // Coming from BookRide - pass location back directly
        onLocationSelected(locationWithDisplayText);
        onClose();
      } else {
        // Going to map picker for address saving
        navigateToMapPicker(locationWithDisplayText);
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
      // Ensure we have proper display text
      const displayText = location.mainText || 'Unknown Location';
      const secondaryText = location.secondaryText || '';

      // Create a properly formatted location object
      const formattedLocation: Location = {
        type: location.type,
        coordinates: location.coordinates,
        address: location.address,
        mainText: displayText,
        secondaryText: secondaryText,
      };

      // Add to recent locations (avoid duplicates based on coordinates)
      const updatedRecent = [
        formattedLocation,
        ...recentLocations.filter(recent => {
          // Check for duplicate based on coordinates instead of just address
          const [lng1, lat1] = recent.coordinates || [0, 0];
          const [lng2, lat2] = location.coordinates || [0, 0];
          const distance = Math.sqrt(
            Math.pow(lng1 - lng2, 2) + Math.pow(lat1 - lat2, 2),
          );
          return distance > 0.001; // ~100m threshold for considering locations different
        }),
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

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
                            {[location.mainText, ', ', location.secondaryText]}
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
              onPress={() => handleLocationSelect(item)}>
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
