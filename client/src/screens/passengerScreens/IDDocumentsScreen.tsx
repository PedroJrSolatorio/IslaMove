import React, {useEffect, useState} from 'react';
import {View, ScrollView, ActivityIndicator, Image, Alert} from 'react-native';
import {Button, Card, IconButton, Text} from 'react-native-paper';
import {TabsStyles} from '../../styles/TabsStyles';
import {GlobalStyles} from '../../styles/GlobalStyles';
import {useProfile, isPassengerProfile} from '../../context/ProfileContext';
import {Colors} from '../../styles/Colors';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {BACKEND_URL} from '@env';
import {useAuth} from '../../context/AuthContext';
import {
  ImageLibraryOptions,
  ImagePickerResponse,
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SchoolIdValidationReminderProps {
  user: {
    role: string;
    passengerCategory: string;
    age: number;
    schoolIdValidation?: {
      validated: boolean;
    };
  };
  onUpload: () => void;
}

// School ID validation reminder component
const SchoolIdValidationReminder: React.FC<SchoolIdValidationReminderProps> = ({
  user,
  onUpload,
}) => {
  const [showReminder, setShowReminder] = useState(false);

  useEffect(() => {
    // Check if user requires school ID validation
    if (
      user.role === 'passenger' &&
      user.passengerCategory === 'student' &&
      user.age >= 19
    ) {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const augustDeadline = new Date(currentYear, 7, 31); // August 31st

      // Check if validation is required or expired
      if (
        !user.schoolIdValidation ||
        !user.schoolIdValidation.validated ||
        currentDate > augustDeadline
      ) {
        setShowReminder(true);
      }
    }
  }, [user]);

  if (!showReminder) return null;

  return (
    <Card style={[TabsStyles.sectionCard, {backgroundColor: '#FFF3E0'}]}>
      <Card.Content>
        <Text style={TabsStyles.reminderTitle}>
          School ID Validation Required
        </Text>
        <Text style={TabsStyles.reminderText}>
          Students aged 19 and above must upload a valid school ID yearly by
          August 31. If not validated, the student discount will no longer be
          available.
        </Text>
        <Button
          mode="contained"
          onPress={onUpload}
          style={TabsStyles.reminderButton}>
          Upload School ID
        </Button>
      </Card.Content>
    </Card>
  );
};

// Senior eligibility reminder component
interface SeniorEligibilityReminderProps {
  user: {
    role: string;
    passengerCategory: string;
    age: number;
    seniorEligibilityNotification?: {
      eligible: boolean;
      acknowledged: boolean;
      notificationDate: string;
    };
  };
  onChangeCategoryPress: () => void;
  onDismissNotification: () => void;
}

const SeniorEligibilityReminder: React.FC<SeniorEligibilityReminderProps> = ({
  user,
  onChangeCategoryPress,
  onDismissNotification,
}) => {
  const [showReminder, setShowReminder] = useState(false);

  useEffect(() => {
    // Show reminder if user is 60+, not already senior, and hasn't acknowledged
    if (
      user.role === 'passenger' &&
      user.age >= 60 &&
      user.passengerCategory !== 'senior' &&
      user.seniorEligibilityNotification?.eligible &&
      !user.seniorEligibilityNotification?.acknowledged
    ) {
      setShowReminder(true);
    }
  }, [user]);

  const handleDismiss = async () => {
    setShowReminder(false);
    await onDismissNotification();
  };

  if (!showReminder) return null;

  return (
    <Card style={[TabsStyles.sectionCard, {backgroundColor: '#E8F5E8'}]}>
      <Card.Content>
        <View style={TabsStyles.reminderHeader}>
          <Text style={TabsStyles.reminderTitle}>
            🎉 You're Eligible for Senior Discount!
          </Text>
          <IconButton
            icon="close"
            size={20}
            iconColor="#666"
            onPress={handleDismiss}
            style={TabsStyles.dismissButton}
          />
        </View>
        <Text style={TabsStyles.reminderText}>
          Congratulations! At {user.age} years old, you're now eligible for our
          senior citizen discount. Change your category to "Senior" to enjoy
          reduced fares on all rides.
        </Text>
        <View style={TabsStyles.reminderButtonRow}>
          <Button
            mode="contained"
            onPress={onChangeCategoryPress}
            style={TabsStyles.reminderButton}>
            Change to Senior
          </Button>
          <Button
            mode="outlined"
            onPress={handleDismiss}
            style={TabsStyles.reminderDismissButton}>
            Maybe Later
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
};

const IDDocumentsScreen = () => {
  const {profileData, loading, refreshProfile} = useProfile();
  const insets = useSafeAreaInsets();
  const {userToken} = useAuth();
  const navigation = useNavigation<NavigationProp>();

  // Type guard to ensure we're working with passenger profile
  const passengerProfile = isPassengerProfile(profileData) ? profileData : null;

  // Helper function to format date
  const formatDate = (dateString: string | number | Date) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Navigate to ProfileInfoScreen with parameter to open category modal
  const handleChangeCategoryPress = () => {
    navigation.navigate('ProfileInfo', {openCategoryModal: true});
  };

  const handleSchoolIdUpload = async () => {
    try {
      // Show action sheet to let user choose between camera and gallery
      Alert.alert(
        'Upload School ID',
        'Choose how you want to upload your school ID:',
        [
          {
            text: 'Camera',
            onPress: () => uploadSchoolId('camera'),
          },
          {
            text: 'Gallery',
            onPress: () => uploadSchoolId('gallery'),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
        {cancelable: true},
      );
    } catch (error) {
      console.error('School ID upload error:', error);
      Alert.alert('Error', 'Failed to upload school ID. Please try again.');
    }
  };

  const uploadSchoolId = async (source: 'camera' | 'gallery') => {
    try {
      const options: ImageLibraryOptions = {
        mediaType: 'photo',
        includeBase64: false,
        maxHeight: 2000,
        maxWidth: 2000,
        quality: 1,
      };

      const launchFunction =
        source === 'camera' ? launchCamera : launchImageLibrary;

      launchFunction(options, async (result: ImagePickerResponse) => {
        if (result.assets && result.assets.length > 0) {
          const selectedAsset = result.assets[0];

          const formData = new FormData();
          const uriParts = selectedAsset.uri!.split('.');
          const fileType = uriParts[uriParts.length - 1];

          formData.append('schoolId', {
            uri: selectedAsset.uri,
            name: `school_id.${fileType}`,
            type: selectedAsset.type || 'image/jpeg',
          } as any);

          const response = await fetch(
            `${BACKEND_URL}/api/users/upload-school-id/${profileData?._id}`,
            {
              method: 'POST',
              body: formData,
              headers: {
                Authorization: `Bearer ${userToken}`,
                'Content-Type': 'multipart/form-data',
              },
            },
          );

          if (response.ok) {
            Alert.alert(
              'School ID Uploaded',
              'Your school ID has been uploaded successfully and will be reviewed.',
            );
            refreshProfile();
          } else {
            throw new Error('Failed to upload school ID');
          }
        }
      });
    } catch (error) {
      console.error('School ID upload error:', error);
      Alert.alert('Error', 'Failed to upload school ID. Please try again.');
    }
  };

  const handleDismissSeniorNotification = async () => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/users/acknowledge-senior-eligibility/${profileData?._id}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.ok) {
        refreshProfile(); // Refresh to update the notification state
      } else {
        console.error('Failed to acknowledge senior notification');
      }
    } catch (error) {
      console.error('Error acknowledging senior notification:', error);
    }
  };

  if (loading) {
    return (
      <View style={GlobalStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text>Loading ID document information...</Text>
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

  const idDocument = profileData.idDocument;

  return (
    <ScrollView style={GlobalStyles.container}>
      {/* School ID Validation Reminder */}
      <SchoolIdValidationReminder
        user={passengerProfile}
        onUpload={handleSchoolIdUpload}
      />
      {/* Senior Eligibility Reminder */}
      <SeniorEligibilityReminder
        user={passengerProfile}
        onChangeCategoryPress={handleChangeCategoryPress}
        onDismissNotification={handleDismissSeniorNotification}
      />
      <Card style={[TabsStyles.sectionCard, {marginTop: 16}]}>
        <Card.Content>
          <View style={TabsStyles.infoRow}>
            <Text style={TabsStyles.infoLabel}>Document Type</Text>
            <Text style={[TabsStyles.infoValue, {color: '#666'}]}>
              {idDocument.type
                ?.replace('_', ' ')
                .replace(/\b\w/g, l => l.toUpperCase()) || 'Not specified'}
            </Text>
          </View>

          <View style={TabsStyles.infoRow}>
            <Text style={TabsStyles.infoLabel}>Verification Status</Text>
            <Text
              style={[
                TabsStyles.infoValue,
                {
                  color:
                    profileData.verificationStatus === 'approved'
                      ? Colors.success
                      : profileData.verificationStatus === 'rejected'
                      ? Colors.danger
                      : Colors.secondary,
                  fontWeight: 'bold',
                },
              ]}>
              {profileData.verificationStatus
                ?.replace('_', ' ')
                .replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
            </Text>
          </View>

          {idDocument.uploadedAt && (
            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Uploaded On</Text>
              <Text style={[TabsStyles.infoValue, {color: '#666'}]}>
                {formatDate(idDocument.uploadedAt)}
              </Text>
            </View>
          )}

          {idDocument.verifiedAt &&
            profileData.verificationStatus === 'approved' && (
              <View style={TabsStyles.infoRow}>
                <Text style={TabsStyles.infoLabel}>Verified On</Text>
                <Text style={[TabsStyles.infoValue, {color: '#666'}]}>
                  {formatDate(idDocument.verifiedAt)}
                </Text>
              </View>
            )}

          {profileData.pendingProfileImage?.status === 'pending' && (
            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Pending Image</Text>
              <Text style={[TabsStyles.infoValue, {color: Colors.secondary}]}>
                Under Review (Profile Image)
              </Text>
            </View>
          )}

          {profileData.pendingProfileImage?.status === 'rejected' && (
            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Rejection Reason</Text>
              <Text style={[TabsStyles.infoValue, {color: Colors.danger}]}>
                {profileData.pendingProfileImage.rejectionReason ||
                  'No reason provided.'}
              </Text>
            </View>
          )}

          {idDocument.imageUrl ? (
            <View style={TabsStyles.imagePreviewContainer}>
              <Text style={TabsStyles.infoLabel}>Document Image</Text>
              <Image
                source={{uri: idDocument.imageUrl}}
                style={TabsStyles.idDocumentImage}
                resizeMode="contain"
              />
              <Text style={TabsStyles.imageDisclaimer}>
                This is a preview of your uploaded ID document. For security, it
                cannot be downloaded or changed here.
              </Text>
            </View>
          ) : (
            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Document Image</Text>
              <Text style={[TabsStyles.infoValue, {color: '#888'}]}>
                No image uploaded.
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>
      <View style={{height: insets.bottom}} />
    </ScrollView>
  );
};

export default IDDocumentsScreen;
