import React, {useState, useCallback, useEffect} from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  Card,
  Title,
  Button,
  TextInput,
  Avatar,
  Text,
  Divider,
  List,
  IconButton,
  Portal,
  Modal,
  Dialog,
} from 'react-native-paper';
import {launchCamera, CameraOptions} from 'react-native-image-picker';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {TabsStyles} from '../styles/TabsStyles';
import {BACKEND_URL} from '@env';
import {GlobalStyles} from '../styles/GlobalStyles';
import {useProfile, isPassengerProfile} from '../context/ProfileContext';
import {useAuth} from '../context/AuthContext';
import {RootStackParamList} from '../navigation/types';
import api from '../../utils/api';
import LocationSearchModal from '../components/LocationSearchModal';
import {styles} from '../styles/BookRideStyles';

interface Location {
  type: string;
  coordinates: [number, number];
  address: string;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const PassengerProfileScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const {logout, userToken} = useAuth();
  const {profileData, loading, updateProfile, updatePassword, refreshProfile} =
    useProfile();

  const [editing, setEditing] = useState(false);
  const [editingAddresses, setEditingAddresses] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState('');
  const [newAddressValue, setNewAddressValue] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Type guard to ensure we're working with passenger profile
  const passengerProfile = isPassengerProfile(profileData) ? profileData : null;

  // Form state for editing profile
  const [formData, setFormData] = useState({
    firstName: profileData?.firstName || '',
    lastName: profileData?.lastName || '',
    middleInitial: profileData?.middleInitial || '',
    username: profileData?.username || '',
    email: profileData?.email || '',
    phone: profileData?.phone || '',
  });

  // Dialog states
  const [showChangePasswordDialog, setShowChangePasswordDialog] =
    useState<boolean>(false);
  const [passwordVisible, setPasswordVisible] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [modalVisible, setModalVisible] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectingFor, setSelectingFor] = useState('saveAddress');
  const [editAddressModalVisible, setEditAddressModalVisible] = useState(false);
  const [editAddressIndex, setEditAddressIndex] = useState<number>(-1);
  const [editAddressLabel, setEditAddressLabel] = useState('');
  const [editAddressValue, setEditAddressValue] = useState('');
  const [returningFromMapPicker, setReturningFromMapPicker] = useState(false);
  const [pendingLocationData, setPendingLocationData] =
    useState<Location | null>(null);

  // Helper function to get full name
  const getFullName = () => {
    if (!profileData) return '';
    const {firstName, lastName, middleInitial} = profileData;
    return `${firstName} ${
      middleInitial ? middleInitial + '. ' : ''
    }${lastName}`.trim();
  };

  // Helper function to get initials
  const getInitials = () => {
    if (!profileData) return '';
    const {firstName, lastName} = profileData;
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`;
  };

  // Helper function to format date
  const formatDate = (dateString: string | number | Date) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  type VerificationStatus =
    | 'pending'
    | 'under_review'
    | 'approved'
    | 'rejected'
    | string;

  // Helper function to get verification status display
  const getVerificationStatusDisplay = (status: VerificationStatus) => {
    const statusMap = {
      pending: {label: 'Pending', color: '#f39c12'},
      under_review: {label: 'Under Review', color: '#3498db'},
      approved: {label: 'Approved', color: '#27ae60'},
      rejected: {label: 'Rejected', color: '#e74c3c'},
    } as const;
    return status in statusMap
      ? statusMap[status as keyof typeof statusMap]
      : {label: 'Unknown', color: '#95a5a6'};
  };

  // Check if profile image upload is pending
  const isProfileImagePending = () => {
    return (
      profileData?.pendingProfileImage?.status === 'pending' ||
      profileData?.verificationStatus === 'under_review' ||
      profileData?.verificationStatus === 'pending'
    );
  };

  // Get pending image upload status message
  const getPendingImageStatusMessage = () => {
    if (profileData?.pendingProfileImage?.status === 'pending') {
      return 'Profile image upload is pending admin approval. You cannot upload another image until this is reviewed.';
    }
    if (profileData?.pendingProfileImage?.status === 'rejected') {
      const reason = profileData.pendingProfileImage.rejectionReason;
      return `Previous upload was rejected${
        reason ? ': ' + reason : ''
      }. You can upload a new profile image.`;
    }
    if (
      profileData?.verificationStatus === 'under_review' ||
      profileData?.verificationStatus === 'pending'
    ) {
      return 'You have a pending validation. Please wait for admin approval before uploading a new image.';
    }
    return '';
  };

  // Reset form data when toggling edit mode
  const toggleEdit = () => {
    if (editing) {
      // Reset form if canceling edit
      setFormData({
        firstName: profileData?.firstName || '',
        lastName: profileData?.lastName || '',
        middleInitial: profileData?.middleInitial || '',
        username: profileData?.username || '',
        email: profileData?.email || '',
        phone: profileData?.phone || '',
      });
      setCurrentPassword('');
      setNewPassword('');
    }
    setEditing(!editing);
  };

  const handleSave = async () => {
    try {
      await updateProfile(formData);
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const pickImage = async () => {
    // Check if there's already a pending validation
    if (isProfileImagePending()) {
      const message = getPendingImageStatusMessage();
      Alert.alert('Validation Pending', message, [{text: 'OK'}]);
      return;
    }

    try {
      setUploadingImage(true);

      // Using react-native-image-picker instead of expo-image-picker
      const options: CameraOptions = {
        mediaType: 'photo',
        quality: 1,
        saveToPhotos: false,
        includeBase64: false,
      };

      launchCamera(options, response => {
        if (response.didCancel) {
          console.log('User cancelled image picker');
          setUploadingImage(false);
          return;
        } else if (response.errorCode) {
          console.log('ImagePicker Error: ', response.errorMessage);
          Alert.alert('Error', response.errorMessage || 'Failed to pick image');
          setUploadingImage(false);
          return;
        }

        if (response.assets && response.assets.length > 0) {
          const asset = response.assets[0];
          const imageUri = asset.uri;

          if (!imageUri) {
            setUploadingImage(false);
            return;
          }

          // Create a FormData object to upload the image
          const formData = new FormData();

          // Get file name and type
          const uriParts = imageUri.split('.');
          const fileType = uriParts[uriParts.length - 1];

          // Add the image to form data
          formData.append('profileImage', {
            uri: imageUri,
            name: `profile-${Date.now()}.${fileType}`,
            type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}`,
          } as unknown as Blob);

          // Upload the image
          fetch(`${BACKEND_URL}/api/users/upload-image/${profileData?._id}`, {
            method: 'POST',
            body: formData,
            headers: {
              Authorization: `Bearer ${userToken}`,
              'Content-Type': 'multipart/form-data',
            },
          })
            .then(uploadResponse => {
              if (!uploadResponse.ok) {
                return uploadResponse.json().then(errorData => {
                  throw new Error(errorData.error || 'Failed to upload image');
                });
              }
              return uploadResponse.json();
            })
            .then(uploadData => {
              // Force refresh of profile to get the updated verification status
              refreshProfile();
              Alert.alert(
                'Image Uploaded',
                'Your profile image has been uploaded and is pending admin approval. It will be visible once approved.',
                [{text: 'OK'}],
              );
              setUploadingImage(false);
            })
            .catch(uploadError => {
              console.error('Upload request failed:', uploadError);
              Alert.alert('Error', 'Failed to upload image');
              setUploadingImage(false);
            });
        } else {
          setUploadingImage(false);
        }
      });
    } catch (error) {
      console.error('Error picking or uploading image:', error);
      Alert.alert('Error', 'Failed to update profile image');
      setUploadingImage(false);
    }
  };

  const handleLocationSelected = async (location: Location) => {
    if (selectingFor === 'editAddress') {
      setEditAddressValue(location.address);
    } else {
      setNewAddressValue(location.address);
    }
    setShowLocationModal(false);
    setPendingLocationData(location);
    setReturningFromMapPicker(true);
  };

  const addNewAddress = async () => {
    if (!newAddressLabel || !newAddressValue) {
      Alert.alert('Error', 'Both label and address value are required');
      return;
    }

    try {
      // Use our backend API to geocode the address instead of calling Google directly
      const geocodeResponse = await api.post('/api/google/geocode', {
        address: newAddressValue,
      });

      if (!geocodeResponse.data || !geocodeResponse.data.coordinates) {
        console.error('Geocoding response:', geocodeResponse.data);
        Alert.alert(
          'Error',
          'Unable to geocode the address. Please try again or enter a valid address.',
        );
        return;
      }

      const coordinates = geocodeResponse.data.coordinates;

      // Make sure we follow the schema requirements
      const newAddress = {
        label: newAddressLabel,
        address: newAddressValue,
        location: {
          type: 'Point',
          coordinates: [coordinates.lng, coordinates.lat] as [number, number],
          address: newAddressValue,
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
      setModalVisible(false);

      Alert.alert('Success', 'Address added successfully!');
    } catch (error: unknown) {
      console.error('Geocoding failed:', error);

      if (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as any).response === 'object'
      ) {
        const err = error as any;
        console.error('Error response:', err.response.data);
        console.error('Status code:', err.response.status);
      }

      Alert.alert(
        'Error',
        'Failed to geocode address. Please check your network connection and try again.',
      );
    }
  };

  const handleMapPickerNavigation = () => {
    // Close both modals
    setShowLocationModal(false);
    setModalVisible(false);
    setEditAddressModalVisible(false);

    // Store that we're going to map picker
    setReturningFromMapPicker(true);

    // Navigate to map picker
    navigation.navigate('MapLocationPicker', {
      onLocationSelected: handleLocationSelected,
    });
  };

  // Add this useEffect to handle reopening modal when returning from map picker
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (returningFromMapPicker && pendingLocationData) {
        // Small delay to ensure navigation is complete
        setTimeout(() => {
          if (selectingFor === 'editAddress') {
            setEditAddressModalVisible(true);
          } else {
            setModalVisible(true);
          }
          setReturningFromMapPicker(false);
          setPendingLocationData(null);
        }, 100);
      }
    });
    return unsubscribe;
  }, [navigation, returningFromMapPicker, pendingLocationData, selectingFor]);

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

  const openEditAddressModal = (index: number) => {
    if (!passengerProfile?.savedAddresses) return;
    const address = passengerProfile.savedAddresses[index];
    setEditAddressIndex(index);
    setEditAddressLabel(address.label);
    setEditAddressValue(address.address);
    setEditAddressModalVisible(true);
  };

  const handleUpdateAddress = async () => {
    if (
      !editAddressLabel ||
      !editAddressValue ||
      !passengerProfile?.savedAddresses
    ) {
      Alert.alert('Error', 'Both label and address value are required');
      return;
    }

    try {
      // Get existing location or create a new one with proper type
      let location = passengerProfile.savedAddresses[editAddressIndex]
        ?.location || {
        type: 'Point',
        coordinates: [0, 0],
        address: editAddressValue,
      };

      // Check if address changed to avoid unnecessary geocoding
      const currentAddress =
        passengerProfile.savedAddresses[editAddressIndex].address;

      if (editAddressValue !== currentAddress) {
        // Use our backend API to geocode the address
        const geocodeResponse = await api.post('/api/google/geocode', {
          address: editAddressValue,
        });

        if (!geocodeResponse.data || !geocodeResponse.data.coordinates) {
          console.error('Geocoding response:', geocodeResponse.data);
          Alert.alert(
            'Error',
            'Unable to geocode the address. Please try again or enter a valid address.',
          );
          return;
        }

        const coordinates = geocodeResponse.data.coordinates;

        location = {
          type: 'Point',
          coordinates: [coordinates.lng, coordinates.lat],
          address: editAddressValue,
        };
      } else {
        // Ensure location has address even if not changed
        location = {
          ...location,
          address: editAddressValue,
        };
      }

      // Follow the schema structure
      const updatedAddress = {
        _id: passengerProfile.savedAddresses[editAddressIndex]._id,
        label: editAddressLabel,
        address: editAddressValue,
        location: location,
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

  const handleChangePassword = async () => {
    if (newPassword != confirmPassword) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }

    if (!currentPassword || !newPassword) {
      Alert.alert('Error', 'Please fill in all password fields.');
      return;
    }

    try {
      await updatePassword(currentPassword, newPassword);

      setShowChangePasswordDialog(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password updated successfully!');
    } catch (error) {
      console.error('Error updating password:', error);
      Alert.alert('Error', 'Incorrect current password');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigation.navigate('Login');
    } catch (error) {
      console.error('Failed to clear AsyncStorage:', error);
      Alert.alert('Error', 'Failed to log out.');
    }
  };

  if (loading) {
    return (
      <View style={GlobalStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text>Loading profile...</Text>
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
    <>
      <View style={GlobalStyles.header}>
        <Text style={GlobalStyles.headerTitle}>Profile</Text>
        <IconButton
          icon={editing ? 'close' : 'pencil'}
          iconColor="white"
          size={24}
          style={{marginTop: 0}}
          onPress={toggleEdit}
        />
      </View>

      <ScrollView style={GlobalStyles.container}>
        <Card style={TabsStyles.profileCard}>
          <Card.Content style={TabsStyles.profileContent}>
            <TouchableOpacity
              style={TabsStyles.avatarContainer}
              onPress={editing ? pickImage : undefined}
              disabled={uploadingImage}>
              {/* Show current active profile image, not pending one */}
              {profileData.profileImage ? (
                <Avatar.Image
                  size={100}
                  source={{uri: profileData.profileImage}}
                  style={TabsStyles.avatar}
                />
              ) : (
                <Avatar.Text
                  size={100}
                  label={getInitials()}
                  style={TabsStyles.avatar}
                />
              )}
              {editing && (
                <View style={TabsStyles.editAvatarOverlay}>
                  {uploadingImage ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text style={TabsStyles.editAvatarText}>
                      {isProfileImagePending() ? 'Pending' : 'Edit'}
                    </Text>
                  )}
                </View>
              )}
            </TouchableOpacity>

            {/* Show pending image status if applicable */}
            {/* {profileData.pendingProfileImage?.status === 'pending' && (
              <View style={{alignItems: 'center', marginTop: 8}}>
                <Chip
                  mode="flat"
                  style={{backgroundColor: '#f39c12'}}
                  textStyle={{color: 'white', fontSize: 12}}>
                  Profile Image Pending Approval
                </Chip>
              </View>
            )} */}

            {/* Verification Status */}
            {/* {profileData.verificationStatus && (
              <View style={{alignItems: 'center', marginTop: 8}}>
                <Chip
                  mode="flat"
                  style={{
                    backgroundColor: getVerificationStatusDisplay(
                      profileData.verificationStatus,
                    ).color,
                  }}
                  textStyle={{color: 'white', fontSize: 12}}>
                  {
                    getVerificationStatusDisplay(profileData.verificationStatus)
                      .label
                  }
                </Chip>
              </View>
            )} */}

            <View style={TabsStyles.profileInfo}>
              {editing ? (
                <>
                  <TextInput
                    label="First Name"
                    value={formData.firstName}
                    onChangeText={text =>
                      setFormData({...formData, firstName: text})
                    }
                    style={TabsStyles.input}
                    mode="outlined"
                  />
                  <TextInput
                    label="Last Name"
                    value={formData.lastName}
                    onChangeText={text =>
                      setFormData({...formData, lastName: text})
                    }
                    style={TabsStyles.input}
                    mode="outlined"
                  />
                  <TextInput
                    label="Middle Initial"
                    value={formData.middleInitial}
                    onChangeText={text =>
                      setFormData({...formData, middleInitial: text})
                    }
                    style={TabsStyles.input}
                    mode="outlined"
                    maxLength={1}
                  />
                </>
              ) : (
                <Text style={TabsStyles.nameText}>{getFullName()}</Text>
              )}

              <Button
                mode="contained"
                onPress={editing ? handleSave : () => {}}
                style={TabsStyles.saveButton}
                disabled={!editing}>
                {editing ? 'Save Changes' : 'Full Name'}
              </Button>
            </View>
          </Card.Content>
        </Card>

        <Card style={TabsStyles.sectionCard}>
          <Card.Content>
            <Title>Account Information</Title>
            <Divider style={TabsStyles.divider} />

            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Username</Text>
              {editing ? (
                <TextInput
                  value={formData.username}
                  onChangeText={text =>
                    setFormData({...formData, username: text})
                  }
                  style={TabsStyles.input}
                  mode="outlined"
                />
              ) : (
                <Text style={TabsStyles.infoValue}>{profileData.username}</Text>
              )}
            </View>

            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Email</Text>
              {editing ? (
                <TextInput
                  value={formData.email}
                  onChangeText={text => setFormData({...formData, email: text})}
                  style={TabsStyles.input}
                  mode="outlined"
                  keyboardType="email-address"
                />
              ) : (
                <Text style={TabsStyles.infoValue}>{profileData.email}</Text>
              )}
            </View>

            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Phone</Text>
              {editing ? (
                <TextInput
                  value={formData.phone}
                  onChangeText={text => setFormData({...formData, phone: text})}
                  style={TabsStyles.input}
                  mode="outlined"
                  keyboardType="phone-pad"
                />
              ) : (
                <Text style={TabsStyles.infoValue}>{profileData.phone}</Text>
              )}
            </View>
          </Card.Content>
        </Card>

        {!editing && (
          <>
            <Card style={TabsStyles.sectionCard}>
              <Card.Content>
                <Title>Passenger Overview</Title>
                <Divider style={TabsStyles.divider} />

                <View style={TabsStyles.infoRow}>
                  <Text style={TabsStyles.infoLabel}>Rating</Text>
                  <Text style={TabsStyles.infoValue}>
                    {profileData.rating.toFixed(1)} ⭐ (
                    {profileData.totalRatings} ratings)
                  </Text>
                </View>

                <View style={TabsStyles.infoRow}>
                  <Text style={TabsStyles.infoLabel}>Total Rides</Text>
                  <Text style={TabsStyles.infoValue}>
                    {profileData.totalRides}
                  </Text>
                </View>
              </Card.Content>
            </Card>

            <Card style={TabsStyles.sectionCard}>
              <Card.Content>
                <Title>Personal Information</Title>
                <Divider style={TabsStyles.divider} />

                {/* Read-only fields - Birthdate and Age */}
                <View style={TabsStyles.infoRow}>
                  <Text style={TabsStyles.infoLabel}>Birthdate</Text>
                  <Text style={[TabsStyles.infoValue, {color: '#666'}]}>
                    {formatDate(profileData.birthdate)}
                  </Text>
                </View>

                <View style={TabsStyles.infoRow}>
                  <Text style={TabsStyles.infoLabel}>Age</Text>
                  <Text style={[TabsStyles.infoValue, {color: '#666'}]}>
                    {profileData.age || 'Not set'}
                  </Text>
                </View>

                {/* Passenger Category - Read-only */}
                <View style={TabsStyles.infoRow}>
                  <Text style={TabsStyles.infoLabel}>Category</Text>
                  <Text style={[TabsStyles.infoValue, {color: '#666'}]}>
                    {passengerProfile.passengerCategory
                      ?.charAt(0)
                      .toUpperCase() +
                      passengerProfile.passengerCategory?.slice(1) || 'Not set'}
                  </Text>
                </View>
              </Card.Content>
            </Card>

            {/* ID Document Section */}
            {profileData.idDocument && (
              <Card style={TabsStyles.sectionCard}>
                <Card.Content>
                  <Title>ID Document</Title>
                  <Divider style={TabsStyles.divider} />

                  <View style={TabsStyles.infoRow}>
                    <Text style={TabsStyles.infoLabel}>Document Type</Text>
                    <Text style={[TabsStyles.infoValue, {color: '#666'}]}>
                      {profileData.idDocument.type
                        ?.replace('_', ' ')
                        .replace(/\b\w/g, l => l.toUpperCase()) ||
                        'Not specified'}
                    </Text>
                  </View>

                  {profileData.idDocument.uploadedAt && (
                    <View style={TabsStyles.infoRow}>
                      <Text style={TabsStyles.infoLabel}>Uploaded</Text>
                      <Text style={[TabsStyles.infoValue, {color: '#666'}]}>
                        {formatDate(profileData.idDocument.uploadedAt)}
                      </Text>
                    </View>
                  )}

                  {profileData.idDocument.verifiedAt && (
                    <View style={TabsStyles.infoRow}>
                      <Text style={TabsStyles.infoLabel}>Verified On</Text>
                      <Text style={[TabsStyles.infoValue, {color: '#666'}]}>
                        {formatDate(profileData.idDocument.verifiedAt)}
                      </Text>
                    </View>
                  )}

                  {/* Show ID image if available - read-only */}
                  {profileData.idDocument.imageUrl && (
                    <View style={TabsStyles.infoRow}>
                      <Text style={TabsStyles.infoLabel}>Document Image</Text>
                      <Text style={[TabsStyles.infoValue, {color: '#666'}]}>
                        Uploaded (View only)
                      </Text>
                    </View>
                  )}
                </Card.Content>
              </Card>
            )}
            <Card style={TabsStyles.sectionCard}>
              <Card.Content>
                <View style={TabsStyles.titleRow}>
                  <Title>Saved Addresses</Title>
                  <TouchableOpacity
                    onPress={() => setEditingAddresses(!editingAddresses)}>
                    <Text style={TabsStyles.editButtonText}>
                      {editingAddresses ? 'Close' : 'Edit'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <Divider style={TabsStyles.divider} />

                {passengerProfile.savedAddresses?.length === 0 ? (
                  <Text style={TabsStyles.noAddressText}>
                    No saved addresses
                  </Text>
                ) : (
                  passengerProfile.savedAddresses?.map((address, index) => (
                    <List.Item
                      key={index}
                      title={address.label}
                      description={address.address}
                      left={props => (
                        <List.Icon
                          {...props}
                          icon={
                            address.label.toLowerCase() === 'home'
                              ? 'home'
                              : address.label.toLowerCase() === 'work'
                              ? 'briefcase'
                              : 'map-marker'
                          }
                        />
                      )}
                      right={
                        editingAddresses
                          ? props => (
                              <View style={{flexDirection: 'row'}}>
                                <IconButton
                                  {...props}
                                  icon="pencil"
                                  onPress={() => openEditAddressModal(index)}
                                  style={{marginRight: -10}}
                                />
                                <IconButton
                                  {...props}
                                  icon="delete"
                                  onPress={() => {
                                    Alert.alert(
                                      'Delete',
                                      'Are you sure to remove this address?',
                                      [
                                        {text: 'Cancel', style: 'cancel'},
                                        {
                                          text: 'Delete',
                                          onPress: () => removeAddress(index),
                                        },
                                      ],
                                    );
                                  }}
                                />
                              </View>
                            )
                          : undefined
                      }
                    />
                  ))
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
                    <Button
                      mode="contained"
                      onPress={() => setEditingAddresses(false)}
                      style={TabsStyles.saveAddressesButton}>
                      Done
                    </Button>
                  </View>
                )}
              </Card.Content>
            </Card>

            <Card style={TabsStyles.sectionCard}>
              <Card.Content>
                <Title>Account Security</Title>
                <Divider style={TabsStyles.divider} />
                <Button
                  mode="outlined"
                  icon="lock"
                  onPress={() => setShowChangePasswordDialog(true)}
                  style={{marginTop: 12}}>
                  Change Password
                </Button>
              </Card.Content>
            </Card>

            <View style={TabsStyles.buttonContainer}>
              <Button
                mode="contained"
                icon="logout"
                onPress={() => {
                  Alert.alert('Logout', 'Are you sure you want to logout?', [
                    {text: 'Cancel', style: 'cancel'},
                    {
                      text: 'Logout',
                      onPress: handleLogout,
                    },
                  ]);
                }}
                style={TabsStyles.logoutButton}>
                Logout
              </Button>
            </View>
          </>
        )}

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
                  newAddressValue && {color: '#3498db'},
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
                    borderColor: newAddressValue ? '#3498db' : '#ccc',
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
                  iconColor="#e74c3c"
                  style={{marginRight: 10}}
                />
                <Text
                  style={{
                    flex: 1,
                    flexWrap: 'wrap',
                    color: newAddressValue ? '#000' : '#888',
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
                  editAddressValue && {color: '#3498db'},
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
                    borderColor: editAddressValue ? '#3498db' : '#ccc',
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
                  iconColor="#e74c3c"
                  style={{marginRight: 10}}
                />
                <Text
                  style={{
                    flex: 1,
                    flexWrap: 'wrap',
                    color: editAddressValue ? '#000' : '#888',
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

        {/* Change Password Dialog */}
        <Portal>
          <Dialog
            visible={showChangePasswordDialog}
            onDismiss={() => setShowChangePasswordDialog(false)}>
            <Dialog.Title>Change Password</Dialog.Title>
            <Dialog.Content>
              <TextInput
                label="Current Password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                mode="outlined"
                secureTextEntry={!passwordVisible}
                style={TabsStyles.input}
                right={
                  <TextInput.Icon
                    icon={passwordVisible ? 'eye-off' : 'eye'}
                    onPress={() => setPasswordVisible(!passwordVisible)}
                  />
                }
              />
              <TextInput
                label="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                mode="outlined"
                secureTextEntry={!passwordVisible}
                style={TabsStyles.input}
                right={
                  <TextInput.Icon
                    icon={passwordVisible ? 'eye-off' : 'eye'}
                    onPress={() => setPasswordVisible(!passwordVisible)}
                  />
                }
              />
              <TextInput
                label="Confirm New Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                mode="outlined"
                secureTextEntry={!passwordVisible}
                style={TabsStyles.input}
                right={
                  <TextInput.Icon
                    icon={passwordVisible ? 'eye-off' : 'eye'}
                    onPress={() => setPasswordVisible(!passwordVisible)}
                  />
                }
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setShowChangePasswordDialog(false)}>
                Cancel
              </Button>
              <Button onPress={handleChangePassword}>Change Password</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </ScrollView>

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
    </>
  );
};

export default PassengerProfileScreen;
