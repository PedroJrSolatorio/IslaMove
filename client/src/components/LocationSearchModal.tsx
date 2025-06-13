import React, {useState, useEffect} from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {Text, Searchbar, Divider, IconButton} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import axios from 'axios';
import debounce from 'lodash/debounce';
import {useAuth} from '../context/AuthContext';
import {BACKEND_URL} from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {styles} from '../styles/LocationSMStyles';

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
  searching: 'saveAddress' | 'destination';
  savedAddresses: Address[];
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

  // Load recent locations from storage
  useEffect(() => {
    const loadRecentLocations = async () => {
      try {
        // Implementation would depend on your storage method
        // This is a placeholder for actual implementation
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

  // Search for locations
  const searchLocations = debounce(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(
        `${BACKEND_URL}/api/places/autocomplete?input=${encodeURIComponent(
          query,
        )}`,
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

        // Save to recent locations
        saveRecentLocation(newLocation);

        onLocationSelected(newLocation);
      }
    } catch (error) {
      console.error('Error getting place details:', error);
    }
  };

  // Save location to recent locations
  const saveRecentLocation = async (location: Location) => {
    try {
      const updatedRecentLocations = [
        location,
        ...recentLocations
          .filter(loc => loc.address !== location.address)
          .slice(0, 4),
      ];
      setRecentLocations(updatedRecentLocations);

      // Implementation would depend on your storage method
      await AsyncStorage.setItem(
        'recentLocations',
        JSON.stringify(updatedRecentLocations),
      );
    } catch (error) {
      console.error('Error saving recent location:', error);
    }
  };

  // Handle search input change
  const onChangeSearch = (query: string) => {
    setSearchQuery(query);
    searchLocations(query);
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
              {/* Saved Addresses Section */}
              {!searchQuery.trim() && savedAddresses.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Saved Addresses</Text>
                  {savedAddresses.map(address => (
                    <React.Fragment key={`saved-${address._id}`}>
                      <TouchableOpacity
                        style={styles.locationItem}
                        onPress={() => {
                          if (address.location) {
                            onLocationSelected(address.location);
                            onClose();
                          } else {
                            console.error(
                              'Location data is missing for this address',
                            );
                          }
                        }}>
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
                        onPress={() => onLocationSelected(location)}>
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
      </View>
    </Modal>
  );
};

export default LocationSearchModal;
