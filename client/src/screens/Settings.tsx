import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import {
  Card,
  Title,
  Divider,
  Button,
  Dialog,
  Portal,
  TextInput,
  List,
} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {GlobalStyles} from '../styles/GlobalStyles';
import {TabsStyles} from '../styles/TabsStyles';
import {useProfile} from '../context/ProfileContext';
import {useAuth} from '../context/AuthContext';
import api from '../../utils/api';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const SettingsScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const {
    profileData,
    updatePassword,
    refreshProfile,
    loading: profileLoading,
  } = useProfile();
  const {userToken, logout} = useAuth();
  const [showChangePasswordDialog, setShowChangePasswordDialog] =
    useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [showCreatePasswordDialog, setShowCreatePasswordDialog] =
    useState(false);
  const [createPassword, setCreatePassword] = useState('');
  const [confirmCreatePassword, setConfirmCreatePassword] = useState('');
  const [createPasswordVisible, setCreatePasswordVisible] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Handlers
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

  const handleCancelChangePassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowChangePasswordDialog(false);
  };

  const handleLinkGoogle = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signOut();
      const userInfo = await GoogleSignin.signIn();
      const {data} = userInfo;
      const googleIdToken = data?.idToken;

      if (!googleIdToken) {
        Alert.alert('Error', 'Google ID token not found.');
        return;
      }

      console.log('User Token being sent:', userToken);
      console.log('Google ID Token:', googleIdToken);
      // Send the Google ID token to your backend to link the account
      const response = await api.post(`/api/auth/link-google`, {
        idToken: googleIdToken,
      });

      const backendResponseData = response.data;

      if (backendResponseData && backendResponseData.message) {
        // If the backend sends a success message, use it.
        Alert.alert('Success', backendResponseData.message);
      } else {
        // Fallback message if backend doesn't send 'message' or is empty
        Alert.alert(
          'Success',
          'Your account has been successfully linked with Google!',
        );
      }

      // Refresh profile AFTER the successful link and alert
      refreshProfile();
    } catch (error: any) {
      console.error('Error linking Google account:', error);
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('Google sign-in cancelled by user');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log('Google sign-in already in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Error', 'Google Play Services not available or outdated.');
      } else {
        Alert.alert('Error', 'Failed to link Google account.');
      }
    }
  };

  const handleCreatePassword = async () => {
    console.log('Creating password...');
    if (createPassword !== confirmCreatePassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    if (createPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long.');
      return;
    }

    try {
      // Call your backend API to set the password
      const response = await api.post('/api/auth/set-password', {
        newPassword: createPassword,
      });

      setShowCreatePasswordDialog(false);
      setCreatePassword('');
      setConfirmCreatePassword('');

      Alert.alert(
        'Success',
        'Password created successfully! You can now unlink your Google account.',
        [
          {
            text: 'OK',
            onPress: () => {
              refreshProfile();
            },
          },
        ],
      );
    } catch (error: any) {
      console.error('Error creating password:', error);
      const errorMessage =
        error.response?.data?.message || 'Failed to create password.';
      Alert.alert('Error', errorMessage);
    }
  };

  const handleUnlinkGoogle = async () => {
    Alert.alert(
      'Unlink Google Account',
      'Are you sure you want to unlink your Google account? If you do not have a password set, you will need to create one to log in next time.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Unlink',
          onPress: async () => {
            try {
              const response = await api.post('/api/auth/unlink-google'); // Your API call

              // You might want to sign out from Google locally as well
              try {
                await GoogleSignin.signOut();
              } catch (googleSignOutError) {
                console.warn(
                  'Error during Google local sign out:',
                  googleSignOutError,
                );
              }

              // Check for success or specific actions
              if (response.data.message) {
                // Assuming your backend sends a 'message'
                Alert.alert('Success', response.data.message);
                refreshProfile(); // Refresh user data in your app
              } else {
                Alert.alert('Success', 'Google account unlinked.');
                refreshProfile();
              }
            } catch (error: any) {
              console.error(
                'Error unlinking Google account:',
                error.response?.data || error.message,
              );
              const errorMessage =
                error.response?.data?.message ||
                'Failed to unlink Google account.';

              if (error.response?.data?.action === 'set_password_required') {
                Alert.alert(
                  'Password Required',
                  errorMessage + '\nWould you like to create a password now?',
                  [
                    {
                      text: 'Cancel',
                      style: 'cancel',
                    },
                    {
                      text: 'Create Password',
                      onPress: () => {
                        setShowCreatePasswordDialog(true);
                      },
                    },
                  ],
                );
              } else {
                Alert.alert('Error', errorMessage);
              }
            }
          },
        },
      ],
      {cancelable: true},
    );
  };

  const handleViewTerms = () => {
    // Navigate to a WebView or display a modal with terms
    Alert.alert('Terms of Service', 'Display Terms of Service here.');
  };

  const handleViewPrivacyPolicy = () => {
    // Navigate to a WebView or display a modal with privacy policy
    Alert.alert('Privacy Policy', 'Display Privacy Policy here.');
  };

  const handleDeleteAccount = () => {
    setShowDeleteConfirmDialog(true);
  };

  const handleConfirmDelete = () => {
    setShowDeleteConfirmDialog(false);

    if (!profileData) {
      Alert.alert(
        'Error',
        'Profile data not available. Cannot proceed with deletion.',
      );
      return;
    }

    if (profileData.isGoogleUser && !profileData.hasPassword) {
      // Google user without password - require Google sign-in
      handleGoogleDeleteVerification();
    } else {
      // Regular user or Google user with password - require password
      setShowPasswordDialog(true);
    }
  };

  const handleGoogleDeleteVerification = async () => {
    try {
      setIsDeleting(true);

      if (!profileData) {
        Alert.alert(
          'Error',
          'Profile data not available. Cannot proceed with deletion.',
        );
        setIsDeleting(false);
        return;
      }

      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signOut();
      const userInfo = await GoogleSignin.signIn();
      const {data} = userInfo;
      const googleIdToken = data?.idToken;

      if (!googleIdToken) {
        Alert.alert('Error', 'Google authentication failed');
        setIsDeleting(false);
        return;
      }

      const response = await api.post(
        `/api/users/verify-deletion/${profileData._id}`,
        {
          googleIdToken,
          reason: deleteReason,
        },
      );

      Alert.alert(
        'Account Deletion Scheduled',
        `${
          response.data.message
        }\n\nYour account will be permanently deleted in ${
          response.data.daysRemaining
        } days. You can cancel this by logging in before ${new Date(
          response.data.scheduledFor,
        ).toLocaleDateString()}.`,
        [
          {
            text: 'OK',
            onPress: () => {
              logout('Deletion scheduled successfully.');
            },
          },
        ],
      );
    } catch (error) {
      console.error('Error with Google delete verification:', error);
      Alert.alert('Error', 'Failed to verify Google authentication');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePasswordDeleteVerification = async () => {
    if (!deletePassword) {
      Alert.alert('Error', 'Please enter your password');
      return;
    }

    try {
      setIsDeleting(true);

      if (!profileData) {
        Alert.alert(
          'Error',
          'Profile data not available. Cannot proceed with deletion.',
        );
        setIsDeleting(false);
        return;
      }

      const response = await api.post(
        `/api/users/verify-deletion/${profileData._id}`,
        {
          password: deletePassword,
          reason: deleteReason,
        },
      );

      setShowPasswordDialog(false);
      setDeletePassword('');
      setDeleteReason('');

      Alert.alert(
        'Account Deletion Scheduled',
        `${
          response.data.message
        }\n\nYour account will be permanently deleted in ${
          response.data.daysRemaining
        } days. You can cancel this by logging in before ${new Date(
          response.data.scheduledFor,
        ).toLocaleDateString()}.`,
        [
          {
            text: 'OK',
            onPress: () => {
              logout('Deletion scheduled successfully.');
            },
          },
        ],
      );
    } catch (error: any) {
      console.error('Error verifying password for deletion:', error);
      const errorMessage =
        error.response?.data?.error || 'Failed to verify password';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  if (profileLoading) {
    return (
      <View style={GlobalStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading settings...</Text>
      </View>
    );
  }

  // If profileData is still null after loading, display an error or fallback
  if (!profileData) {
    return (
      <View style={GlobalStyles.container}>
        <Text style={GlobalStyles.errorContainer}>
          Could not load profile data. Please try again later.
        </Text>
        <Button
          mode="contained"
          onPress={refreshProfile}
          style={{marginTop: 20}}>
          Retry Loading Profile
        </Button>
      </View>
    );
  }

  return (
    <ScrollView style={GlobalStyles.container}>
      <Card style={[TabsStyles.sectionCard, settingsStyles.cardSpacing]}>
        <Card.Content>
          <Title>Account Security</Title>
          <Divider style={TabsStyles.divider} />
          {profileData.isGoogleUser ? (
            <>
              <View style={TabsStyles.googleInfoContainer}>
                <List.Icon icon="google" color="#3498db" />
                <Text style={TabsStyles.infoValue}>Registered with Google</Text>
              </View>
              <Button mode="contained" onPress={handleUnlinkGoogle}>
                Unlink Google Account
              </Button>
            </>
          ) : (
            <>
              <Button
                mode="outlined"
                icon="lock"
                onPress={() => setShowChangePasswordDialog(true)}
                style={{marginTop: 12}}>
                Change Password
              </Button>
              <Button
                mode="outlined"
                icon={() => (
                  <Image
                    source={require('../assets/images/google-logo-icon.png')}
                    style={{width: 18, height: 18}}
                  />
                )}
                onPress={handleLinkGoogle}
                style={{marginTop: 12}}>
                Link with Google
              </Button>
            </>
          )}
        </Card.Content>
      </Card>

      <Card style={TabsStyles.sectionCard}>
        <Card.Content>
          <Title>Legal</Title>
          <Divider style={TabsStyles.divider} />
          <Button
            mode="text"
            icon="file-document-outline"
            onPress={handleViewTerms}
            style={settingsStyles.legalButton}>
            Terms of Service
          </Button>
          <Button
            mode="text"
            icon="shield-lock-outline"
            onPress={handleViewPrivacyPolicy}
            style={settingsStyles.legalButton}>
            Privacy Policy
          </Button>
        </Card.Content>
      </Card>

      <Card style={TabsStyles.sectionCard}>
        <Card.Content>
          <Title>Account Management</Title>
          <Divider style={TabsStyles.divider} />
          <Button
            mode="contained"
            icon="delete-forever"
            onPress={handleDeleteAccount}
            style={settingsStyles.deleteAccountButton}>
            Delete Account
          </Button>
        </Card.Content>
      </Card>

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
            <Button onPress={handleCancelChangePassword}>Cancel</Button>
            <Button onPress={handleChangePassword}>Change Password</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={showCreatePasswordDialog}
          onDismiss={() => setShowCreatePasswordDialog(false)}>
          <Dialog.Title>Create Password</Dialog.Title>
          <Dialog.Content>
            <Text style={{marginBottom: 16, color: '#666'}}>
              Create a password for your account to enable unlinking from
              Google.
            </Text>
            <TextInput
              label="New Password"
              value={createPassword}
              onChangeText={setCreatePassword}
              mode="outlined"
              secureTextEntry={!createPasswordVisible}
              style={TabsStyles.input}
              right={
                <TextInput.Icon
                  icon={createPasswordVisible ? 'eye-off' : 'eye'}
                  onPress={() =>
                    setCreatePasswordVisible(!createPasswordVisible)
                  }
                />
              }
            />
            <TextInput
              label="Confirm Password"
              value={confirmCreatePassword}
              onChangeText={setConfirmCreatePassword}
              mode="outlined"
              secureTextEntry={!createPasswordVisible}
              style={TabsStyles.input}
              right={
                <TextInput.Icon
                  icon={createPasswordVisible ? 'eye-off' : 'eye'}
                  onPress={() =>
                    setCreatePasswordVisible(!createPasswordVisible)
                  }
                />
              }
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowCreatePasswordDialog(false)}>
              Cancel
            </Button>
            <Button onPress={handleCreatePassword}>Create Password</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={showDeleteConfirmDialog}
          onDismiss={() => setShowDeleteConfirmDialog(false)}>
          <Dialog.Title>Delete Account</Dialog.Title>
          <Dialog.Content>
            <Text style={{marginBottom: 16}}>
              Are you sure you want to delete your account? This action will:
            </Text>
            <Text style={{marginBottom: 8}}>
              • Schedule your account for deletion in 30 days
            </Text>
            <Text style={{marginBottom: 8}}>
              • Remove all your data permanently
            </Text>
            <Text style={{marginBottom: 8}}>• Cancel any active rides</Text>
            <Text style={{marginBottom: 16, fontWeight: 'bold'}}>
              You can cancel this deletion by logging in within 30 days.
            </Text>
            <TextInput
              label="Reason for deletion (optional)"
              value={deleteReason}
              onChangeText={setDeleteReason}
              mode="outlined"
              multiline
              style={{marginBottom: 16}}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onPress={handleConfirmDelete} disabled={isDeleting}>
              Continue
            </Button>
          </Dialog.Actions>
        </Dialog>

        {/* Password Verification Dialog */}
        <Dialog
          visible={showPasswordDialog}
          onDismiss={() => setShowPasswordDialog(false)}>
          <Dialog.Title>Verify Password</Dialog.Title>
          <Dialog.Content>
            <Text style={{marginBottom: 16}}>
              Please enter your password to confirm account deletion:
            </Text>
            <TextInput
              label="Password"
              value={deletePassword}
              onChangeText={setDeletePassword}
              mode="outlined"
              secureTextEntry
              style={{marginBottom: 16}}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowPasswordDialog(false)}>Cancel</Button>
            <Button
              onPress={handlePasswordDeleteVerification}
              disabled={isDeleting}
              loading={isDeleting}>
              {isDeleting ? 'Verifying...' : 'Delete Account'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
};

const settingsStyles = StyleSheet.create({
  legalButton: {
    justifyContent: 'flex-start',
    paddingLeft: 0,
  },
  deleteAccountButton: {
    marginTop: 20,
    backgroundColor: '#e74c3c',
  },
  cardSpacing: {
    marginTop: 16,
  },
});

export default SettingsScreen;
