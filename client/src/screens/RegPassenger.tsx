import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
  Linking,
} from 'react-native';
import {Button, ProgressBar, List} from 'react-native-paper';
import {
  launchImageLibrary,
  launchCamera,
  ImagePickerResponse,
  Asset,
  PhotoQuality,
  ImageLibraryOptions,
} from 'react-native-image-picker';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import ImageResizer from 'react-native-image-resizer';
import api from '../../utils/api';
import {styles} from '../styles/RegistrationStyles';
import DateTimePicker from '@react-native-community/datetimepicker';

interface HomeAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Helper function to compress images
const compressImage = async (uri: string, quality: number, maxSize: number) => {
  try {
    // Extract file extension
    const extension = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';

    // Resize and compress the image
    const result = await ImageResizer.createResizedImage(
      uri,
      maxSize,
      maxSize,
      extension === 'png' ? 'PNG' : 'JPEG',
      quality * 100,
      0,
    );

    return {
      uri: result.uri,
      mime: mimeType,
    };
  } catch (error) {
    console.error('Error compressing image:', error);
    // Return original if compression fails
    return {
      uri,
      mime: 'image/jpeg',
    };
  }
};

const RegisterPassengerScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const scrollViewRef = useRef<ScrollView>(null);

  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  const [isLoading, setIsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [personalInfo, setPersonalInfo] = useState({
    lastName: '',
    firstName: '',
    middleInitial: '',
    birthdate: '',
    email: '',
    phone: '',
    passengerCategory: 'regular',
  });

  const [homeAddress, setHomeAddress] = useState<HomeAddress>({
    street: '',
    city: '',
    state: '',
    zipCode: '',
  });

  const [profileImage, setProfileImage] = useState('');
  const [profileImageMime, setProfileImageMime] = useState('');

  const [idDocument, setIdDocument] = useState({
    type: 'valid_id',
    imageUrl: '',
    mimeType: '',
  });

  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
    confirmPassword: '',
  });

  const handlePersonalInfoChange = (
    name: keyof typeof personalInfo,
    value: string,
  ) => {
    setPersonalInfo({...personalInfo, [name]: value});
  };

  const handleAddressChange = (name: keyof HomeAddress, value: string) => {
    setHomeAddress({...homeAddress, [name]: value});
  };

  const handleCredentialsChange = (
    name: keyof typeof credentials,
    value: string,
  ) => {
    setCredentials({...credentials, [name]: value});
  };

  const calculateAge = (birthdate: string): number => {
    const birthDate = new Date(birthdate);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    const currentDate =
      selectedDate ||
      (personalInfo.birthdate ? new Date(personalInfo.birthdate) : new Date());

    // Close picker on Android immediately, keep open on iOS until user interaction
    setShowDatePicker(Platform.OS === 'ios');

    if (selectedDate) {
      const formatted = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD
      handlePersonalInfoChange('birthdate', formatted);
    }
  };

  // Format date for display in the TouchableOpacity
  const formatDateForDisplay = (dateString: string): string => {
    if (!dateString) return 'Select Birthdate';

    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message:
              'This app needs access to your camera to take pictures of your documents',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );

        console.log('Camera permission result:', granted);
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Camera permission error:', err);
        return false;
      }
    } else {
      return true;
    }
  };

  const pickImage = async (isIdDocument?: boolean) => {
    try {
      const options: ImageLibraryOptions = {
        mediaType: 'photo',
        includeBase64: false,
        maxHeight: 2000,
        maxWidth: 2000,
        quality: 1,
      };

      const result = await launchImageLibrary(options);

      if (result.didCancel) {
        return;
      }

      if (result.errorCode) {
        throw new Error(result.errorMessage);
      }

      if (result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];

        const compressed = await compressImage(
          selectedAsset.uri || '',
          0.5,
          isIdDocument ? 1200 : 600,
        );

        if (isIdDocument) {
          setIdDocument({
            ...idDocument,
            imageUrl: compressed.uri,
            mimeType: compressed.mime,
          });
        } else {
          setProfileImage(compressed.uri);
          setProfileImageMime(compressed.mime);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takePicture = async (isIdDocument?: boolean) => {
    try {
      // Request camera permission first
      const hasPermission = await requestCameraPermission();

      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'Camera permission is required to take pictures. Please enable it in your device settings.',
          [
            {text: 'Cancel', style: 'cancel'},
            {
              text: 'Open Settings',
              onPress: () => {
                // For Android, you can open app settings
                if (Platform.OS === 'android') {
                  Linking.openSettings();
                }
              },
            },
          ],
        );
        return;
      }

      const options = {
        mediaType: 'photo' as const,
        includeBase64: false,
        maxHeight: 2000,
        maxWidth: 2000,
        quality: 1 as PhotoQuality,
        saveToPhotos: false,
        // Add these options for better camera handling
        storageOptions: {
          skipBackup: true,
          path: 'images',
        },
      };

      launchCamera(options, result => {
        if (result.didCancel) {
          console.log('User cancelled camera');
          return;
        }

        if (result.errorCode) {
          console.error('Camera Error:', result.errorMessage);
          Alert.alert(
            'Camera Error',
            result.errorMessage || 'Failed to capture image. Please try again.',
          );
          return;
        }

        if (result.assets && result.assets.length > 0) {
          const selectedAsset = result.assets[0];

          if (!selectedAsset.uri) {
            Alert.alert('Error', 'Failed to capture image. Please try again.');
            return;
          }

          // Process the image
          compressImage(selectedAsset.uri, 0.5, isIdDocument ? 1200 : 600)
            .then(compressed => {
              if (isIdDocument) {
                setIdDocument({
                  ...idDocument,
                  imageUrl: compressed.uri,
                  mimeType: compressed.mime,
                });
              } else {
                setProfileImage(compressed.uri);
                setProfileImageMime(compressed.mime);
              }
            })
            .catch(error => {
              console.error('Error compressing image:', error);
              Alert.alert(
                'Error',
                'Failed to process image. Please try again.',
              );
            });
        }
      });
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to capture image. Please try again.');
    }
  };

  const validatePersonalInfo = () => {
    const {
      lastName,
      firstName,
      middleInitial,
      birthdate,
      email,
      phone,
      passengerCategory,
    } = personalInfo;

    if (
      !lastName ||
      !firstName ||
      !middleInitial ||
      !birthdate ||
      !email ||
      !phone ||
      !passengerCategory
    ) {
      Alert.alert(
        'Validation Error',
        'All personal information fields are required.',
      );
      return false;
    }

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      Alert.alert('Validation Error', 'Invalid email format.');
      return false;
    }

    const phoneRegex = /^\d{10,15}$/;
    if (!phoneRegex.test(phone)) {
      Alert.alert('Validation Error', 'Invalid phone number format.');
      return false;
    }

    // Validate birthdate and age
    const age = calculateAge(birthdate);
    if (age < 13) {
      Alert.alert(
        'Validation Error',
        'You must be at least 13 years old to register.',
      );
      return false;
    }

    // Check if passenger category matches age
    if (passengerCategory === 'student' && age > 25) {
      Alert.alert(
        'Validation Error',
        'Student category is only available for users 25 years old and below.',
      );
      return false;
    }

    if (passengerCategory === 'senior' && age < 60) {
      Alert.alert(
        'Validation Error',
        'Senior category is only available for users 60 years old and above.',
      );
      return false;
    }

    return true;
  };

  const validateAddress = () => {
    const {street, city, state, zipCode} = homeAddress;

    if (!street || !city || !state || !zipCode) {
      Alert.alert('Validation Error', 'All address fields are required.');
      return false;
    }

    return true;
  };

  const checkExistingUser = async () => {
    try {
      setIsLoading(true);

      const response = await api.post('/api/auth/check-user', {
        email: personalInfo.email,
        phone: personalInfo.phone,
        username: credentials.username,
      });

      setIsLoading(false);

      // Check if response is successful (200 status)
      if (response.status === 200) {
        // User information is available, no conflicts
        return true;
      }

      if (response.status === 409) {
        const data = response.data;
        if (data.field === 'email') {
          Alert.alert(
            'Already Registered',
            'This email address is already registered.',
          );
          return false;
        } else if (data.field === 'phone') {
          Alert.alert(
            'Already Registered',
            'This phone number is already registered.',
          );
          return false;
        } else if (data.field === 'username' && currentStep === 4) {
          Alert.alert(
            'Username Taken',
            'This username is already taken. Please choose another one.',
          );
          return false;
        }
      }

      // Handle other error responses
      Alert.alert(
        'Error',
        response.data?.error || 'Failed to check user information',
      );
      return false;
    } catch (error: any) {
      setIsLoading(false);
      console.error('Error checking existing user:', error);
      // Handle different types of errors
      if (error.response) {
        // Server responded with error status
        const {status, data} = error.response;

        if (status === 409) {
          // Handle conflict responses in catch block too
          if (data.field === 'email') {
            Alert.alert(
              'Already Registered',
              'This email address is already registered.',
            );
          } else if (data.field === 'phone') {
            Alert.alert(
              'Already Registered',
              'This phone number is already registered.',
            );
          } else if (data.field === 'username' && currentStep === 4) {
            Alert.alert(
              'Username Taken',
              'This username is already taken. Please choose another one.',
            );
          }
          return false;
        }

        Alert.alert('Error', data?.error || 'Failed to check user information');
      } else if (error.request) {
        // Network error
        Alert.alert(
          'Network Error',
          'Could not check if user already exists. Please check your connection.',
        );
      } else {
        // Other error
        Alert.alert('Error', 'An unexpected error occurred.');
      }
      return false;
    }
  };

  const validateProfileAndId = () => {
    if (!profileImage) {
      Alert.alert(
        'Profile Image Required',
        'Please upload a profile photo to continue.',
      );
      return false;
    }

    if (!idDocument.imageUrl) {
      Alert.alert(
        'ID Document Required',
        'Please upload your ID document to continue.',
      );
      return false;
    }

    return true;
  };

  const validateCredentials = () => {
    const {username, password, confirmPassword} = credentials;

    if (!username || !password || !confirmPassword) {
      Alert.alert('Validation Error', 'All credential fields are required.');
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match.');
      return false;
    }

    if (password.length < 6) {
      Alert.alert(
        'Validation Error',
        'Password must be at least 6 characters long.',
      );
      return false;
    }

    return true;
  };

  const nextStep = async () => {
    let isValid = false;

    switch (currentStep) {
      case 1:
        isValid = validatePersonalInfo();
        if (isValid) {
          const userAvailable = await checkExistingUser();
          if (!userAvailable) return;
        }
        break;
      case 2:
        isValid = validateAddress();
        break;
      case 3:
        isValid = validateProfileAndId();
        break;
      case 4:
        isValid = validateCredentials();
        if (isValid) {
          const usernameAvailable = await checkExistingUser();
          if (!usernameAvailable) return;
          handleSubmit();
          return;
        }
        break;
      default:
        isValid = true;
    }

    if (isValid) {
      setCurrentStep(prevStep => prevStep + 1);
      scrollViewRef.current?.scrollTo({y: 0, animated: true});
    }
  };

  const prevStep = () => {
    setCurrentStep(prevStep => Math.max(1, prevStep - 1));
    scrollViewRef.current?.scrollTo({y: 0, animated: true});
  };

  const handleSubmit = async () => {
    try {
      setIsLoading(true);

      const formData = new FormData();
      const age = calculateAge(personalInfo.birthdate);

      // Add basic information
      formData.append('lastName', personalInfo.lastName);
      formData.append('firstName', personalInfo.firstName);
      formData.append('middleInitial', personalInfo.middleInitial);
      formData.append('birthdate', personalInfo.birthdate);
      formData.append('age', age.toString());
      formData.append('username', credentials.username);
      formData.append('email', personalInfo.email);
      formData.append('phone', personalInfo.phone);
      formData.append('password', credentials.password);
      formData.append('role', 'passenger');
      formData.append('passengerCategory', personalInfo.passengerCategory);

      // Add home address
      formData.append('homeAddress', JSON.stringify(homeAddress));

      // Add profile image
      if (profileImage) {
        const uriParts = profileImage.split('.');
        const fileType = uriParts[uriParts.length - 1];

        formData.append('profileImage', {
          uri:
            Platform.OS === 'android'
              ? profileImage
              : profileImage.replace('file://', ''),
          name: `profile.${fileType}`,
          type: profileImageMime || `image/${fileType}`,
        } as any);
      }

      // Add ID document
      if (idDocument.imageUrl) {
        const uriParts = idDocument.imageUrl.split('.');
        const fileType = uriParts[uriParts.length - 1];

        formData.append(
          'idDocument',
          JSON.stringify({
            type: idDocument.type,
          }),
        );

        formData.append('idDocumentImage', {
          uri:
            Platform.OS === 'android'
              ? idDocument.imageUrl
              : idDocument.imageUrl.replace('file://', ''),
          name: `id_document.${fileType}`,
          type: idDocument.mimeType || `image/${fileType}`,
        } as any);
      }

      const response = await api.postForm('/api/auth/register', formData);

      setIsLoading(false);

      if (response.status >= 200 && response.status < 300) {
        Alert.alert(
          'Registration Successful',
          'Your account has been created successfully. You can now log in and start booking rides!',
          [{text: 'OK', onPress: () => navigation.navigate('Login')}],
        );
      } else {
        Alert.alert('Error', response.data?.error || 'Registration failed');
      }
    } catch (error) {
      setIsLoading(false);
      console.error('Registration error:', error);
      Alert.alert('Error', 'Network error. Please check your connection.');
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Step 1: Personal Information</Text>
            <TextInput
              style={styles.input}
              placeholder="Last Name"
              value={personalInfo.lastName}
              onChangeText={value =>
                handlePersonalInfoChange('lastName', value)
              }
            />
            <TextInput
              style={styles.input}
              placeholder="First Name"
              value={personalInfo.firstName}
              onChangeText={value =>
                handlePersonalInfoChange('firstName', value)
              }
            />
            <TextInput
              style={styles.input}
              placeholder="Middle Initial"
              value={personalInfo.middleInitial}
              onChangeText={value =>
                handlePersonalInfoChange('middleInitial', value)
              }
            />
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={[styles.input, styles.datePickerButton]}>
              <Text
                style={{
                  color: personalInfo.birthdate ? '#000' : '#999',
                  fontSize: 16,
                }}>
                {formatDateForDisplay(personalInfo.birthdate)}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={
                  personalInfo.birthdate
                    ? new Date(personalInfo.birthdate)
                    : new Date()
                }
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                maximumDate={new Date()} // prevent future dates
                minimumDate={new Date(1900, 0, 1)} // reasonable minimum date
                onChange={handleDateChange}
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="Email"
              keyboardType="email-address"
              value={personalInfo.email}
              onChangeText={value => handlePersonalInfoChange('email', value)}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              keyboardType="phone-pad"
              value={personalInfo.phone}
              onChangeText={value => handlePersonalInfoChange('phone', value)}
            />

            <List.Accordion
              title={`Passenger Category: ${personalInfo.passengerCategory}`}
              style={styles.dropdown}>
              {['regular', 'student', 'senior'].map(category => (
                <List.Item
                  key={category}
                  title={category.charAt(0).toUpperCase() + category.slice(1)}
                  onPress={() => {
                    handlePersonalInfoChange('passengerCategory', category);
                  }}
                />
              ))}
            </List.Accordion>

            <Text style={styles.categoryInfo}>
              • Regular: Standard passenger rates
              {'\n'}• Student: Discounted rates (25 years old and below)
              {'\n'}• Senior: Discounted rates (60 years old and above)
            </Text>

            <Button
              mode="contained"
              style={styles.button}
              onPress={nextStep}
              loading={isLoading}
              disabled={isLoading}>
              {isLoading ? 'Checking...' : 'Next'}
            </Button>
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Step 2: Home Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Street Address"
              value={homeAddress.street}
              onChangeText={value => handleAddressChange('street', value)}
            />
            <TextInput
              style={styles.input}
              placeholder="City"
              value={homeAddress.city}
              onChangeText={value => handleAddressChange('city', value)}
            />
            <TextInput
              style={styles.input}
              placeholder="State/Province"
              value={homeAddress.state}
              onChangeText={value => handleAddressChange('state', value)}
            />
            <TextInput
              style={styles.input}
              placeholder="ZIP/Postal Code"
              value={homeAddress.zipCode}
              onChangeText={value => handleAddressChange('zipCode', value)}
            />
            <View style={styles.buttonRow}>
              <Button
                mode="outlined"
                style={styles.halfButton}
                onPress={prevStep}>
                Back
              </Button>
              <Button
                mode="contained"
                style={styles.halfButton}
                onPress={nextStep}>
                Next
              </Button>
            </View>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Step 3: Upload Photos</Text>
            <Text style={styles.stepInstructions}>
              Please upload a profile photo and your ID document for
              verification.
            </Text>

            {/* Profile Photo Section */}
            <View style={styles.profileImageContainer}>
              <Text style={styles.documentLabel}>Profile Photo</Text>
              {profileImage ? (
                <View style={styles.profilePreviewContainer}>
                  <Image
                    source={{uri: profileImage}}
                    style={styles.profilePreview}
                    resizeMode="cover"
                  />
                  <View style={styles.documentButtonRow}>
                    <Button
                      mode="outlined"
                      onPress={() => pickImage()}
                      style={styles.documentButton}>
                      Change Photo
                    </Button>
                  </View>
                </View>
              ) : (
                <View>
                  <View style={styles.emptyProfileContainer}>
                    <Text style={styles.emptyProfileText}>No Photo</Text>
                  </View>
                  <View style={styles.documentButtonRow}>
                    <Button
                      mode="outlined"
                      onPress={() => pickImage()}
                      style={styles.documentButton}
                      icon="folder">
                      Gallery
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={() => takePicture()}
                      style={styles.documentButton}
                      icon="camera">
                      Camera
                    </Button>
                  </View>
                </View>
              )}
            </View>

            {/* ID Document Section */}
            <View style={styles.documentItem}>
              <Text style={styles.documentLabel}>ID Document</Text>
              <List.Accordion
                title={`ID Type: ${idDocument.type.replace('_', ' ')}`}
                style={styles.dropdown}>
                {['school_id', 'senior_id', 'valid_id', 'drivers_license'].map(
                  type => (
                    <List.Item
                      key={type}
                      title={type.replace('_', ' ').toUpperCase()}
                      onPress={() => {
                        setIdDocument({...idDocument, type});
                      }}
                    />
                  ),
                )}
              </List.Accordion>
              {idDocument.imageUrl ? (
                <View style={styles.documentPreviewContainer}>
                  <Image
                    source={{uri: idDocument.imageUrl}}
                    style={styles.documentPreview}
                    resizeMode="contain"
                  />
                  <View style={styles.documentButtonRow}>
                    <Button
                      mode="outlined"
                      onPress={() => pickImage(true)}
                      style={styles.documentButton}>
                      Change
                    </Button>
                  </View>
                </View>
              ) : (
                <View style={styles.documentButtonRow}>
                  <Button
                    mode="outlined"
                    onPress={() => pickImage(true)}
                    style={styles.documentButton}
                    icon="folder">
                    Gallery
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() => takePicture(true)}
                    style={styles.documentButton}
                    icon="camera">
                    Camera
                  </Button>
                </View>
              )}
            </View>

            <Text style={styles.tipsText}>
              Tips for good photos:
              {'\n'}• Ensure good lighting
              {'\n'}• Capture the entire document
              {'\n'}• Make sure text is readable
              {'\n'}• Avoid glare or shadows
            </Text>

            <View style={styles.buttonRow}>
              <Button
                mode="outlined"
                style={styles.halfButton}
                onPress={prevStep}>
                Back
              </Button>
              <Button
                mode="contained"
                style={styles.halfButton}
                onPress={nextStep}>
                Next
              </Button>
            </View>
          </View>
        );
      case 4:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Step 4: Create Account</Text>
            <TextInput
              style={styles.input}
              placeholder="Username"
              value={credentials.username}
              onChangeText={value => handleCredentialsChange('username', value)}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              secureTextEntry
              value={credentials.password}
              onChangeText={value => handleCredentialsChange('password', value)}
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              secureTextEntry
              value={credentials.confirmPassword}
              onChangeText={value =>
                handleCredentialsChange('confirmPassword', value)
              }
            />

            <View style={styles.infoContainer}>
              <Text style={styles.infoTitle}>Welcome to BaoBao!</Text>
              <Text style={styles.infoText}>
                Once your account is created, you'll be able to:
                {'\n'}• Book rides instantly
                {'\n'}• Track your driver in real-time
                {'\n'}• Save favorite locations
                {'\n'}• Rate and review your trips
                {'\n'}• Enjoy convenient cashless payments
              </Text>
              <Text style={styles.infoNote}>
                Your account will be activated immediately after registration.
              </Text>
            </View>

            <View style={styles.buttonRow}>
              <Button
                mode="outlined"
                style={styles.halfButton}
                onPress={prevStep}>
                Back
              </Button>
              <Button
                mode="contained"
                style={styles.halfButton}
                onPress={nextStep}
                loading={isLoading}
                disabled={isLoading}>
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <ScrollView
      ref={scrollViewRef}
      contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>Register as Passenger</Text>

        <View style={styles.progressContainer}>
          <ProgressBar
            progress={currentStep / totalSteps}
            color="#3498db"
            style={styles.progressBar}
          />
          <Text style={styles.progressText}>
            Step {currentStep} of {totalSteps}
          </Text>
        </View>

        {renderStepContent()}

        <Button
          mode="text"
          onPress={() => navigation.navigate('RegisterSelection')}
          disabled={isLoading}>
          Cancel Registration
        </Button>
      </View>
    </ScrollView>
  );
};

export default RegisterPassengerScreen;
