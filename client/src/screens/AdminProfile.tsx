import React, {useEffect, useState} from 'react';
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
  IconButton,
  Portal,
  Dialog,
  Chip,
} from 'react-native-paper';
import {launchCamera, CameraOptions} from 'react-native-image-picker';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {TabsStyles} from '../styles/TabsStyles';
import {BACKEND_URL} from '@env';
import {GlobalStyles} from '../styles/GlobalStyles';
import {useProfile, isAdminProfile} from '../context/ProfileContext';
import {useAuth} from '../context/AuthContext';
import {RootStackParamList} from '../navigation/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const AdminProfileScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const {logout, userToken} = useAuth();
  const {profileData, loading, updateProfile, updatePassword, refreshProfile} =
    useProfile();

  const [editing, setEditing] = useState(false);

  // Helper function to create full name from separate fields
  const getFullName = () => {
    if (!profileData) return '';
    const {firstName, lastName, middleInitial} = profileData;
    return `${firstName} ${
      middleInitial ? middleInitial + '. ' : ''
    }${lastName}`.trim();
  };

  // Helper function to get initials from separate name fields
  const getInitials = () => {
    if (!profileData) return 'A';
    const {firstName, lastName, middleInitial} = profileData;
    const firstInitial = firstName ? firstName[0].toUpperCase() : '';
    const lastInitial = lastName ? lastName[0].toUpperCase() : '';
    const middleInit = middleInitial ? middleInitial[0].toUpperCase() : '';

    return (firstInitial + middleInit + lastInitial).substring(0, 2) || 'A';
  };

  // Form state for editing profile - using separate name fields
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    middleInitial: '',
    username: '',
    email: '',
    phone: '',
  });

  // Update form data when profileData changes
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

  // Dialog states
  const [showChangePasswordDialog, setShowChangePasswordDialog] =
    useState<boolean>(false);
  const [passwordVisible, setPasswordVisible] = useState<boolean>(false);
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  // Check if user is admin
  if (!loading && profileData && !isAdminProfile(profileData)) {
    return (
      <View style={GlobalStyles.loadingContainer}>
        <Text style={{color: 'red', fontSize: 16}}>
          Access Denied: Admin privileges required
        </Text>
        <Button onPress={() => navigation.goBack()} mode="contained">
          Go Back
        </Button>
      </View>
    );
  }

  // Reset form data when toggling edit mode
  const toggleEdit = () => {
    if (editing && profileData) {
      // Reset form if canceling edit
      setFormData({
        firstName: profileData.firstName || '',
        lastName: profileData.lastName || '',
        middleInitial: profileData.middleInitial || '',
        username: profileData.username || '',
        email: profileData.email || '',
        phone: profileData.phone || '',
      });
      setCurrentPassword('');
      setNewPassword('');
    }
    setEditing(!editing);
  };

  const handleSave = async () => {
    if (!profileData) return;
    try {
      // Only send the fields that can be updated
      const updateData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleInitial: formData.middleInitial,
        username: formData.username,
        email: formData.email,
        phone: formData.phone,
      };

      console.log('Sending update data:', updateData);
      await updateProfile(updateData);
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  const pickImage = async () => {
    try {
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
          return;
        } else if (response.errorCode) {
          console.log('ImagePicker Error: ', response.errorMessage);
          Alert.alert('Error', response.errorMessage || 'Failed to pick image');
          return;
        }

        if (response.assets && response.assets.length > 0) {
          const asset = response.assets[0];
          const imageUri = asset.uri;

          if (!imageUri) {
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

          // Check if profileData exists before uploading
          if (!profileData) {
            Alert.alert('Error', 'Profile data not found');
            return;
          }

          // Upload the image
          fetch(`${BACKEND_URL}/api/users/upload-image/${profileData._id}`, {
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
              /// Force refresh of profile to get the updated image URL
              refreshProfile();
              Alert.alert('Success', 'Profile image updated successfully!');
            })
            .catch(uploadError => {
              console.error('Upload request failed:', uploadError);
              Alert.alert('Error', 'Failed to upload image');
            });
        }
      });
    } catch (error) {
      console.error('Error picking or uploading image:', error);
      Alert.alert('Error', 'Failed to update profile image');
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

  if (!profileData) {
    return (
      <View style={GlobalStyles.loadingContainer}>
        <Text style={{color: 'red', fontSize: 16}}>
          Failed to load profile data
        </Text>
        <Button onPress={refreshProfile} mode="contained">
          Retry
        </Button>
      </View>
    );
  }

  const fullName = getFullName();
  const initials = getInitials();

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
              style={TabsStyles.avatarContainerModern}
              onPress={editing ? pickImage : undefined}>
              {profileData.profileImage ? (
                <Avatar.Image
                  size={100}
                  source={{uri: profileData.profileImage}}
                  style={TabsStyles.avatar}
                />
              ) : (
                <Avatar.Text
                  size={100}
                  label={initials}
                  style={TabsStyles.avatar}
                />
              )}
              {editing && (
                <View style={TabsStyles.editAvatarOverlay}>
                  <Text style={TabsStyles.editAvatarText}>Edit</Text>
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
                    label="Last Name"
                    value={formData.lastName}
                    onChangeText={text =>
                      setFormData({...formData, lastName: text})
                    }
                    style={TabsStyles.input}
                    mode="outlined"
                  />
                </>
              ) : (
                <>
                  <Text style={TabsStyles.nameText}>{fullName}</Text>
                  <Chip
                    icon="shield-crown"
                    mode="outlined"
                    style={{marginTop: 8}}>
                    Administrator
                  </Chip>
                </>
              )}

              <Button
                mode="contained"
                onPress={editing ? handleSave : () => {}}
                style={TabsStyles.saveButton}
                disabled={!editing}>
                {editing ? 'Save Changes' : `Admin Account`}
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

export default AdminProfileScreen;
