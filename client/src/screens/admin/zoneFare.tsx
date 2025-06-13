import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import axios from 'axios';
import {BACKEND_URL} from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, {Polygon, Marker} from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {Picker} from '@react-native-picker/picker';
import {styles} from '../../styles/zoneFareStyles';

// Define interfaces for type safety
interface Zone {
  _id: string;
  name: string;
  coordinates: number[][][];
  color?: string;
  zoneType: 'barangay' | 'area' | 'landmark';
  parentZone?: Zone | string | null;
  priority: number;
  description?: string;
  isActive: boolean;
}

interface Pricing {
  _id: string;
  fromZone: string | Zone;
  toZone: string | Zone;
  amount: number;
  pricingType: 'fixed' | 'minimum' | 'special';
  vehicleType: string;
  description?: string;
  priority: number;
  isActive: boolean;
}

interface CoordinateValidation {
  isValid: boolean;
  error?: string;
  coordinates: number[][][]; // Remove the optional operator
}

const ZoneFareCalculator = () => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [barangayZones, setBarangayZones] = useState<Zone[]>([]);
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isZoneModalVisible, setIsZoneModalVisible] = useState(false);
  const [isPricingModalVisible, setIsPricingModalVisible] = useState(false);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);

  // Zone form states
  const [zoneName, setZoneName] = useState('');
  const [zoneCoordinates, setZoneCoordinates] = useState('');
  const [zoneColor, setZoneColor] = useState('#3498db');
  const [zoneType, setZoneType] = useState<'barangay' | 'area' | 'landmark'>(
    'barangay',
  );
  const [parentZone, setParentZone] = useState('');
  const [zoneDescription, setZoneDescription] = useState('');
  const [zonePriority, setZonePriority] = useState('');

  // Pricing form states
  const [searchQuery, setSearchQuery] = useState('');
  const [fromZone, setFromZone] = useState('');
  const [toZone, setToZone] = useState('');
  const [fareAmount, setFareAmount] = useState('');
  const [pricingType, setPricingType] = useState<
    'fixed' | 'minimum' | 'special'
  >('fixed');
  const [vehicleType, setVehicleType] = useState('bao-bao');
  const [pricingDescription, setPricingDescription] = useState('');
  const [pricingPriority, setPricingPriority] = useState('');
  const [selectedPricing, setSelectedPricing] = useState<Pricing | null>(null);

  // Map states
  const [mapRegion, setMapRegion] = useState({
    latitude: 0,
    longitude: 0,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [markerPosition, setMarkerPosition] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [foundZone, setFoundZone] = useState<Zone | null>(null);
  const [loading, setLoading] = useState(false);

  // Filter states
  const [selectedZoneTypeFilter, setSelectedZoneTypeFilter] =
    useState<string>('all');
  const [selectedParentZoneFilter, setSelectedParentZoneFilter] =
    useState<string>('all');

  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'We need your location to show your position on the map.',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  useEffect(() => {
    const init = async () => {
      await getCurrentLocation();
      fetchZonesAndPricing();
    };
    init();
  }, []);

  const getCurrentLocation = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Cannot access location.');
      return;
    }

    Geolocation.getCurrentPosition(
      position => {
        const {latitude, longitude} = position.coords;
        setMapRegion({
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
        setMarkerPosition({latitude, longitude});
      },
      error => {
        console.error('Location error:', error);
        Alert.alert('Location Error', 'Could not fetch your location.');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
        forceRequestLocation: true,
      },
    );
  };

  const fetchZonesAndPricing = async () => {
    try {
      setRefreshing(true);
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');

      // Fetch all zones
      const zonesResponse = await axios.get(`${BACKEND_URL}/api/admin/zones`, {
        headers: {Authorization: `Bearer ${token}`},
      });

      // Fetch barangay zones specifically
      const barangayResponse = await axios.get(
        `${BACKEND_URL}/api/admin/zones/barangays`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );

      // Fetch pricing rules
      const pricingResponse = await axios.get(
        `${BACKEND_URL}/api/admin/pricing`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );

      setZones(zonesResponse.data.zones || []);
      setBarangayZones(barangayResponse.data.zones || []);
      setPricing(pricingResponse.data.data || []);
      setRefreshing(false);
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching zones and pricing:', error);
      setRefreshing(false);
      setLoading(false);
      Alert.alert('Error', 'Failed to load zones and pricing');
    }
  };

  // helper function for coordinate validation:
  const validateCoordinates = (
    coordinatesString: string,
  ): CoordinateValidation => {
    try {
      const parsed = JSON.parse(coordinatesString);

      // Check if it's a valid polygon structure
      if (!Array.isArray(parsed) || !Array.isArray(parsed[0])) {
        return {
          isValid: false,
          error: 'Invalid coordinate structure',
          coordinates: [],
        };
      }

      // Check if polygon has at least 3 points
      if (parsed[0].length < 3) {
        return {
          isValid: false,
          error: 'Polygon must have at least 3 coordinate points',
          coordinates: [],
        };
      }

      // Check if each coordinate pair is valid
      for (const coord of parsed[0]) {
        if (
          !Array.isArray(coord) ||
          coord.length !== 2 ||
          typeof coord[0] !== 'number' ||
          typeof coord[1] !== 'number'
        ) {
          return {
            isValid: false,
            error: 'Each coordinate must be [longitude, latitude] array',
            coordinates: [],
          };
        }
      }

      return {isValid: true, coordinates: parsed};
    } catch (error) {
      return {isValid: false, error: 'Invalid JSON format', coordinates: []};
    }
  };

  const handleAddZone = async () => {
    if (!zoneName.trim() || !zoneCoordinates.trim()) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    const validation = validateCoordinates(zoneCoordinates);
    if (!validation.isValid) {
      Alert.alert('Invalid Coordinates', validation.error);
      return;
    }

    try {
      const token = await AsyncStorage.getItem('userToken');

      // Fix: Define proper interface for the payload
      interface ZonePayload {
        name: string;
        coordinates: {
          type: string;
          coordinates: number[][][];
        };
        color: string;
        zoneType: 'barangay' | 'area' | 'landmark';
        description: string;
        parentZone?: string;
        priority?: number;
      }

      const payload: ZonePayload = {
        name: zoneName,
        coordinates: {
          type: 'Polygon',
          coordinates: validation.coordinates,
        },
        color: zoneColor,
        zoneType,
        description: zoneDescription,
      };

      if (parentZone && zoneType !== 'barangay') {
        payload.parentZone = parentZone;
      }

      if (zonePriority) {
        payload.priority = parseInt(zonePriority);
      }

      await axios.post(`${BACKEND_URL}/api/admin/zones`, payload, {
        headers: {Authorization: `Bearer ${token}`},
      });

      Alert.alert('Success', 'Zone added successfully');
      setIsZoneModalVisible(false);
      resetZoneForm();
      fetchZonesAndPricing();
    } catch (error: any) {
      // Fix: Properly type the error
      console.error('Error adding zone:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to add zone',
      );
    }
  };

  const handleUpdateZone = async () => {
    if (!zoneName.trim() || !zoneCoordinates.trim() || !selectedZone) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    const validation = validateCoordinates(zoneCoordinates);
    if (!validation.isValid) {
      Alert.alert('Invalid Coordinates', validation.error);
      return;
    }

    try {
      const token = await AsyncStorage.getItem('userToken');

      interface ZoneUpdatePayload {
        name: string;
        coordinates: number[][][];
        color: string;
        zoneType: 'barangay' | 'area' | 'landmark';
        description: string;
        parentZone?: string | null;
        priority?: number;
      }

      const payload: ZoneUpdatePayload = {
        name: zoneName,
        coordinates: validation.coordinates,
        color: zoneColor,
        zoneType,
        description: zoneDescription,
        parentZone: parentZone || null,
      };

      if (zonePriority) {
        payload.priority = parseInt(zonePriority);
      }

      await axios.put(
        `${BACKEND_URL}/api/admin/zones/${selectedZone._id}`,
        payload,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );

      Alert.alert('Success', 'Zone updated successfully');
      setIsZoneModalVisible(false);
      resetZoneForm();
      fetchZonesAndPricing();
    } catch (error: any) {
      console.error('Error updating zone:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to update zone',
      );
    }
  };

  const handleDeleteZone = async (zone: Zone) => {
    Alert.alert(
      'Delete Zone',
      `Are you sure you want to delete ${zone.name}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('userToken');
              await axios.delete(`${BACKEND_URL}/api/admin/zones/${zone._id}`, {
                headers: {Authorization: `Bearer ${token}`},
              });

              Alert.alert('Success', 'Zone deleted successfully');
              fetchZonesAndPricing();
            } catch (error: any) {
              console.error('Error deleting zone:', error);
              Alert.alert(
                'Error',
                error.response?.data?.message || 'Failed to delete zone',
              );
            }
          },
        },
      ],
    );
  };

  const handleAddPricing = async () => {
    if (!fromZone || !toZone || !fareAmount || isNaN(parseFloat(fareAmount))) {
      Alert.alert('Error', 'Please fill all required fields with valid values');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('userToken');

      interface PricingPayload {
        fromZone: string;
        toZone: string;
        amount: number;
        pricingType: 'fixed' | 'minimum' | 'special';
        vehicleType: string;
        description: string;
        priority?: number;
      }

      const payload: PricingPayload = {
        fromZone,
        toZone,
        amount: parseFloat(fareAmount),
        pricingType,
        vehicleType: 'bao-bao',
        description: pricingDescription,
      };

      if (pricingPriority) {
        payload.priority = parseInt(pricingPriority);
      }

      await axios.post(`${BACKEND_URL}/api/admin/pricing`, payload, {
        headers: {Authorization: `Bearer ${token}`},
      });

      Alert.alert('Success', 'Pricing rule added successfully');
      setIsPricingModalVisible(false);
      resetPricingForm();
      fetchZonesAndPricing();
    } catch (error: any) {
      console.error('Error adding pricing rule:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to add pricing rule',
      );
    }
  };

  const handleUpdatePricing = async () => {
    if (
      !fromZone ||
      !toZone ||
      !fareAmount ||
      isNaN(parseFloat(fareAmount)) ||
      !selectedPricing
    ) {
      Alert.alert('Error', 'Please fill all required fields with valid values');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('userToken');

      interface PricingUpdatePayload {
        fromZone: string;
        toZone: string;
        amount: number;
        pricingType: 'fixed' | 'minimum' | 'special';
        vehicleType: string;
        description: string;
        priority?: number;
      }

      const payload: PricingUpdatePayload = {
        fromZone,
        toZone,
        amount: parseFloat(fareAmount),
        pricingType,
        vehicleType: 'bao-bao',
        description: pricingDescription,
      };

      if (pricingPriority) {
        payload.priority = parseInt(pricingPriority);
      }

      await axios.put(
        `${BACKEND_URL}/api/admin/pricing/${selectedPricing._id}`,
        payload,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );

      Alert.alert('Success', 'Pricing rule updated successfully');
      setIsPricingModalVisible(false);
      resetPricingForm();
      fetchZonesAndPricing();
    } catch (error: any) {
      console.error('Error updating pricing rule:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to update pricing rule',
      );
    }
  };

  const handleDeletePricing = async (pricing: Pricing) => {
    Alert.alert(
      'Delete Pricing Rule',
      'Are you sure you want to delete this pricing rule?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('userToken');
              await axios.delete(
                `${BACKEND_URL}/api/admin/pricing/${pricing._id}`,
                {
                  headers: {Authorization: `Bearer ${token}`},
                },
              );

              Alert.alert('Success', 'Pricing rule deleted successfully');
              fetchZonesAndPricing();
            } catch (error: any) {
              console.error('Error deleting pricing rule:', error);
              Alert.alert('Error', 'Failed to delete pricing rule');
            }
          },
        },
      ],
    );
  };

  const editZone = (zone: Zone) => {
    setSelectedZone(zone);
    setZoneName(zone.name);
    setZoneCoordinates(JSON.stringify(zone.coordinates));
    setZoneColor(zone.color || '#3498db');
    setZoneType(zone.zoneType);
    setZoneDescription(zone.description || '');
    setZonePriority(zone.priority?.toString() || '');
    setParentZone(
      typeof zone.parentZone === 'object' && zone.parentZone
        ? zone.parentZone._id
        : typeof zone.parentZone === 'string'
        ? zone.parentZone
        : '',
    );
    setIsZoneModalVisible(true);
  };

  const editPricing = (pricing: Pricing) => {
    setSelectedPricing(pricing);
    setFromZone(
      typeof pricing.fromZone === 'string'
        ? pricing.fromZone
        : pricing.fromZone._id,
    );
    setToZone(
      typeof pricing.toZone === 'string' ? pricing.toZone : pricing.toZone._id,
    );
    setFareAmount(pricing.amount.toString());
    setPricingType(pricing.pricingType);
    setVehicleType(pricing.vehicleType);
    setPricingDescription(pricing.description || '');
    setPricingPriority(pricing.priority?.toString() || '');
    setIsPricingModalVisible(true);
  };

  const resetZoneForm = () => {
    setSelectedZone(null);
    setZoneName('');
    setZoneCoordinates('');
    setZoneColor('#3498db');
    setZoneType('barangay');
    setParentZone('');
    setZoneDescription('');
    setZonePriority('');
  };

  const resetPricingForm = () => {
    setSelectedPricing(null);
    setFromZone('');
    setToZone('');
    setFareAmount('');
    setPricingType('fixed');
    setVehicleType('sedan');
    setPricingDescription('');
    setPricingPriority('');
  };

  const lookupZone = async () => {
    if (!markerPosition) {
      Alert.alert('Error', 'Please place a marker on the map first');
      return;
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');

      const response = await axios.get(
        `${BACKEND_URL}/api/admin/zones/lookup`,
        {
          params: {
            latitude: markerPosition.latitude,
            longitude: markerPosition.longitude,
          },
          headers: {Authorization: `Bearer ${token}`},
        },
      );

      if (response.data.success && response.data.data) {
        setFoundZone(response.data.data);
        const zone = response.data.data;
        const parentInfo = zone.parentZone
          ? ` (Part of ${zone.parentZone.name})`
          : '';
        Alert.alert(
          'Zone Found',
          `This location is in:\n${zone.name} (${zone.zoneType})${parentInfo}`,
        );
      } else {
        setFoundZone(null);
        Alert.alert(
          'No Zone Found',
          'This location is not within any defined zone',
        );
      }
      setLoading(false);
    } catch (error: any) {
      console.error('Error looking up zone:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to look up zone');
    }
  };

  const handleMapPress = (event: any) => {
    const {coordinate} = event.nativeEvent;
    setMarkerPosition(coordinate);
  };

  const getZoneTypeColor = (zoneType: string) => {
    switch (zoneType) {
      case 'barangay':
        return '#3498db';
      case 'area':
        return '#2ecc71';
      case 'landmark':
        return '#e74c3c';
      default:
        return '#95a5a6';
    }
  };

  const getPricingTypeColor = (pricingType: string) => {
    switch (pricingType) {
      case 'fixed':
        return '#3498db';
      case 'minimum':
        return '#f39c12';
      case 'special':
        return '#9b59b6';
      default:
        return '#95a5a6';
    }
  };

  const getFilteredZones = () => {
    return zones.filter(zone => {
      const typeMatch =
        selectedZoneTypeFilter === 'all' ||
        zone.zoneType === selectedZoneTypeFilter;
      const parentMatch =
        selectedParentZoneFilter === 'all' ||
        (selectedParentZoneFilter === 'none' && !zone.parentZone) ||
        (typeof zone.parentZone === 'object' &&
          zone.parentZone?._id === selectedParentZoneFilter) ||
        (typeof zone.parentZone === 'string' &&
          zone.parentZone === selectedParentZoneFilter);

      const nameMatch = zone.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      return typeMatch && parentMatch && nameMatch;
    });
  };

  const renderZoneItem = ({item}: {item: Zone}) => {
    const parentName =
      typeof item.parentZone === 'object' && item.parentZone
        ? item.parentZone.name
        : '';

    return (
      <View style={styles.tableRow}>
        <View style={styles.zoneInfoContainer}>
          <View style={styles.zoneHeaderRow}>
            <View style={styles.zoneNameContainer}>
              <View
                style={[
                  styles.colorIndicator,
                  {backgroundColor: item.color || '#3498db'},
                ]}
              />
              <Text style={styles.itemText}>{item.name}</Text>
              <View
                style={[
                  styles.typeTag,
                  {backgroundColor: getZoneTypeColor(item.zoneType)},
                ]}>
                <Text style={styles.typeTagText}>
                  {item.zoneType.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
          {parentName && (
            <Text style={styles.parentZoneText}>Part of: {parentName}</Text>
          )}
          {item.description && (
            <Text style={styles.descriptionText}>{item.description}</Text>
          )}
          <Text style={styles.priorityText}>Priority: {item.priority}</Text>
        </View>
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            onPress={() => editZone(item)}
            style={styles.iconButton}>
            <Icon name="edit" size={20} color="#2980b9" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDeleteZone(item)}
            style={styles.iconButton}>
            <Icon name="delete" size={20} color="#e74c3c" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderPricingItem = ({item}: {item: Pricing}) => {
    const fromZoneName =
      typeof item.fromZone === 'object'
        ? item.fromZone.name
        : zones.find(z => z._id === item.fromZone)?.name || 'Unknown';

    const toZoneName =
      typeof item.toZone === 'object'
        ? item.toZone.name
        : zones.find(z => z._id === item.toZone)?.name || 'Unknown';

    return (
      <View style={styles.tableRow}>
        <View style={styles.pricingInfoContainer}>
          <View style={styles.pricingHeaderRow}>
            <Text style={styles.itemText}>{fromZoneName}</Text>
            <Icon name="arrow-forward" size={16} color="#7f8c8d" />
            <Text style={styles.itemText}>{toZoneName}</Text>
          </View>
          <View style={styles.pricingDetailsRow}>
            <View
              style={[
                styles.typeTag,
                {backgroundColor: getPricingTypeColor(item.pricingType)},
              ]}>
              <Text style={styles.typeTagText}>
                {item.pricingType.toUpperCase()}
              </Text>
            </View>
          </View>
          {item.description && (
            <Text style={styles.descriptionText}>{item.description}</Text>
          )}
          <Text style={styles.priorityText}>Priority: {item.priority}</Text>
        </View>
        <View style={styles.fareTypeContainer}>
          <Text style={styles.itemText}>₱{item.amount.toFixed(2)}</Text>
        </View>
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            onPress={() => editPricing(item)}
            style={styles.iconButton}>
            <Icon name="edit" size={20} color="#2980b9" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDeletePricing(item)}
            style={styles.iconButton}>
            <Icon name="delete" size={20} color="#e74c3c" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Zone Modal */}
      <Modal
        visible={isZoneModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setIsZoneModalVisible(false);
          resetZoneForm();
        }}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContainer}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>
                {selectedZone ? 'Edit Zone' : 'Add New Zone'}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Zone Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={zoneName}
                  onChangeText={setZoneName}
                  placeholder="Enter zone name"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Zone Type *</Text>
                <View style={styles.dropdownContainer}>
                  <Picker
                    selectedValue={zoneType}
                    style={styles.picker}
                    onValueChange={itemValue => {
                      setZoneType(itemValue);
                      if (itemValue === 'barangay') {
                        setParentZone('');
                      }
                    }}>
                    <Picker.Item label="Barangay" value="barangay" />
                    <Picker.Item label="Area" value="area" />
                    <Picker.Item label="Landmark" value="landmark" />
                  </Picker>
                </View>
              </View>

              {zoneType !== 'barangay' && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Parent Barangay</Text>
                  <View style={styles.dropdownContainer}>
                    <Picker
                      selectedValue={parentZone}
                      style={styles.picker}
                      onValueChange={setParentZone}>
                      <Picker.Item label="Select parent barangay" value="" />
                      {barangayZones.map(zone => (
                        <Picker.Item
                          key={zone._id}
                          label={zone.name}
                          value={zone._id}
                        />
                      ))}
                    </Picker>
                  </View>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Coordinates (GeoJSON format) *
                </Text>
                <TextInput
                  style={[styles.textInput, styles.multilineInput]}
                  value={zoneCoordinates}
                  onChangeText={setZoneCoordinates}
                  placeholder="[[[longitude1,latitude1], [longitude2,latitude2], ...]]"
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Color (hex)</Text>
                <TextInput
                  style={styles.textInput}
                  value={zoneColor}
                  onChangeText={setZoneColor}
                  placeholder="#3498db"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={styles.textInput}
                  value={zoneDescription}
                  onChangeText={setZoneDescription}
                  placeholder="Zone description (optional)"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Priority</Text>
                <TextInput
                  style={styles.textInput}
                  value={zonePriority}
                  onChangeText={setZonePriority}
                  keyboardType="numeric"
                  placeholder="Priority number (higher = more specific)"
                />
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={selectedZone ? handleUpdateZone : handleAddZone}>
                <Text style={styles.buttonText}>
                  {selectedZone ? 'Update Zone' : 'Add Zone'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setIsZoneModalVisible(false);
                  resetZoneForm();
                }}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Pricing Modal */}
      <Modal
        visible={isPricingModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setIsPricingModalVisible(false);
          resetPricingForm();
        }}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContainer}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>
                {selectedPricing ? 'Edit Pricing Rule' : 'Add New Pricing Rule'}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>From Zone *</Text>
                <View style={styles.dropdownContainer}>
                  <Picker
                    selectedValue={fromZone}
                    style={styles.picker}
                    onValueChange={setFromZone}>
                    <Picker.Item label="Select source zone" value="" />
                    {zones.map(zone => (
                      <Picker.Item
                        key={zone._id}
                        label={`${zone.name} (${zone.zoneType})`}
                        value={zone._id}
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>To Zone *</Text>
                <View style={styles.dropdownContainer}>
                  <Picker
                    selectedValue={toZone}
                    style={styles.picker}
                    onValueChange={setToZone}>
                    <Picker.Item label="Select destination zone" value="" />
                    {zones.map(zone => (
                      <Picker.Item
                        key={zone._id}
                        label={`${zone.name} (${zone.zoneType})`}
                        value={zone._id}
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Pricing Type *</Text>
                <View style={styles.dropdownContainer}>
                  <Picker
                    selectedValue={pricingType}
                    style={styles.picker}
                    onValueChange={setPricingType}>
                    <Picker.Item label="Fixed Price" value="fixed" />
                    <Picker.Item label="Minimum Fare" value="minimum" />
                    <Picker.Item label="Special Rate" value="special" />
                  </Picker>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Fare Amount *</Text>
                <TextInput
                  style={styles.textInput}
                  value={fareAmount}
                  onChangeText={setFareAmount}
                  keyboardType="numeric"
                  placeholder="Enter fare amount (₱)"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={styles.textInput}
                  value={pricingDescription}
                  onChangeText={setPricingDescription}
                  placeholder="Pricing rule description (optional)"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Priority</Text>
                <TextInput
                  style={styles.textInput}
                  value={pricingPriority}
                  onChangeText={setPricingPriority}
                  keyboardType="numeric"
                  placeholder="Priority number (higher = more specific)"
                />
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={
                  selectedPricing ? handleUpdatePricing : handleAddPricing
                }>
                <Text style={styles.buttonText}>
                  {selectedPricing ? 'Update Pricing Rule' : 'Add Pricing Rule'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setIsPricingModalVisible(false);
                  resetPricingForm();
                }}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Main Content */}
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={fetchZonesAndPricing}
          />
        }>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Zone & Fare Management</Text>
          <Text style={styles.headerSubtitle}>
            Manage barangays, areas, and pricing rules
          </Text>
        </View>

        {/* Zone Lookup Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zone Lookup Tool</Text>
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              region={mapRegion}
              onPress={handleMapPress}
              showsUserLocation={true}
              showsMyLocationButton={false}>
              {/* Render all zones as polygons */}
              {zones
                .filter(zone => {
                  // Only render zones that have valid coordinates
                  return (
                    zone.coordinates &&
                    zone.coordinates[0] &&
                    Array.isArray(zone.coordinates[0]) &&
                    zone.coordinates[0].length >= 3 // Polygon needs at least 3 points
                  );
                })
                .map(zone => {
                  const coordinates = zone.coordinates[0].map(coord => ({
                    latitude: coord[1],
                    longitude: coord[0],
                  }));

                  return (
                    <Polygon
                      key={zone._id}
                      coordinates={coordinates}
                      fillColor={`${zone.color || '#3498db'}30`}
                      strokeColor={zone.color || '#3498db'}
                      strokeWidth={2}
                    />
                  );
                })}

              {/* Marker for selected position */}
              {markerPosition && (
                <Marker
                  coordinate={markerPosition}
                  title="Selected Location"
                  description={
                    foundZone
                      ? `In ${foundZone.name}`
                      : 'Tap "Lookup Zone" to identify'
                  }
                />
              )}
            </MapView>

            <View style={styles.mapControls}>
              <TouchableOpacity
                style={styles.mapButton}
                onPress={getCurrentLocation}>
                <Icon name="my-location" size={20} color="#fff" />
                <Text style={styles.mapButtonText}>My Location</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.mapButton, styles.lookupButton]}
                onPress={lookupZone}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Icon name="search" size={20} color="#fff" />
                )}
                <Text style={styles.mapButtonText}>Lookup Zone</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Zone Management Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Zone Management</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => {
                resetZoneForm();
                setIsZoneModalVisible(true);
              }}>
              <Icon name="add" size={20} color="#fff" />
              <Text style={styles.addButtonText}>Add Zone</Text>
            </TouchableOpacity>
          </View>

          {/* Zone Filters */}
          <View style={styles.filtersContainer}>
            <View style={styles.filterRow}>
              <View style={styles.filterItem}>
                <Text style={styles.filterLabel}>Type:</Text>
                <View style={styles.filterDropdown}>
                  <Picker
                    selectedValue={selectedZoneTypeFilter}
                    style={styles.filterPicker}
                    onValueChange={setSelectedZoneTypeFilter}>
                    <Picker.Item label="All Types" value="all" />
                    <Picker.Item label="Barangay" value="barangay" />
                    <Picker.Item label="Area" value="area" />
                    <Picker.Item label="Landmark" value="landmark" />
                  </Picker>
                </View>
              </View>

              <View style={styles.filterItem}>
                <Text style={styles.filterLabel}>Parent:</Text>
                <View style={styles.filterDropdown}>
                  <Picker
                    selectedValue={selectedParentZoneFilter}
                    style={styles.filterPicker}
                    onValueChange={setSelectedParentZoneFilter}>
                    <Picker.Item label="All Parents" value="all" />
                    <Picker.Item label="No Parent" value="none" />
                    {barangayZones.map(zone => (
                      <Picker.Item
                        key={zone._id}
                        label={zone.name}
                        value={zone._id}
                      />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>

            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search zones by name..."
              placeholderTextColor="#95a5a6"
            />
          </View>

          {/* Zone List */}
          <FlatList
            data={getFilteredZones()}
            keyExtractor={item => item._id}
            renderItem={renderZoneItem}
            scrollEnabled={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No zones found</Text>
            }
          />
        </View>

        {/* Pricing Management Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pricing Rules</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => {
                resetPricingForm();
                setIsPricingModalVisible(true);
              }}>
              <Icon name="add" size={20} color="#fff" />
              <Text style={styles.addButtonText}>Add Rule</Text>
            </TouchableOpacity>
          </View>

          {/* Pricing List */}
          <FlatList
            data={pricing}
            keyExtractor={item => item._id}
            renderItem={renderPricingItem}
            scrollEnabled={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No pricing rules found</Text>
            }
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ZoneFareCalculator;
