import React, {useState, useEffect} from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  Card,
  Button,
  TextInput,
  Avatar,
  Text,
  IconButton,
  Divider,
} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../navigation/types';
import {TabsStyles} from '../../styles/TabsStyles';
import {GlobalStyles} from '../../styles/GlobalStyles';
import {useProfile, isDriverProfile} from '../../context/ProfileContext';
import {useAuth} from '../../context/AuthContext';
import {launchCamera, CameraOptions} from 'react-native-image-picker';
import {BACKEND_URL} from '@env';
import {Colors} from '../../styles/Colors';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ProfileInfoScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const {userToken} = useAuth();
  const {profileData, loading, updateProfile, refreshProfile} = useProfile();

  const [editing, setEditing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Type guard to ensure we're working with passenger profile
  const driverProfile = isDriverProfile(profileData) ? profileData : null;

  // Form state for editing profile
  const [formData, setFormData] = useState({
    firstName: profileData?.firstName || '',
    lastName: profileData?.lastName || '',
    middleInitial: profileData?.middleInitial || '',
    username: profileData?.username || '',
    email: profileData?.email || '',
    phone: profileData?.phone || '',
  });

  // Effect to update formData when profileData changes (e.g., after refresh)
  useEffect(() => {
    if (profileData) {
      setFormData({
        firstName: profileData.firstName || '',
        lastName: profileData.lastName || '',
        middleInitial: profileData.middleInitial || '',
        username: profileData.username || '',
        email: profileData.email || '',
        phone: profileData.phone || '',
      });
    }
  }, [profileData]);

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
      Alert.alert('Error', 'Failed to update profile.');
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

          const formData = new FormData();
          const uriParts = imageUri.split('.');
          const fileType = uriParts[uriParts.length - 1];

          formData.append('profileImage', {
            uri: imageUri,
            name: `profile-${Date.now()}.${fileType}`,
            type: `image/${fileType === 'jpg' ? 'jpeg' : fileType}`,
          } as unknown as Blob);

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
              refreshProfile(); // Force refresh to get updated verification status
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
      <View
        style={{
          height: 80,
          backgroundColor: '#f8f8f8',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
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
            alignItems: 'center',
          }}>
          <Text style={{fontSize: 20, fontWeight: 'bold'}}>Profile Info</Text>
        </View>
        <IconButton
          icon={editing ? 'close' : 'pencil'}
          iconColor="#000"
          size={24}
          onPress={toggleEdit}
        />
      </View>
      <ScrollView style={GlobalStyles.container}>
        <View style={TabsStyles.profileHeaderContainer}>
          <TouchableOpacity
            style={TabsStyles.avatarContainerModern}
            onPress={pickImage}
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
                size={100} // Increased size for prominence on a dedicated screen
                label={getInitials()}
                style={TabsStyles.avatar}
                labelStyle={TabsStyles.avatarLabel}
              />
            )}
            {(uploadingImage || isProfileImagePending()) && (
              <View style={TabsStyles.editAvatarOverlay}>
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={TabsStyles.editAvatarText}>Pending</Text>
                )}
              </View>
            )}
            {!uploadingImage && !isProfileImagePending() && (
              <View style={TabsStyles.editAvatarIconContainer}>
                <IconButton
                  icon="pencil"
                  size={20}
                  iconColor={Colors.primary}
                  style={TabsStyles.editAvatarIconButton}
                  onPress={pickImage}
                />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <Card style={TabsStyles.sectionCard}>
          <Card.Content>
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
                <TextInput
                  label="Username"
                  value={formData.username}
                  onChangeText={text =>
                    setFormData({...formData, username: text})
                  }
                  style={TabsStyles.input}
                  mode="outlined"
                />
                <TextInput
                  label="Email"
                  value={formData.email}
                  onChangeText={text => setFormData({...formData, email: text})}
                  style={TabsStyles.input}
                  mode="outlined"
                  keyboardType="email-address"
                  editable={!profileData.isGoogleUser}
                  right={
                    profileData.isGoogleUser ? (
                      <TextInput.Icon icon="lock" />
                    ) : undefined
                  }
                />
                {profileData.isGoogleUser && (
                  <Text style={TabsStyles.infoMessage}>
                    Your email is managed by your linked Google account and
                    cannot be edited.
                  </Text>
                )}
                <TextInput
                  label="Phone"
                  value={formData.phone}
                  onChangeText={text => setFormData({...formData, phone: text})}
                  style={TabsStyles.input}
                  mode="outlined"
                  keyboardType="phone-pad"
                />
                <Button
                  mode="contained"
                  onPress={handleSave}
                  style={TabsStyles.saveButton}>
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <View style={TabsStyles.infoRow}>
                  <Text style={TabsStyles.infoLabel}>Full Name</Text>
                  <Text style={TabsStyles.infoValue}>{getFullName()}</Text>
                </View>
                <Divider style={TabsStyles.divider} />
                <View style={TabsStyles.infoRow}>
                  <Text style={TabsStyles.infoLabel}>Username</Text>
                  <Text style={TabsStyles.infoValue}>
                    {profileData.username}
                  </Text>
                </View>
                <Divider style={TabsStyles.divider} />
                <View style={TabsStyles.infoRow}>
                  <Text style={TabsStyles.infoLabel}>Email</Text>
                  <Text style={TabsStyles.infoValue}>{profileData.email}</Text>
                </View>
                <Divider style={TabsStyles.divider} />
                <View style={TabsStyles.infoRow}>
                  <Text style={TabsStyles.infoLabel}>Phone</Text>
                  <Text style={TabsStyles.infoValue}>{profileData.phone}</Text>
                </View>
                <Divider style={TabsStyles.divider} />
                <View style={TabsStyles.infoRow}>
                  <Text style={TabsStyles.infoLabel}>Birthdate</Text>
                  <Text style={[TabsStyles.infoValue, {color: '#666'}]}>
                    {formatDate(profileData.birthdate)}
                  </Text>
                </View>
                <Divider style={TabsStyles.divider} />
                <View style={TabsStyles.infoRow}>
                  <Text style={TabsStyles.infoLabel}>Age</Text>
                  <Text style={[TabsStyles.infoValue, {color: '#666'}]}>
                    {profileData.age || 'Not set'}
                  </Text>
                </View>
              </>
            )}
          </Card.Content>
        </Card>
      </ScrollView>
    </>
  );
};

export default ProfileInfoScreen;
