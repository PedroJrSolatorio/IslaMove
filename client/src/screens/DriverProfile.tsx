import React, {useState, useCallback} from 'react';
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
  Chip,
} from 'react-native-paper';
import {launchCamera, CameraOptions} from 'react-native-image-picker';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {TabsStyles} from '../styles/TabsStyles';
import {BACKEND_URL} from '@env';
import {GlobalStyles} from '../styles/GlobalStyles';
import {useProfile, isDriverProfile} from '../context/ProfileContext';
import {useAuth} from '../context/AuthContext';
import {RootStackParamList} from '../navigation/types';
import api from '../../utils/api';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const DriverProfileScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const {logout, userToken} = useAuth();
  const {profileData, loading, updateProfile, updatePassword, refreshProfile} =
    useProfile();

  const [editing, setEditing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(false);

  // Type guard to ensure we're working with driver profile
  const driverProfile = isDriverProfile(profileData) ? profileData : null;

  // Form state for editing profile
  const [formData, setFormData] = useState({
    firstName: profileData?.firstName || '',
    lastName: profileData?.lastName || '',
    middleInitial: profileData?.middleInitial || '',
    username: profileData?.username || '',
    email: profileData?.email || '',
    phone: profileData?.phone || '',
    licenseNumber: driverProfile?.licenseNumber || '',
  });

  // Vehicle form state
  const [vehicleData, setVehicleData] = useState({
    make: driverProfile?.vehicle?.make || '',
    series: driverProfile?.vehicle?.series || '',
    yearModel: driverProfile?.vehicle?.yearModel?.toString() || '',
    color: driverProfile?.vehicle?.color || '',
    plateNumber: driverProfile?.vehicle?.plateNumber || '',
    bodyNumber: driverProfile?.vehicle?.bodyNumber || '',
  });

  // Dialog states
  const [showChangePasswordDialog, setShowChangePasswordDialog] =
    useState<boolean>(false);
  const [passwordVisible, setPasswordVisible] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

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

  // Helper function to get driver status display
  const getDriverStatusDisplay = (status: string) => {
    const statusMap = {
      available: {label: 'Available', color: '#27ae60'},
      busy: {label: 'Busy', color: '#f39c12'},
      offline: {label: 'Offline', color: '#95a5a6'},
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
        licenseNumber: driverProfile?.licenseNumber || '',
      });
      setCurrentPassword('');
      setNewPassword('');
    }
    setEditing(!editing);
  };

  // Toggle vehicle editing
  const toggleVehicleEdit = () => {
    if (editingVehicle) {
      // Reset vehicle form if canceling edit
      setVehicleData({
        make: driverProfile?.vehicle?.make || '',
        series: driverProfile?.vehicle?.series || '',
        yearModel: driverProfile?.vehicle?.yearModel?.toString() || '',
        color: driverProfile?.vehicle?.color || '',
        plateNumber: driverProfile?.vehicle?.plateNumber || '',
        bodyNumber: driverProfile?.vehicle?.bodyNumber || '',
      });
    }
    setEditingVehicle(!editingVehicle);
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

  const handleSaveVehicle = async () => {
    try {
      const vehicleInfo = {
        vehicle: {
          make: vehicleData.make,
          series: vehicleData.series,
          yearModel: parseInt(vehicleData.yearModel) || 0,
          color: vehicleData.color,
          type: 'bao-bao' as const,
          plateNumber: vehicleData.plateNumber,
          bodyNumber: vehicleData.bodyNumber,
        },
      };

      await updateProfile(vehicleInfo);
      setEditingVehicle(false);
      Alert.alert('Success', 'Vehicle information updated successfully!');
    } catch (error) {
      console.error('Error updating vehicle:', error);
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

  if (!profileData || !driverProfile) {
    return (
      <View style={GlobalStyles.loadingContainer}>
        <Text>Profile not found or invalid user type</Text>
      </View>
    );
  }

  return (
    <>
      <View style={GlobalStyles.header}>
        <Text style={GlobalStyles.headerTitle}>Driver Profile</Text>
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
            <Title>Driver Status</Title>
            <Divider style={TabsStyles.divider} />

            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Current Status</Text>
              <Chip
                mode="flat"
                style={{
                  backgroundColor: getDriverStatusDisplay(
                    driverProfile.driverStatus,
                  ).color,
                  alignSelf: 'flex-start',
                }}
                textStyle={{color: 'white', fontSize: 12}}>
                {getDriverStatusDisplay(driverProfile.driverStatus).label}
              </Chip>
            </View>

            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Rating</Text>
              <Text style={TabsStyles.infoValue}>
                {profileData.rating.toFixed(1)} ⭐ ({profileData.totalRatings}{' '}
                ratings)
              </Text>
            </View>

            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Total Rides</Text>
              <Text style={TabsStyles.infoValue}>{profileData.totalRides}</Text>
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

            {/* License Number - Editable for drivers */}
            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>License Number</Text>
              {editing ? (
                <TextInput
                  value={formData.licenseNumber}
                  onChangeText={text =>
                    setFormData({...formData, licenseNumber: text})
                  }
                  style={TabsStyles.input}
                  mode="outlined"
                />
              ) : (
                <Text style={TabsStyles.infoValue}>
                  {driverProfile.licenseNumber || 'Not set'}
                </Text>
              )}
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

        {/* Vehicle Information Section */}
        <Card style={TabsStyles.sectionCard}>
          <Card.Content>
            <View style={TabsStyles.titleRow}>
              <Title>Vehicle Information</Title>
              {!editing && (
                <TouchableOpacity onPress={toggleVehicleEdit}>
                  <Text style={TabsStyles.editButtonText}>
                    {editingVehicle ? 'Cancel' : 'Edit'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <Divider style={TabsStyles.divider} />

            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Make</Text>
              {editingVehicle ? (
                <TextInput
                  value={vehicleData.make}
                  onChangeText={text =>
                    setVehicleData({...vehicleData, make: text})
                  }
                  style={TabsStyles.input}
                  mode="outlined"
                />
              ) : (
                <Text style={TabsStyles.infoValue}>
                  {driverProfile.vehicle?.make || 'Not set'}
                </Text>
              )}
            </View>

            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Series</Text>
              {editingVehicle ? (
                <TextInput
                  value={vehicleData.series}
                  onChangeText={text =>
                    setVehicleData({...vehicleData, series: text})
                  }
                  style={TabsStyles.input}
                  mode="outlined"
                />
              ) : (
                <Text style={TabsStyles.infoValue}>
                  {driverProfile.vehicle?.series || 'Not set'}
                </Text>
              )}
            </View>

            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Year Model</Text>
              {editingVehicle ? (
                <TextInput
                  value={vehicleData.yearModel}
                  onChangeText={text =>
                    setVehicleData({...vehicleData, yearModel: text})
                  }
                  style={TabsStyles.input}
                  mode="outlined"
                  keyboardType="numeric"
                />
              ) : (
                <Text style={TabsStyles.infoValue}>
                  {driverProfile.vehicle?.yearModel || 'Not set'}
                </Text>
              )}
            </View>

            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Color</Text>
              {editingVehicle ? (
                <TextInput
                  value={vehicleData.color}
                  onChangeText={text =>
                    setVehicleData({...vehicleData, color: text})
                  }
                  style={TabsStyles.input}
                  mode="outlined"
                />
              ) : (
                <Text style={TabsStyles.infoValue}>
                  {driverProfile.vehicle?.color || 'Not set'}
                </Text>
              )}
            </View>

            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Type</Text>
              <Text style={[TabsStyles.infoValue, {color: '#666'}]}>
                Bao-Bao
              </Text>
            </View>

            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Plate Number</Text>
              {editingVehicle ? (
                <TextInput
                  value={vehicleData.plateNumber}
                  onChangeText={text =>
                    setVehicleData({...vehicleData, plateNumber: text})
                  }
                  style={TabsStyles.input}
                  mode="outlined"
                />
              ) : (
                <Text style={TabsStyles.infoValue}>
                  {driverProfile.vehicle?.plateNumber || 'Not set'}
                </Text>
              )}
            </View>

            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Body Number</Text>
              {editingVehicle ? (
                <TextInput
                  value={vehicleData.bodyNumber}
                  onChangeText={text =>
                    setVehicleData({...vehicleData, bodyNumber: text})
                  }
                  style={TabsStyles.input}
                  mode="outlined"
                />
              ) : (
                <Text style={TabsStyles.infoValue}>
                  {driverProfile.vehicle?.bodyNumber || 'Not set'}
                </Text>
              )}
            </View>

            {editingVehicle && (
              <View style={TabsStyles.addressButtonsContainer}>
                <Button
                  mode="contained"
                  onPress={handleSaveVehicle}
                  style={TabsStyles.saveAddressesButton}>
                  Save Vehicle Info
                </Button>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Documents Section */}
        <Card style={TabsStyles.sectionCard}>
          <Card.Content>
            <Title>Documents</Title>
            <Divider style={TabsStyles.divider} />

            {driverProfile.documents?.length === 0 ||
            !driverProfile.documents ? (
              <Text style={TabsStyles.noAddressText}>
                No documents uploaded
              </Text>
            ) : (
              driverProfile.documents?.map((doc, index) => (
                <List.Item
                  key={index}
                  title={doc.documentType}
                  description={`Uploaded: ${formatDate(doc.uploadDate)}`}
                  left={props => (
                    <List.Icon
                      {...props}
                      icon={
                        doc.documentType === 'License'
                          ? 'card-account-details'
                          : doc.documentType === 'Registration'
                          ? 'file-document'
                          : doc.documentType === 'MODA Certificate'
                          ? 'certificate'
                          : 'camera'
                      }
                    />
                  )}
                  right={props => (
                    <Chip
                      mode="flat"
                      style={{
                        backgroundColor: doc.verified ? '#27ae60' : '#f39c12',
                        alignSelf: 'center',
                      }}
                      textStyle={{color: 'white', fontSize: 12}}>
                      {doc.verified ? 'Verified' : 'Pending'}
                    </Chip>
                  )}
                />
              ))
            )}
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
                    .replace(/\b\w/g, l => l.toUpperCase()) || 'Not specified'}
                </Text>
              </View>

              <View style={TabsStyles.infoRow}>
                <Text style={TabsStyles.infoLabel}>Status</Text>
                <Chip
                  mode="flat"
                  style={{
                    backgroundColor: profileData.idDocument.verified
                      ? '#27ae60'
                      : '#f39c12',
                    alignSelf: 'flex-start',
                  }}
                  textStyle={{color: 'white', fontSize: 12}}>
                  {profileData.idDocument.verified
                    ? 'Verified'
                    : 'Pending Verification'}
                </Chip>
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
            </Card.Content>
          </Card>
        )}

        {!editing && (
          <>
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
    </>
  );
};

export default DriverProfileScreen;
