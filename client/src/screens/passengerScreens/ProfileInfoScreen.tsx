import React, {useState, useEffect} from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  Image,
} from 'react-native';
import {
  Card,
  Button,
  TextInput,
  Avatar,
  Text,
  IconButton,
  Divider,
  Modal,
} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../navigation/types';
import {TabsStyles} from '../../styles/TabsStyles';
import {styles} from '../../styles/RegistrationStyles';
import {GlobalStyles} from '../../styles/GlobalStyles';
import {useProfile, isPassengerProfile} from '../../context/ProfileContext';
import {useAuth} from '../../context/AuthContext';
import {
  launchCamera,
  launchImageLibrary,
  CameraOptions,
  ImageLibraryOptions,
  ImagePickerResponse,
} from 'react-native-image-picker';
import {BACKEND_URL} from '@env';
import {Colors} from '../../styles/Colors';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Type definitions
interface CategoryChangeRequest {
  requestedCategory: string;
  supportingDocument: {
    imageUrl: string;
    mimeType: string;
  } | null;
}

interface CategoryChangeModalProps {
  visible: boolean;
  onDismiss: () => void;
  currentCategory: string;
  age: number;
  onSubmit: (request: CategoryChangeRequest) => void;
  loading: boolean;
}

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

// Category change modal component with senior eligibility notification
const CategoryChangeModal: React.FC<CategoryChangeModalProps> = ({
  visible,
  onDismiss,
  currentCategory,
  age,
  onSubmit,
  loading,
}) => {
  const [selectedCategory, setSelectedCategory] = useState(currentCategory);
  const [supportingDocument, setSupportingDocument] = useState({
    imageUrl: '',
    mimeType: '',
  });

  const getEligibleCategories = () => {
    const categories = [];

    if (age >= 18) {
      categories.push({value: 'regular', label: 'Regular', requiresDoc: false});
    }

    if (age >= 12) {
      categories.push({
        value: 'student',
        label: 'Student',
        requiresDoc: age >= 19, // Requires school ID if 19 or older
      });
    }

    if (age >= 60) {
      categories.push({
        value: 'senior',
        label: 'Senior',
        requiresDoc: true,
        description:
          'Requires Senior Citizen ID or valid government-issued ID showing age',
      });
    }

    return categories.filter(cat => cat.value !== currentCategory);
  };

  const selectedCategoryInfo = getEligibleCategories().find(
    cat => cat.value === selectedCategory,
  );

  const pickImage = async () => {
    try {
      const options: ImageLibraryOptions = {
        mediaType: 'photo',
        includeBase64: false,
        maxHeight: 2000,
        maxWidth: 2000,
        quality: 1,
      };

      launchImageLibrary(options, (result: ImagePickerResponse) => {
        if (result.assets && result.assets.length > 0) {
          const selectedAsset = result.assets[0];
          setSupportingDocument({
            imageUrl: selectedAsset.uri || '',
            mimeType: selectedAsset.type || 'image/jpeg',
          });
        }
      });
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  const takePicture = async () => {
    try {
      const options: CameraOptions = {
        mediaType: 'photo',
        quality: 1,
        saveToPhotos: false,
        includeBase64: false,
        maxHeight: 2000,
        maxWidth: 2000,
      };

      launchCamera(options, (result: ImagePickerResponse) => {
        if (result.didCancel) {
          console.log('User cancelled camera');
          return;
        } else if (result.errorCode) {
          console.log('Camera Error: ', result.errorMessage);
          Alert.alert('Error', result.errorMessage || 'Failed to take picture');
          return;
        }

        if (result.assets && result.assets.length > 0) {
          const selectedAsset = result.assets[0];
          setSupportingDocument({
            imageUrl: selectedAsset.uri || '',
            mimeType: selectedAsset.type || 'image/jpeg',
          });
        }
      });
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to take picture. Please try again.');
    }
  };

  const handleSubmit = () => {
    if (selectedCategoryInfo?.requiresDoc && !supportingDocument.imageUrl) {
      const docType =
        selectedCategory === 'senior'
          ? 'Senior Citizen ID or government-issued ID showing age'
          : 'school ID';

      Alert.alert(
        'Document Required',
        `Please upload a ${docType} to verify your eligibility.`,
      );
      return;
    }

    onSubmit({
      requestedCategory: selectedCategory,
      supportingDocument: selectedCategoryInfo?.requiresDoc
        ? supportingDocument
        : null,
    });
  };

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      contentContainerStyle={TabsStyles.modalContainer}>
      <Text style={TabsStyles.modalTitle2}>Change Passenger Category</Text>

      <View style={TabsStyles.currentCategoryInfo}>
        <Text style={TabsStyles.currentCategoryLabel}>Current Category:</Text>
        <Text style={TabsStyles.currentCategoryValue}>
          {currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)}
        </Text>
      </View>

      {getEligibleCategories().length === 0 ? (
        <Text style={TabsStyles.noEligibleText}>
          You are not eligible to change your category at this time.
        </Text>
      ) : (
        <>
          <Text style={TabsStyles.selectCategoryLabel}>
            Select New Category:
          </Text>
          {getEligibleCategories().map(category => (
            <TouchableOpacity
              key={category.value}
              style={[
                TabsStyles.categoryOption,
                selectedCategory === category.value &&
                  TabsStyles.categoryOptionSelected,
              ]}
              onPress={() => setSelectedCategory(category.value)}>
              <Text
                style={[
                  TabsStyles.categoryOptionText,
                  selectedCategory === category.value &&
                    TabsStyles.categoryOptionTextSelected,
                ]}>
                {category.label}
              </Text>
              {category.requiresDoc && (
                <Text style={TabsStyles.categoryRequirement}>
                  *{' '}
                  {category.description ||
                    `Requires ${
                      category.value === 'senior' ? 'Senior ID' : 'School ID'
                    }`}
                </Text>
              )}
            </TouchableOpacity>
          ))}

          {selectedCategoryInfo?.requiresDoc && (
            <View style={TabsStyles.documentUploadSection}>
              <Text style={TabsStyles.documentUploadLabel}>
                Upload{' '}
                {selectedCategory === 'senior'
                  ? 'Senior Citizen ID or Government ID'
                  : 'School ID'}
                :
              </Text>

              {supportingDocument.imageUrl ? (
                <View style={TabsStyles.documentPreview}>
                  <Image
                    source={{uri: supportingDocument.imageUrl}}
                    style={TabsStyles.documentImage}
                    resizeMode="contain"
                  />
                  <View style={styles.documentButtonRow}>
                    <Button
                      mode="outlined"
                      onPress={pickImage}
                      style={TabsStyles.changeDocumentButton}>
                      Gallery
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={takePicture}
                      style={TabsStyles.changeDocumentButton}>
                      Camera
                    </Button>
                  </View>
                </View>
              ) : (
                <View style={styles.documentButtonRow}>
                  <Button
                    mode="outlined"
                    onPress={pickImage}
                    style={TabsStyles.uploadDocumentButton}>
                    Gallery
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={takePicture}
                    style={TabsStyles.uploadDocumentButton}>
                    Camera
                  </Button>
                </View>
              )}
            </View>
          )}

          <View style={TabsStyles.modalButtonRow}>
            <Button
              mode="outlined"
              style={TabsStyles.modalCancelButton}
              onPress={onDismiss}
              disabled={loading}>
              Cancel
            </Button>
            <Button
              mode="contained"
              style={TabsStyles.modalSubmitButton}
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}>
              Submit
            </Button>
          </View>
        </>
      )}
    </Modal>
  );
};

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

const ProfileInfoScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const {userToken} = useAuth();
  const {profileData, loading, updateProfile, refreshProfile} = useProfile();
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryChangeLoading, setCategoryChangeLoading] = useState(false);

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

  const handleCategoryChange = async (changeRequest: CategoryChangeRequest) => {
    try {
      setCategoryChangeLoading(true);

      const formData = new FormData();
      formData.append('requestedCategory', changeRequest.requestedCategory);

      if (changeRequest.supportingDocument) {
        const uriParts = changeRequest.supportingDocument.imageUrl.split('.');
        const fileType = uriParts[uriParts.length - 1];

        formData.append('supportingDocument', {
          uri: changeRequest.supportingDocument.imageUrl,
          name: `supporting_document.${fileType}`,
          type: changeRequest.supportingDocument.mimeType,
        } as any);
      }

      const response = await fetch(
        `${BACKEND_URL}/api/users/change-category/${profileData?._id}`,
        {
          method: 'POST',
          body: formData,
          headers: {
            Authorization: `Bearer ${userToken}`,
            'Content-Type': 'multipart/form-data',
          },
        },
      );

      const responseData = await response.json();

      if (response.ok) {
        Alert.alert(
          'Request Submitted',
          "Your category change request has been submitted for review. You will be notified once it's processed.",
          [{text: 'OK', onPress: () => setShowCategoryModal(false)}],
        );
        refreshProfile(); // Refresh profile data
      } else {
        throw new Error(responseData?.error || 'Failed to submit request');
      }
    } catch (error) {
      console.error('Category change error:', error);
      Alert.alert(
        'Error',
        'Failed to submit category change request. Please try again.',
      );
    } finally {
      setCategoryChangeLoading(false);
    }
  };

  const handleSchoolIdUpload = async () => {
    try {
      const options: ImageLibraryOptions = {
        mediaType: 'photo',
        includeBase64: false,
        maxHeight: 2000,
        maxWidth: 2000,
        quality: 1,
      };

      launchImageLibrary(options, async (result: ImagePickerResponse) => {
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

  const takePicture = async () => {
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
          <View style={TabsStyles.avatarWrapper}>
            <TouchableOpacity
              style={TabsStyles.avatarContainerModern}
              onPress={takePicture}
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
            </TouchableOpacity>
            {!uploadingImage && !isProfileImagePending() && (
              <View style={TabsStyles.editAvatarFloatingIcon}>
                <IconButton
                  icon="pencil"
                  size={20}
                  iconColor={Colors.primary}
                  style={TabsStyles.editAvatarIconButton}
                  onPress={takePicture}
                />
              </View>
            )}
          </View>
        </View>
        {/* School ID Validation Reminder */}
        <SchoolIdValidationReminder
          user={passengerProfile}
          onUpload={handleSchoolIdUpload}
        />
        {/* Senior Eligibility Reminder */}
        <SeniorEligibilityReminder
          user={passengerProfile}
          onChangeCategoryPress={() => setShowCategoryModal(true)}
          onDismissNotification={handleDismissSeniorNotification}
        />
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
                <Divider style={TabsStyles.divider} />
                <View
                  style={[
                    TabsStyles.infoRow,
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    },
                  ]}>
                  <View>
                    <Text style={TabsStyles.infoLabel}>Category</Text>
                    <Text style={[TabsStyles.infoValue, {color: '#666'}]}>
                      {passengerProfile.passengerCategory
                        ?.charAt(0)
                        .toUpperCase() +
                        passengerProfile.passengerCategory?.slice(1) ||
                        'Not set'}
                    </Text>
                  </View>
                  <Button
                    mode="text"
                    compact
                    onPress={() => setShowCategoryModal(true)}
                    style={TabsStyles.changeCategoryButton}
                    labelStyle={{fontSize: 13, color: Colors.primary}}>
                    Change
                  </Button>
                </View>
              </>
            )}
          </Card.Content>
        </Card>
        {/* Category Change Modal */}
        <CategoryChangeModal
          visible={showCategoryModal}
          onDismiss={() => setShowCategoryModal(false)}
          currentCategory={passengerProfile.passengerCategory}
          age={passengerProfile.age}
          onSubmit={handleCategoryChange}
          loading={categoryChangeLoading}
        />
        <View style={{height: insets.bottom}} />
      </ScrollView>
    </View>
  );
};

export default ProfileInfoScreen;
