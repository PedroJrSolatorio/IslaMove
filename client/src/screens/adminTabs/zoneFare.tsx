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
  baseAmount: number;
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

interface DiscountConfig {
  _id?: string;
  name?: string;
  discounts: {
    regular: number;
    student: number;
    senior: number;
    student_child: number;
  };
  ageBasedRules?: {
    studentChildMaxAge: number;
    enableAgeBasedDiscounts: boolean;
  };
  description?: string;
  isActive?: boolean;
  validFrom?: Date;
  validUntil?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
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

  const [discountConfig, setDiscountConfig] = useState<DiscountConfig | null>(
    null,
  );
  const [isDiscountModalVisible, setIsDiscountModalVisible] = useState(false);
  const [studentDiscount, setStudentDiscount] = useState('20');
  const [seniorDiscount, setSeniorDiscount] = useState('20');
  const [studentChildDiscount, setStudentChildDiscount] = useState('50');
  const [studentChildMaxAge, setStudentChildMaxAge] = useState('12');
  const [discountDescription, setDiscountDescription] = useState('');
  const [enableAgeBasedDiscounts, setEnableAgeBasedDiscounts] = useState(true);

  // Helper function to extract coordinates
  const extractCoordinates = (coords: any): number[][][] => {
    if (!coords) return [];

    // If it's a GeoJSON object, extract the coordinates
    if (coords.type === 'Polygon' && coords.coordinates) {
      return coords.coordinates; // This is already [[[lng, lat], ...]]
    }

    // If it's already a raw coordinates array
    if (Array.isArray(coords)) {
      // Check if we have the right nesting level
      // We want [[[lng, lat], [lng, lat], ...]] (3 levels)
      if (
        coords.length > 0 &&
        Array.isArray(coords[0]) &&
        Array.isArray(coords[0][0])
      ) {
        // If coords[0][0] is an array of numbers, we have the right format
        if (typeof coords[0][0][0] === 'number') {
          return coords; // Format: [[[lng, lat], ...]]
        }
        // If coords[0][0][0] is an array, we have too much nesting
        if (Array.isArray(coords[0][0][0])) {
          return coords[0]; // Remove one level: [[[[lng, lat], ...]]] -> [[[lng, lat], ...]]
        }
      }
    }

    return [];
  };

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
      const token = await AsyncStorage.getItem('userToken');

      const [zonesResponse, pricingResponse, discountResponse] =
        await Promise.all([
          axios.get(`${BACKEND_URL}/api/zones`, {
            headers: {Authorization: `Bearer ${token}`},
          }),
          axios.get(`${BACKEND_URL}/api/pricing`, {
            headers: {Authorization: `Bearer ${token}`},
          }),
          axios.get(`${BACKEND_URL}/api/discounts`, {
            headers: {Authorization: `Bearer ${token}`},
          }),
        ]);

      // Normalize zone coordinates to always be raw arrays
      const normalizedZones = zonesResponse.data.zones.map((zone: any) => ({
        ...zone,
        coordinates: extractCoordinates(zone.coordinates),
      }));

      setZones(normalizedZones);
      setBarangayZones(
        normalizedZones.filter((zone: Zone) => zone.zoneType === 'barangay'),
      );

      // Handle pricing data structure
      const pricingData =
        pricingResponse.data.data ||
        pricingResponse.data.pricing ||
        pricingResponse.data ||
        [];
      setPricing(pricingData);

      // Handle discount config
      if (discountResponse.data.success && discountResponse.data.data) {
        const config = discountResponse.data.data;
        console.log('Discount config received:', config);

        // Ensure discounts object exists and has the expected structure
        const normalizedConfig: DiscountConfig = {
          ...config,
          discounts: config.discounts || {
            regular: 0,
            student: 20,
            senior: 20,
            student_child: 50,
          },
          ageBasedRules: config.ageBasedRules || {
            studentChildMaxAge: 12,
            enableAgeBasedDiscounts: true,
          },
        };

        setDiscountConfig(normalizedConfig);

        // Use the normalized config for setting form values
        setStudentDiscount(
          normalizedConfig.discounts.student?.toString() || '20',
        );
        setSeniorDiscount(
          normalizedConfig.discounts.senior?.toString() || '20',
        );
        setStudentChildDiscount(
          normalizedConfig.discounts.student_child?.toString() || '50',
        );
        setStudentChildMaxAge(
          normalizedConfig.ageBasedRules?.studentChildMaxAge?.toString() ||
            '12',
        );
        setEnableAgeBasedDiscounts(
          normalizedConfig.ageBasedRules?.enableAgeBasedDiscounts ?? true,
        );
        setDiscountDescription(normalizedConfig.description || '');
      } else {
        // Set default values if no config found
        const defaultConfig: DiscountConfig = {
          discounts: {regular: 0, student: 20, senior: 20, student_child: 50},
          ageBasedRules: {
            studentChildMaxAge: 12,
            enableAgeBasedDiscounts: true,
          },
          description: 'Default discount configuration',
          isActive: true,
          name: 'Default Discount Configuration',
        };
        setDiscountConfig(defaultConfig);
        setStudentDiscount('20');
        setSeniorDiscount('20');
        setStudentChildDiscount('50');
        setStudentChildMaxAge('12');
        setEnableAgeBasedDiscounts(true);
        setDiscountDescription('Default discount configuration');
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      console.error('Error details:', error.response?.data); // Additional debug info
      Alert.alert('Error', 'Failed to fetch zones and pricing data');

      // Set default discount config on error
      const defaultConfig = {
        discounts: {regular: 0, student: 20, senior: 20, student_child: 50},
        ageBasedRules: {studentChildMaxAge: 12, enableAgeBasedDiscounts: true},
        description: 'Default discount configuration',
        isActive: true,
        name: 'Default Discount Configuration',
      };
      setDiscountConfig(defaultConfig);
      setStudentDiscount('20');
      setSeniorDiscount('20');
      setDiscountDescription('Default discount configuration');
    } finally {
      setRefreshing(false);
    }
  };

  // helper function for coordinate validation:
  const validateCoordinates = (
    coordinatesString: string,
  ): CoordinateValidation => {
    try {
      const parsed = JSON.parse(coordinatesString);

      // We expect format: [[[lng, lat], [lng, lat], ...]]
      if (!Array.isArray(parsed)) {
        return {
          isValid: false,
          error: 'Coordinates must be an array',
          coordinates: [],
        };
      }

      // Handle both 3-level and 4-level nesting for flexibility
      let coordinates: number[][][];

      if (Array.isArray(parsed[0]) && Array.isArray(parsed[0][0])) {
        if (typeof parsed[0][0][0] === 'number') {
          // Format: [[[lng, lat], ...]] - correct format
          coordinates = parsed;
        } else if (Array.isArray(parsed[0][0][0])) {
          // Format: [[[[lng, lat], ...]]] - remove one level of nesting
          coordinates = parsed[0];
        } else {
          return {
            isValid: false,
            error: 'Invalid coordinate structure',
            coordinates: [],
          };
        }
      } else {
        return {
          isValid: false,
          error: 'Invalid coordinate structure',
          coordinates: [],
        };
      }

      // Check if polygon has at least 3 points
      if (!coordinates[0] || coordinates[0].length < 3) {
        return {
          isValid: false,
          error: 'Polygon must have at least 3 coordinate points',
          coordinates: [],
        };
      }

      // Check if each coordinate pair is valid
      for (const coord of coordinates[0]) {
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

      return {isValid: true, coordinates};
    } catch (error) {
      return {isValid: false, error: 'Invalid JSON format', coordinates: []};
    }
  };

  // helper function to get discount values
  const getDiscountValue = (
    key: 'regular' | 'student' | 'senior' | 'student_child',
  ): number => {
    if (!discountConfig?.discounts) {
      // Return default values if discounts object is missing
      const defaults = {regular: 0, student: 20, senior: 20, student_child: 50};
      return defaults[key];
    }

    // Simply access the property directly since discounts is a plain object
    return discountConfig.discounts[key] ?? 0;
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

      // Define proper interface for the payload
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
          coordinates: validation.coordinates, // Keep GeoJSON format
        },
        color: zoneColor,
        zoneType,
        description: zoneDescription,
        parentZone:
          parentZone && zoneType !== 'barangay' ? parentZone : undefined,
        priority: zonePriority ? parseInt(zonePriority) : undefined,
      };

      await axios.post(`${BACKEND_URL}/api/zones`, payload, {
        headers: {Authorization: `Bearer ${token}`},
      });

      Alert.alert('Success', 'Zone added successfully');
      setIsZoneModalVisible(false);
      resetZoneForm();
      fetchZonesAndPricing();
    } catch (error: any) {
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

      // Define proper interface for the update payload
      interface ZoneUpdatePayload {
        name: string;
        coordinates: {
          type: string;
          coordinates: number[][][];
        };
        color: string;
        zoneType: 'barangay' | 'area' | 'landmark';
        description: string;
        parentZone?: string | null;
        priority?: number;
      }

      // Send coordinates in GeoJSON format, not raw array
      const payload: ZoneUpdatePayload = {
        name: zoneName,
        coordinates: {
          type: 'Polygon',
          coordinates: validation.coordinates, // This maintains GeoJSON format
        },
        color: zoneColor,
        zoneType,
        description: zoneDescription,
        parentZone: parentZone || null,
        priority: zonePriority ? parseInt(zonePriority) : undefined,
      };

      await axios.put(`${BACKEND_URL}/api/zones/${selectedZone._id}`, payload, {
        headers: {Authorization: `Bearer ${token}`},
      });

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
              await axios.delete(`${BACKEND_URL}/api/zones/${zone._id}`, {
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
        baseAmount: number;
        pricingType: 'fixed' | 'minimum' | 'special';
        vehicleType: string;
        description: string;
        priority?: number;
      }

      const payload: PricingPayload = {
        fromZone,
        toZone,
        baseAmount: parseFloat(fareAmount),
        pricingType,
        vehicleType: 'bao-bao',
        description: pricingDescription,
      };

      if (pricingPriority) {
        payload.priority = parseInt(pricingPriority);
      }

      await axios.post(`${BACKEND_URL}/api/pricing`, payload, {
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
        baseAmount: number;
        pricingType: 'fixed' | 'minimum' | 'special';
        vehicleType: string;
        description: string;
        priority?: number;
      }

      const payload: PricingUpdatePayload = {
        fromZone,
        toZone,
        baseAmount: parseFloat(fareAmount),
        pricingType,
        vehicleType: 'bao-bao',
        description: pricingDescription,
      };

      if (pricingPriority) {
        payload.priority = parseInt(pricingPriority);
      }

      await axios.put(
        `${BACKEND_URL}/api/pricing/${selectedPricing._id}`,
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
              await axios.delete(`${BACKEND_URL}/api/pricing/${pricing._id}`, {
                headers: {Authorization: `Bearer ${token}`},
              });

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

  const handleUpdateDiscountConfig = async () => {
    const studentDiscountNum = parseFloat(studentDiscount);
    const seniorDiscountNum = parseFloat(seniorDiscount);
    const studentChildDiscountNum = parseFloat(studentChildDiscount);
    const maxAge = parseInt(studentChildMaxAge);

    // Validation
    if (
      isNaN(studentDiscountNum) ||
      isNaN(seniorDiscountNum) ||
      isNaN(studentChildDiscountNum)
    ) {
      Alert.alert('Error', 'Please enter valid discount percentages');
      return;
    }

    if (isNaN(maxAge) || maxAge < 0 || maxAge > 25) {
      Alert.alert('Error', 'Student child max age must be between 0 and 25');
      return;
    }

    if (
      [studentDiscountNum, seniorDiscountNum, studentChildDiscountNum].some(
        val => val < 0 || val > 100,
      )
    ) {
      Alert.alert('Error', 'Discount percentages must be between 0 and 100');
      return;
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');

      const payload = {
        discounts: {
          regular: 0,
          student: studentDiscountNum,
          senior: seniorDiscountNum,
          student_child: studentChildDiscountNum,
        },
        ageBasedRules: {
          studentChildMaxAge: maxAge,
          enableAgeBasedDiscounts: enableAgeBasedDiscounts,
        },
        description: discountDescription,
      };

      console.log('Sending discount update payload:', payload);

      const response = await axios.put(
        `${BACKEND_URL}/api/discounts`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log('Discount update response:', response.data);

      if (response.data.success) {
        Alert.alert('Success', 'Discount configuration updated successfully');
        setIsDiscountModalVisible(false);
        await fetchZonesAndPricing();
      } else {
        Alert.alert(
          'Error',
          response.data.message || 'Failed to update discount configuration',
        );
      }
    } catch (error: any) {
      console.error('Error updating discount config:', error);
      Alert.alert(
        'Error',
        error.response?.data?.message ||
          'Failed to update discount configuration',
      );
    } finally {
      setLoading(false);
    }
  };

  const resetDiscountForm = () => {
    if (discountConfig) {
      setStudentDiscount(discountConfig.discounts.student?.toString() || '20');
      setSeniorDiscount(discountConfig.discounts.senior?.toString() || '20');
      setStudentChildDiscount(
        discountConfig.discounts.student_child?.toString() || '50',
      );
      setStudentChildMaxAge(
        discountConfig.ageBasedRules?.studentChildMaxAge?.toString() || '12',
      );
      setEnableAgeBasedDiscounts(
        discountConfig.ageBasedRules?.enableAgeBasedDiscounts ?? true,
      );
      setDiscountDescription(discountConfig.description || '');
    }
  };

  const editZone = (zone: Zone) => {
    setSelectedZone(zone);
    setZoneName(zone.name);

    // Extract coordinates and ensure proper format for display
    const coordinatesArray = extractCoordinates(zone.coordinates);
    // Always display in the 3-level format: [[[lng, lat], ...]]
    setZoneCoordinates(JSON.stringify(coordinatesArray, null, 2));

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
    setFareAmount(pricing.baseAmount.toString());
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
    setVehicleType('bao-bao');
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

      const response = await axios.get(`${BACKEND_URL}/api/zones/lookup`, {
        params: {
          latitude: markerPosition.latitude,
          longitude: markerPosition.longitude,
        },
        headers: {Authorization: `Bearer ${token}`},
      });

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

    const displayAmount = item.baseAmount || 0;

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
          {discountConfig && (
            <View style={styles.discountInfo}>
              <Text style={styles.discountText}>
                Regular: ₱{displayAmount.toFixed(2)}
              </Text>
              <Text style={styles.discountText}>
                Student: ₱
                {(
                  displayAmount *
                  (1 - discountConfig.discounts.student / 100)
                ).toFixed(2)}
                ({discountConfig.discounts.student}% off)
              </Text>
              <Text style={styles.discountText}>
                Senior: ₱
                {(
                  displayAmount *
                  (1 - discountConfig.discounts.senior / 100)
                ).toFixed(2)}
                ({discountConfig.discounts.senior}% off)
              </Text>
            </View>
          )}
        </View>
        <View style={styles.fareTypeContainer}>
          <Text style={styles.itemText}>₱{displayAmount.toFixed(2)}</Text>
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

      {/* Discount Configuration Modal */}
      <Modal
        visible={isDiscountModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setIsDiscountModalVisible(false);
          resetDiscountForm();
        }}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContainer}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Discount Configuration</Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Student Discount (%)</Text>
                <TextInput
                  style={styles.textInput}
                  value={studentDiscount}
                  onChangeText={setStudentDiscount}
                  keyboardType="numeric"
                  placeholder="Enter student discount percentage"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Senior Discount (%)</Text>
                <TextInput
                  style={styles.textInput}
                  value={seniorDiscount}
                  onChangeText={setSeniorDiscount}
                  keyboardType="numeric"
                  placeholder="Enter senior discount percentage"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={styles.textInput}
                  value={discountDescription}
                  onChangeText={setDiscountDescription}
                  placeholder="Discount configuration description"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.infoText}>
                  Regular passengers: No discount (0%)
                </Text>
                <Text style={styles.infoText}>
                  Current student discount:{' '}
                  {discountConfig?.discounts?.student || 0}%
                </Text>
                <Text style={styles.infoText}>
                  Current senior discount:{' '}
                  {discountConfig?.discounts?.senior || 0}%
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Enable Age-Based Student Discounts
                </Text>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    enableAgeBasedDiscounts && styles.toggleButtonActive,
                  ]}
                  onPress={() =>
                    setEnableAgeBasedDiscounts(!enableAgeBasedDiscounts)
                  }>
                  <Text
                    style={[
                      styles.toggleButtonText,
                      enableAgeBasedDiscounts && styles.toggleButtonTextActive,
                    ]}>
                    {enableAgeBasedDiscounts ? 'Enabled' : 'Disabled'}
                  </Text>
                </TouchableOpacity>
              </View>

              {enableAgeBasedDiscounts && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Student Child Max Age</Text>
                    <TextInput
                      style={styles.textInput}
                      value={studentChildMaxAge}
                      onChangeText={setStudentChildMaxAge}
                      keyboardType="numeric"
                      placeholder="Maximum age for child student discount"
                    />
                    <Text style={styles.helperText}>
                      Students aged {studentChildMaxAge} and below will receive
                      the child discount
                    </Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Student Child Discount (%)
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      value={studentChildDiscount}
                      onChangeText={setStudentChildDiscount}
                      keyboardType="numeric"
                      placeholder="Enter student child discount percentage"
                    />
                  </View>
                </>
              )}

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleUpdateDiscountConfig}>
                <Text style={styles.buttonText}>
                  Update Discount Configuration
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setIsDiscountModalVisible(false);
                  resetDiscountForm();
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
              // showsMyLocationButton={false} // deafult is true so the my location button is shown
            >
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

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Passenger Discounts</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => {
                resetDiscountForm();
                setIsDiscountModalVisible(true);
              }}>
              <Icon name="settings" size={20} color="#fff" />
              <Text style={styles.addButtonText}>Configure</Text>
            </TouchableOpacity>
          </View>

          {discountConfig && (
            <View style={styles.discountConfigDisplay}>
              <Text style={styles.configTitle}>Current Configuration:</Text>
              <Text style={styles.configItem}>
                Regular: {getDiscountValue('regular')}% discount
              </Text>
              <Text style={styles.configItem}>
                Student: {getDiscountValue('student')}% discount
              </Text>
              <Text style={styles.configItem}>
                Senior: {getDiscountValue('senior')}% discount
              </Text>
              {discountConfig.description && (
                <Text style={styles.configDescription}>
                  {discountConfig.description}
                </Text>
              )}
              <Text style={styles.configUpdated}>
                Last updated:{' '}
                {discountConfig.updatedAt
                  ? new Date(discountConfig.updatedAt).toLocaleDateString()
                  : 'N/A'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ZoneFareCalculator;
