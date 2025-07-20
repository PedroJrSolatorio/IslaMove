import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import {
  Card,
  Title,
  Text,
  Button,
  IconButton,
  TextInput,
  Modal,
  Portal,
} from 'react-native-paper';
import {TabsStyles} from '../../styles/TabsStyles';
import {GlobalStyles} from '../../styles/GlobalStyles';
import {styles} from '../../styles/BookRideStyles';
import {useProfile, isPassengerProfile} from '../../context/ProfileContext';
import {Colors} from '../../styles/Colors';
import LocationSearchModal from '../../components/LocationSearchModal';
import api from '../../../utils/api';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../navigation/types';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

interface Location {
  type: string;
  coordinates: [number, number];
  address: string;
  mainText?: string;
  secondaryText?: string;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const SavedAddressesScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const {profileData, loading, refreshProfile} = useProfile();
  const insets = useSafeAreaInsets();

  // Type guard to ensure we're working with passenger profile
  const passengerProfile = isPassengerProfile(profileData) ? profileData : null;

  const [editingAddresses, setEditingAddresses] = useState(false);

  // State for Add New Address Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState('');
  const [newAddressValue, setNewAddressValue] = useState(''); // This will store the address string from location picker

  // State for Edit Address Modal
  const [editAddressModalVisible, setEditAddressModalVisible] = useState(false);
  const [editAddressLabel, setEditAddressLabel] = useState('');
  const [editAddressValue, setEditAddressValue] = useState('');
  const [returningFromMapPicker, setReturningFromMapPicker] = useState(false);
  const [editAddressIndex, setEditAddressIndex] = useState<number>(-1);

  // State for Location Search Modal
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectingFor, setSelectingFor] = useState<
    'saveAddress' | 'editAddress' | 'destination'
  >('destination');
  const [newAddressLocation, setNewAddressLocation] = useState<Location | null>(
    null,
  );
  const [editAddressLocation, setEditAddressLocation] =
    useState<Location | null>(null);
  const [expandedAddresses, setExpandedAddresses] = useState<Set<number>>(
    new Set(),
  );

  // Effect to clear form when modal is dismissed
  useEffect(() => {
    if (!modalVisible) {
      setNewAddressLabel('');
      setNewAddressValue('');
    }
  }, [modalVisible]);

  useEffect(() => {
    if (!editAddressModalVisible) {
      setEditAddressLabel('');
      setEditAddressValue('');
      setEditAddressIndex(-1);
    }
  }, [editAddressModalVisible]);

  const toggleAddressExpansion = (index: number) => {
    const newExpanded = new Set(expandedAddresses);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedAddresses(newExpanded);
  };

  const openEditAddressModal = (index: number) => {
    if (!passengerProfile?.savedAddresses) return;
    const address = passengerProfile.savedAddresses[index];
    setEditAddressIndex(index);
    setEditAddressLabel(address.label);
    setEditAddressValue(address.address);
    setEditAddressLocation(address.location || null);
    setEditAddressModalVisible(true);
  };

  const addNewAddress = async () => {
    if (!newAddressLabel || !newAddressValue || !newAddressLocation) {
      Alert.alert('Error', 'Both label and address value are required');
      return;
    }

    try {
      // Use the stored location object instead of geocoding again
      const newAddress = {
        label: newAddressLabel,
        address: newAddressValue, // This will be the formatted display address
        location: {
          type: 'Point',
          coordinates: newAddressLocation.coordinates,
          address: newAddressLocation.address, // This is the full geocoded address
          // Include structured data if available
          ...(newAddressLocation.mainText && {
            mainText: newAddressLocation.mainText,
          }),
          ...(newAddressLocation.secondaryText && {
            secondaryText: newAddressLocation.secondaryText,
          }),
        },
      };

      // Use the addNewAddress API endpoint
      const response = await api.post(
        `/api/users/addresses/${profileData?._id}`,
        {address: newAddress},
      );

      if (response.status !== 200) {
        throw new Error(response.data.error || 'Failed to add address');
      }

      // Refresh profile data to get updated addresses
      await refreshProfile();

      // Reset form and close modal
      setNewAddressLabel('');
      setNewAddressValue('');
      setNewAddressLocation(null);
      setModalVisible(false);

      Alert.alert('Success', 'Address added successfully!');
    } catch (error) {
      console.error('Add address failed:', error);
      Alert.alert('Error', 'Failed to add address');
    }
  };

  const handleUpdateAddress = async () => {
    if (
      !editAddressLabel ||
      !editAddressValue ||
      !editAddressLocation ||
      !passengerProfile?.savedAddresses
    ) {
      Alert.alert('Error', 'Both label and address value are required');
      return;
    }

    try {
      // Use the stored location object
      const updatedAddress = {
        _id: passengerProfile.savedAddresses[editAddressIndex]._id,
        label: editAddressLabel,
        address: editAddressValue, // This will be the formatted display address
        location: {
          type: 'Point',
          coordinates: editAddressLocation.coordinates,
          address: editAddressLocation.address, // This is the full geocoded address
          // Include structured data if available
          ...(editAddressLocation.mainText && {
            mainText: editAddressLocation.mainText,
          }),
          ...(editAddressLocation.secondaryText && {
            secondaryText: editAddressLocation.secondaryText,
          }),
        },
      };

      const updatedAddresses = [...passengerProfile.savedAddresses];
      updatedAddresses[editAddressIndex] = updatedAddress;

      // Save to database
      const response = await api.put(
        `/api/users/addresses/${profileData?._id}`,
        {savedAddresses: updatedAddresses},
      );

      if (response.status !== 200) {
        throw new Error(response.data.error || 'Failed to update address');
      }

      // Refresh profile to get updated data
      await refreshProfile();

      // Reset form and close modal
      setEditAddressIndex(-1);
      setEditAddressLabel('');
      setEditAddressValue('');
      setEditAddressLocation(null);
      setEditAddressModalVisible(false);

      Alert.alert('Success', 'Address updated successfully!');
    } catch (error) {
      console.error('Update address failed:', error);
      Alert.alert('Error', 'Failed to update the address.');
    }
  };

  const removeAddress = useCallback(
    async (index: number) => {
      try {
        const response = await api.delete(
          `/api/users/addresses/${profileData?._id}/${index}`,
        );

        if (response.status !== 200) {
          throw new Error(response.data.error || 'Failed to remove address');
        }

        // Refresh profile to get updated addresses
        await refreshProfile();

        Alert.alert('Success', 'Address removed successfully!');
      } catch (error) {
        console.error('Remove address failed:', error);
        Alert.alert('Error', 'Failed to remove the address.');
      }
    },
    [profileData],
  );

  const handleLocationSelected = (location: Location) => {
    // Helper function to format display address consistently
    const formatDisplayAddress = (location: Location) => {
      if (location.mainText && location.secondaryText) {
        return `${location.mainText}, ${location.secondaryText}`;
      } else if (location.mainText) {
        return location.mainText;
      }
      return location.address;
    };
    if (selectingFor === 'saveAddress') {
      const displayAddress = formatDisplayAddress(location);
      setNewAddressValue(displayAddress);
      setNewAddressLocation(location); // Store the full location object
      setShowLocationModal(false);
      setReturningFromMapPicker(true);
    } else if (selectingFor === 'editAddress') {
      const displayAddress = formatDisplayAddress(location);
      setEditAddressValue(displayAddress);
      setEditAddressLocation(location); // Store the full location object
      setShowLocationModal(false);
      setReturningFromMapPicker(true);
    }
  };

  const handleMapPickerNavigation = () => {
    // Close both modals
    setShowLocationModal(false);
    setModalVisible(false);
    setEditAddressModalVisible(false);

    // Store that we're going to map picker
    setReturningFromMapPicker(true);

    // Create a unique callback ID
    const callbackId = `location_callback_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Store the callback globally
    (global as any).locationCallbacks = (global as any).locationCallbacks || {};
    (global as any).locationCallbacks[callbackId] = (location: Location) => {
      handleLocationSelected(location);
      // Clean up the callback after use
      delete (global as any).locationCallbacks[callbackId];
    };

    // Navigate to map picker with callback ID instead of function
    navigation.navigate('MapLocationPicker', {
      callbackId: callbackId,
    });
  };

  // Add this useEffect to handle reopening modal when returning from map picker
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (returningFromMapPicker) {
        // Small delay to ensure navigation is complete
        setTimeout(() => {
          if (selectingFor === 'editAddress') {
            setEditAddressModalVisible(true);
          } else {
            setModalVisible(true);
          }
          setReturningFromMapPicker(false);
        }, 100);
      }
    });
    return unsubscribe;
  }, [navigation, returningFromMapPicker, selectingFor]);

  // Add useEffect to close modal when navigating away
  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      // Only reset flags when actually leaving the screen
      if (!returningFromMapPicker) {
        setModalVisible(false);
        setEditAddressModalVisible(false);
        setShowLocationModal(false);
      }
    });

    return unsubscribe;
  }, [navigation, returningFromMapPicker]);

  if (loading) {
    return (
      <View style={GlobalStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text>Loading saved addresses...</Text>
      </View>
    );
  }

  if (!profileData || !passengerProfile) {
    return (
      <View style={GlobalStyles.loadingContainer}>
        <Text>Profile not found or invalid user type</Text>
      </View>
    );
  }

  return (
    <View style={[GlobalStyles.container, {backgroundColor: '#F0F2F5'}]}>
      {/* Outer View to handle full background */}
      <StatusBar
        barStyle="dark-content" // Adjust based on your header's background color
        backgroundColor="transparent"
        translucent={true}
      />
      <View
        style={{
          height: 75 + insets.top,
          backgroundColor: '#f8f8f8',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: insets.top,
          position: 'relative',
        }}>
        <IconButton
          icon="arrow-left"
          iconColor="#000"
          size={24}
          onPress={() => navigation.goBack()}
        />
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: insets.top,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <Text style={{fontSize: 20, fontWeight: 'bold'}}>
            Saved Addresses
          </Text>
        </View>
        <IconButton
          icon={editingAddresses ? 'close' : 'pencil'}
          iconColor="#000"
          size={24}
          onPress={() => setEditingAddresses(!editingAddresses)}
        />
      </View>
      <ScrollView style={GlobalStyles.container}>
        <Card style={[TabsStyles.sectionCard, {marginTop: 16}]}>
          <Card.Content>
            {passengerProfile.savedAddresses &&
            passengerProfile.savedAddresses.length > 0 ? (
              passengerProfile.savedAddresses.map((address, index) => {
                const isExpanded = expandedAddresses.has(index);
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => toggleAddressExpansion(index)}
                    activeOpacity={0.7}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        paddingVertical: 12,
                        borderBottomWidth:
                          index < passengerProfile.savedAddresses.length - 1
                            ? 1
                            : 0,
                        borderBottomColor: '#e0e0e0',
                      }}>
                      {/* Icon */}
                      <IconButton
                        icon={
                          address.label.toLowerCase() === 'home'
                            ? 'home'
                            : address.label.toLowerCase() === 'work'
                            ? 'briefcase'
                            : 'map-marker'
                        }
                        iconColor={Colors.primary}
                        size={24}
                        style={{marginLeft: 0, marginTop: -8}}
                      />

                      {/* Content */}
                      <View style={{flex: 1, marginLeft: 8}}>
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: '600',
                            color: '#000000',
                            marginBottom: 4,
                          }}>
                          {address.label}
                        </Text>
                        <Text
                          style={{
                            fontSize: 14,
                            color: Colors.darkGray,
                            lineHeight: 20,
                          }}
                          numberOfLines={isExpanded ? undefined : 1}>
                          {address.address}
                        </Text>
                      </View>

                      {/* Action buttons and expand icon */}
                      <View
                        style={{flexDirection: 'row', alignItems: 'center'}}>
                        {editingAddresses && (
                          <View style={{flexDirection: 'row'}}>
                            <IconButton
                              icon="pencil"
                              onPress={e => {
                                e.stopPropagation(); // Prevent card expansion
                                openEditAddressModal(index);
                              }}
                              size={20}
                            />
                            <IconButton
                              icon="delete"
                              onPress={e => {
                                e.stopPropagation(); // Prevent card expansion
                                Alert.alert(
                                  'Delete',
                                  'Are you sure you want to remove this address?',
                                  [
                                    {text: 'Cancel', style: 'cancel'},
                                    {
                                      text: 'Delete',
                                      onPress: () => removeAddress(index),
                                    },
                                  ],
                                );
                              }}
                              size={20}
                            />
                          </View>
                        )}
                        <IconButton
                          icon={isExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          iconColor={Colors.gray}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={TabsStyles.noAddressesText}>
                No saved addresses yet.
              </Text>
            )}

            {editingAddresses && (
              <View style={TabsStyles.addressButtonsContainer}>
                <Button
                  mode="outlined"
                  icon="plus"
                  onPress={() => setModalVisible(true)}
                  style={TabsStyles.addAddressButton}>
                  Add New Address
                </Button>
              </View>
            )}
          </Card.Content>
        </Card>
        <View style={{height: 50}} />

        {/* Add New Address Modal */}
        <Portal>
          <Modal
            visible={modalVisible}
            onDismiss={() => setModalVisible(false)}
            contentContainerStyle={TabsStyles.modalContainer}>
            <Title style={TabsStyles.modalTitle}>Add New Address</Title>
            <TextInput
              label="Label (e.g. Home, Work)"
              value={newAddressLabel}
              onChangeText={setNewAddressLabel}
              style={TabsStyles.modalInput}
              mode="outlined"
            />
            <View style={{marginBottom: 20}}>
              <Text
                style={[
                  styles.floatingLabel,
                  {
                    position: 'absolute',
                    top: -10,
                    left: 12,
                    backgroundColor: '#fff',
                    paddingHorizontal: 4,
                  },
                  newAddressValue && {color: Colors.primary},
                ]}>
                Set Address
              </Text>

              <TouchableOpacity
                onPress={() => {
                  setSelectingFor('saveAddress');
                  setShowLocationModal(true);
                }}
                style={[
                  {
                    borderWidth: newAddressValue ? 2 : 1,
                    borderColor: newAddressValue
                      ? Colors.primary
                      : Colors.border,
                    borderRadius: 4,
                    padding: 4,
                    flexDirection: 'row',
                    alignItems: 'center',
                    minHeight: 56,
                    backgroundColor: '#fff',
                  },
                ]}>
                <IconButton
                  icon="flag-checkered"
                  size={24}
                  iconColor={Colors.danger}
                  style={{marginRight: 10}}
                />
                <Text
                  style={{
                    flex: 1,
                    flexWrap: 'wrap',
                    color: newAddressValue ? Colors.text : Colors.gray,
                  }}>
                  {newAddressValue ? newAddressValue : 'Search address'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={TabsStyles.modalButtons}>
              <Button
                mode="outlined"
                onPress={() => setModalVisible(false)}
                style={TabsStyles.modalButton}>
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={addNewAddress}
                style={TabsStyles.modalButton}>
                Add
              </Button>
            </View>
          </Modal>
        </Portal>

        {/* Edit Address Modal */}
        <Portal>
          <Modal
            visible={editAddressModalVisible}
            onDismiss={() => setEditAddressModalVisible(false)}
            contentContainerStyle={TabsStyles.modalContainer}>
            <Title style={TabsStyles.modalTitle}>Edit Address</Title>
            <TextInput
              label="Label (e.g. Home, Work)"
              value={editAddressLabel}
              onChangeText={setEditAddressLabel}
              style={TabsStyles.modalInput}
              mode="outlined"
            />
            <View style={{marginBottom: 20}}>
              <Text
                style={[
                  styles.floatingLabel,
                  {
                    position: 'absolute',
                    top: -10,
                    left: 12,
                    backgroundColor: '#fff',
                    paddingHorizontal: 4,
                  },
                  editAddressValue && {color: Colors.primary},
                ]}>
                Set Address
              </Text>

              <TouchableOpacity
                onPress={() => {
                  setSelectingFor('editAddress');
                  setShowLocationModal(true);
                }}
                style={[
                  {
                    borderWidth: editAddressValue ? 2 : 1,
                    borderColor: editAddressValue
                      ? Colors.primary
                      : Colors.border,
                    borderRadius: 4,
                    padding: 4,
                    flexDirection: 'row',
                    alignItems: 'center',
                    minHeight: 56,
                    backgroundColor: '#fff',
                  },
                ]}>
                <IconButton
                  icon="flag-checkered"
                  size={24}
                  iconColor={Colors.danger}
                  style={{marginRight: 10}}
                />
                <Text
                  style={{
                    flex: 1,
                    flexWrap: 'wrap',
                    color: editAddressValue ? Colors.text : Colors.gray,
                  }}>
                  {editAddressValue ? editAddressValue : 'Search address'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={TabsStyles.modalButtons}>
              <Button
                mode="outlined"
                onPress={() => setEditAddressModalVisible(false)}
                style={TabsStyles.modalButton}>
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleUpdateAddress}
                style={TabsStyles.modalButton}>
                Update
              </Button>
            </View>
          </Modal>
        </Portal>

        {/* Location Search Modal */}
        <LocationSearchModal
          visible={showLocationModal}
          onClose={() => setShowLocationModal(false)}
          onLocationSelected={handleLocationSelected}
          onMapPickerRequest={handleMapPickerNavigation}
          searching={
            selectingFor === 'saveAddress'
              ? 'saveAddress'
              : selectingFor === 'editAddress'
              ? 'saveAddress'
              : 'destination'
          }
          savedAddresses={
            (passengerProfile?.savedAddresses?.filter(
              addr => addr._id,
            ) as any[]) || []
          }
        />
        <View style={{height: insets.bottom}} />
      </ScrollView>
    </View>
  );
};

export default SavedAddressesScreen;
