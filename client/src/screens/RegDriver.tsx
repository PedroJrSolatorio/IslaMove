import React, {useState, useRef, useEffect} from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import {jwtDecode} from 'jwt-decode';

interface CustomJwtPayload {
  isTemp?: boolean;
  // Add other fields you might expect from the token
  [key: string]: any;
}

interface VehicleInfo {
  make: string;
  series: string;
  yearModel: string;
  color: string;
  type: string;
  plateNumber: string;
  bodyNumber: string;
}

interface DocumentInfo {
  documentType: string;
  fileURL: string;
  mimeType?: string;
  verified: boolean;
  uploadDate: Date;
}

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

const RegisterDriverScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const scrollViewRef = useRef<ScrollView>(null);
  const [isGoogleUser, setIsGoogleUser] = useState(false);
  const [googleUserData, setGoogleUserData] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;
  const [isLoading, setIsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Check if user came from Google Sign-Up
  useEffect(() => {
    const checkGoogleUser = async () => {
      try {
        // Check if there's a temp token from Google signup
        const tempToken = await AsyncStorage.getItem('tempToken');
        if (tempToken) {
          const decoded = jwtDecode<CustomJwtPayload>(tempToken);
          if (decoded && !decoded.isProfileComplete) {
            setIsGoogleUser(true);
            // Pre-populate with Google data
            const userData = await AsyncStorage.getItem('googleUserData');
            if (userData) {
              const parsedData = JSON.parse(userData);
              setGoogleUserData(parsedData);
              // Pre-populate personal info with Google data
              setPersonalInfo(prev => {
                const updatedPersonalInfo = {
                  ...prev, // Keep existing values for fields not explicitly provided by Google
                  firstName: parsedData.firstName || '',
                  lastName: parsedData.lastName || '',
                  email: parsedData.email || '',
                };

                // Log the update to debug
                console.log(
                  'Pre-filling personalInfo with Google data:',
                  updatedPersonalInfo,
                );
                return updatedPersonalInfo;
              });

              // Profile image from Google (if available)
              if (parsedData.picture || parsedData.profileImage) {
                setProfileImage(parsedData.picture || parsedData.profileImage);
                setProfileImageMime('image/jpeg'); // Default mime type for Google images
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking Google user:', error);
      }
    };

    checkGoogleUser();
  }, []);

  const [personalInfo, setPersonalInfo] = useState({
    lastName: '',
    firstName: '',
    middleInitial: '',
    birthdate: '',
    email: '',
    phone: '',
    licenseNumber: '',
  });

  const [homeAddress, setHomeAddress] = useState<HomeAddress>({
    street: '',
    city: '',
    state: '',
    zipCode: '',
  });

  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo>({
    make: '',
    series: '',
    yearModel: '',
    color: '',
    type: 'bao-bao',
    plateNumber: '',
    bodyNumber: '',
  });

  const [profileImage, setProfileImage] = useState('');
  const [profileImageMime, setProfileImageMime] = useState('');

  const [idDocument, setIdDocument] = useState({
    type: 'drivers_license',
    imageUrl: '',
    mimeType: '',
  });

  const [documents, setDocuments] = useState<DocumentInfo[]>([
    {
      documentType: 'Official Receipt (OR)',
      fileURL: '',
      mimeType: '',
      verified: false,
      uploadDate: new Date(),
    },
    {
      documentType: 'Certificate of Registration (CR)',
      fileURL: '',
      mimeType: '',
      verified: false,
      uploadDate: new Date(),
    },
    {
      documentType: 'MODA Certificate',
      fileURL: '',
      mimeType: '',
      verified: false,
      uploadDate: new Date(),
    },
    {
      documentType: 'Vehicle Photo',
      fileURL: '',
      mimeType: '',
      verified: false,
      uploadDate: new Date(),
    },
  ]);

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

  const handleVehicleChange = (name: keyof VehicleInfo, value: string) => {
    setVehicleInfo({...vehicleInfo, [name]: value});
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

  const pickImage = async (documentType?: string, isIdDocument?: boolean) => {
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
          documentType ? 1200 : 600,
        );

        if (isIdDocument) {
          setIdDocument({
            ...idDocument,
            imageUrl: compressed.uri,
            mimeType: compressed.mime,
          });
        } else if (documentType) {
          const updatedDocuments = documents.map(doc =>
            doc.documentType === documentType
              ? {
                  ...doc,
                  fileURL: compressed.uri,
                  mimeType: compressed.mime,
                  uploadDate: new Date(),
                }
              : doc,
          );
          setDocuments(updatedDocuments);
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

  const takePicture = async (documentType?: string, isIdDocument?: boolean) => {
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
          compressImage(selectedAsset.uri, 0.5, documentType ? 1200 : 600)
            .then(compressed => {
              if (isIdDocument) {
                setIdDocument({
                  ...idDocument,
                  imageUrl: compressed.uri,
                  mimeType: compressed.mime,
                });
              } else if (documentType) {
                const updatedDocuments = documents.map(doc =>
                  doc.documentType === documentType
                    ? {
                        ...doc,
                        fileURL: compressed.uri,
                        mimeType: compressed.mime,
                        uploadDate: new Date(),
                      }
                    : doc,
                );
                setDocuments(updatedDocuments);
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
      licenseNumber,
    } = personalInfo;

    if (
      !lastName ||
      !firstName ||
      !middleInitial ||
      !birthdate ||
      !email ||
      !phone ||
      !licenseNumber
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
    if (age < 18) {
      Alert.alert(
        'Validation Error',
        'You must be at least 18 years old to register as a driver.',
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

      // Step 1: Try getting tempToken (if any)
      const tempToken = await AsyncStorage.getItem('tempToken');
      const headers: any = {
        'Content-Type': 'application/json',
      };

      if (tempToken) {
        headers.Authorization = `Bearer ${tempToken}`;
      }

      // Determine which fields to check based on whether it's a Google user
      const checkData: {
        email?: string;
        phone?: string;
        username?: string;
      } = {};

      // Only include email and phone if it's NOT a Google user OR if it's not pre-filled by Google
      // This assumes Google users will have their email pre-filled and validated from the initial signup
      if (!isGoogleUser || !personalInfo.email) {
        checkData.email = personalInfo.email;
      }
      if (!isGoogleUser || !personalInfo.phone) {
        checkData.phone = personalInfo.phone;
      }

      // Always check username on step 6 regardless of Google user status
      if (currentStep === 6) {
        checkData.username = credentials.username;
      }

      // If no fields are set for checking (e.g., Google user skipping email/phone check), return true directly
      if (Object.keys(checkData).length === 0) {
        setIsLoading(false);
        return true;
      }

      // Step 2: Make request to check-user endpoint
      const response = await api.post('/api/auth/check-user', checkData, {
        headers,
      });

      setIsLoading(false);

      // Step 3: Handle successful response
      if (response.status === 200) {
        return true;
      }

      // Step 4: Handle known conflict
      if (response.status === 409) {
        const data = response.data;

        if (data.field === 'email' && checkData.email) {
          // Only show alert if email was actually checked
          Alert.alert(
            'Already Registered',
            'This email address is already registered.',
          );
        } else if (data.field === 'phone' && checkData.phone) {
          // Only show alert if phone was actually checked
          Alert.alert(
            'Already Registered',
            'This phone number is already registered.',
          );
        } else if (data.field === 'username' && currentStep === 6) {
          Alert.alert(
            'Username Taken',
            'This username is already taken. Please choose another one.',
          );
        } else {
          Alert.alert('Conflict', data.message || 'Conflict with user data.');
        }
        return false;
      }

      Alert.alert(
        'Error',
        response.data?.error || 'Failed to check user information',
      );
      return false;
    } catch (error: any) {
      setIsLoading(false);
      console.error('Error checking existing user:', error);

      if (error.response) {
        const {status, data} = error.response;

        if (status === 409) {
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
          } else if (data.field === 'username' && currentStep === 6) {
            Alert.alert('Username Taken', 'This username is already taken.');
          }
        } else {
          Alert.alert(
            'Error',
            data?.error || 'Failed to check user information',
          );
        }
      } else if (error.request) {
        Alert.alert(
          'Network Error',
          'Could not check user info. Check your connection.',
        );
      } else {
        Alert.alert('Error', 'An unexpected error occurred.');
      }

      return false;
    }
  };

  const validateVehicleInfo = () => {
    const {make, series, yearModel, color, plateNumber, bodyNumber} =
      vehicleInfo;

    if (
      !make ||
      !series ||
      !yearModel ||
      !color ||
      !plateNumber ||
      !bodyNumber
    ) {
      Alert.alert(
        'Validation Error',
        'All vehicle information fields are required.',
      );
      return false;
    }

    const yearValue = parseInt(yearModel);
    if (
      isNaN(yearValue) ||
      yearValue < 1900 ||
      yearValue > new Date().getFullYear() + 1
    ) {
      Alert.alert('Validation Error', 'Please enter a valid vehicle year.');
      return false;
    }

    return true;
  };

  const validateProfileImage = () => {
    if (!profileImage) {
      Alert.alert(
        'Profile Image Required',
        'Please upload a profile photo to continue.',
      );
      return false;
    }
    return true;
  };

  const validateIdDocument = () => {
    if (!idDocument.imageUrl) {
      Alert.alert(
        'ID Document Required',
        'Please upload your ID document to continue.',
      );
      return false;
    }
    return true;
  };

  const validateDocuments = () => {
    const missingDocuments = documents.filter(doc => !doc.fileURL);

    if (missingDocuments.length > 0) {
      Alert.alert(
        'Missing Documents',
        `Please upload all required documents: ${missingDocuments
          .map(doc => doc.documentType)
          .join(', ')}`,
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
        isValid = validateVehicleInfo();
        break;
      case 4:
        isValid = validateProfileImage();
        break;
      case 5:
        isValid = validateIdDocument() && validateDocuments();
        break;
      case 6:
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
      formData.append('email', personalInfo.email);
      formData.append('phone', personalInfo.phone);
      formData.append('role', 'driver');
      formData.append('licenseNumber', personalInfo.licenseNumber);

      // Handle Google vs regular users
      if (isGoogleUser) {
        formData.append('isGoogleUser', 'true');
        // Don't include username/password for Google users
      } else {
        formData.append('username', credentials.username);
        formData.append('password', credentials.password);
        formData.append('isGoogleUser', 'false');
      }

      // Add home address
      formData.append('homeAddress', JSON.stringify(homeAddress));

      // Add vehicle information
      formData.append(
        'vehicle',
        JSON.stringify({
          ...vehicleInfo,
          yearModel: parseInt(vehicleInfo.yearModel),
        }),
      );

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

      // Add documents
      documents.forEach(doc => {
        if (doc.fileURL) {
          const documentFieldName = `document_${doc.documentType.replace(
            /\s+/g,
            '',
          )}`;
          const uriParts = doc.fileURL.split('.');
          const fileType = uriParts[uriParts.length - 1];

          formData.append(documentFieldName, {
            uri:
              Platform.OS === 'android'
                ? doc.fileURL
                : doc.fileURL.replace('file://', ''),
            name: `${doc.documentType
              .toLowerCase()
              .replace(/\s+/g, '_')}.${fileType}`,
            type: doc.mimeType || `image/${fileType}`,
          } as any);
        }
      });

      let requestConfig = {};
      if (isGoogleUser) {
        const tempToken = await AsyncStorage.getItem('tempToken');
        if (!tempToken) {
          throw new Error(
            'Temporary token not found for Google user completion.',
          );
        }
        requestConfig = {
          headers: {
            Authorization: `Bearer ${tempToken}`,
          },
        };
        formData.append('isGoogleUser', 'true');
        // Ensure username is sent if collected in the UI
        if (credentials.username) {
          formData.append('username', credentials.username);
        }
      } else {
        // Only append username/password if not a Google user
        formData.append('username', credentials.username);
        formData.append('password', credentials.password);
        formData.append('isGoogleUser', 'false');
      }
      formData.append('isGoogleUser', String(isGoogleUser)); // Ensure boolean is sent as string

      const endpoint = isGoogleUser
        ? '/api/auth/complete-google-registration'
        : '/api/auth/register';

      const response = await api.postForm(endpoint, formData, requestConfig);

      setIsLoading(false);

      if (response.status >= 200 && response.status < 300) {
        if (isGoogleUser) {
          // Clear temp token and redirect to login
          await AsyncStorage.removeItem('tempToken');
          await AsyncStorage.removeItem('googleUserData');
        }
        Alert.alert(
          'Registration Submitted',
          'Your registration has been submitted for review. You will receive an email confirmation once approved.',
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
            <TextInput
              style={styles.input}
              placeholder="Driver's License Number"
              value={personalInfo.licenseNumber}
              onChangeText={value =>
                handlePersonalInfoChange('licenseNumber', value)
              }
            />
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
            <Text style={styles.stepTitle}>Step 3: Vehicle Information</Text>
            <TextInput
              style={styles.input}
              placeholder="Vehicle Make"
              value={vehicleInfo.make}
              onChangeText={value => handleVehicleChange('make', value)}
            />
            <TextInput
              style={styles.input}
              placeholder="Vehicle Series/Model"
              value={vehicleInfo.series}
              onChangeText={value => handleVehicleChange('series', value)}
            />
            <TextInput
              style={styles.input}
              placeholder="Year Model"
              keyboardType="numeric"
              value={vehicleInfo.yearModel}
              onChangeText={value => handleVehicleChange('yearModel', value)}
            />
            <TextInput
              style={styles.input}
              placeholder="Vehicle Color"
              value={vehicleInfo.color}
              onChangeText={value => handleVehicleChange('color', value)}
            />
            <List.Accordion
              title={`Vehicle Type: ${vehicleInfo.type}`}
              style={styles.dropdown}>
              {['bao-bao'].map(type => (
                <List.Item
                  key={type}
                  title={type}
                  onPress={() => {
                    handleVehicleChange('type', type);
                  }}
                />
              ))}
            </List.Accordion>
            <TextInput
              style={styles.input}
              placeholder="Plate Number"
              value={vehicleInfo.plateNumber}
              onChangeText={value => handleVehicleChange('plateNumber', value)}
            />
            <TextInput
              style={styles.input}
              placeholder="Body Number"
              value={vehicleInfo.bodyNumber}
              onChangeText={value => handleVehicleChange('bodyNumber', value)}
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
      case 4:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Step 4: Profile Photo</Text>
            <Text style={styles.stepInstructions}>
              Please upload a clear profile photo. This will be visible to
              passengers.
            </Text>

            <View style={styles.profileImageContainer}>
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
      case 5:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Step 5: Document Upload</Text>
            <Text style={styles.stepInstructions}>
              Please upload your ID document and verification documents.
            </Text>

            {/* ID Document Section */}
            <View style={styles.documentItem}>
              <Text style={styles.documentLabel}>
                ID Document (Driver's License)
              </Text>
              <List.Accordion
                title={`ID Type: ${idDocument.type.replace('_', ' ')}`}
                style={styles.dropdown}>
                {['school_id', 'senior_id', 'valid_id', 'drivers_license'].map(
                  type => (
                    <List.Item
                      key={type}
                      title={type.replace('_', ' ')}
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
                      onPress={() => pickImage(undefined, true)}
                      style={styles.documentButton}>
                      Change
                    </Button>
                  </View>
                </View>
              ) : (
                <View style={styles.documentButtonRow}>
                  <Button
                    mode="outlined"
                    onPress={() => pickImage(undefined, true)}
                    style={styles.documentButton}
                    icon="folder">
                    Gallery
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() => takePicture(undefined, true)}
                    style={styles.documentButton}
                    icon="camera">
                    Camera
                  </Button>
                </View>
              )}
            </View>

            {/* Driver Documents */}
            {documents.map((doc, index) => (
              <View key={index} style={styles.documentItem}>
                <Text style={styles.documentLabel}>{doc.documentType}</Text>
                {doc.fileURL ? (
                  <View style={styles.documentPreviewContainer}>
                    <Image
                      source={{uri: doc.fileURL}}
                      style={styles.documentPreview}
                      resizeMode="contain"
                    />
                    <View style={styles.documentButtonRow}>
                      <Button
                        mode="outlined"
                        onPress={() => pickImage(doc.documentType)}
                        style={styles.documentButton}>
                        Change
                      </Button>
                    </View>
                  </View>
                ) : (
                  <View style={styles.documentButtonRow}>
                    <Button
                      mode="outlined"
                      onPress={() => pickImage(doc.documentType)}
                      style={styles.documentButton}
                      icon="folder">
                      Gallery
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={() => takePicture(doc.documentType)}
                      style={styles.documentButton}
                      icon="camera">
                      Camera
                    </Button>
                  </View>
                )}
              </View>
            ))}

            <Text style={styles.tipsText}>
              Tips for good document photos:
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
      case 6:
        // Skip credentials step for Google users
        if (isGoogleUser) {
          return (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>
                Step 6: Complete Registration
              </Text>
              <Text style={styles.stepInstructions}>
                You're signing up with Google, so no password is needed.
              </Text>

              <View style={styles.infoContainer}>
                <Text style={styles.infoTitle}>What happens next?</Text>
                <Text style={styles.infoText}>
                  1. Your application will be reviewed by our team
                  {'\n'}2. We'll verify all your documents
                  {'\n'}3. You'll receive an email notification once approved
                  {'\n'}4. After approval, you can log in with Google and start
                  accepting rides
                </Text>
                <Text style={styles.infoNote}>
                  The verification process typically takes 1-3 business days.
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
                  onPress={handleSubmit}
                  loading={isLoading}
                  disabled={isLoading}>
                  {isLoading ? 'Submitting...' : 'Submit'}
                </Button>
              </View>
            </View>
          );
        }

        // Regular credentials step for non-Google users
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Step 6: Create Account</Text>
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
              <Text style={styles.infoTitle}>What happens next?</Text>
              <Text style={styles.infoText}>
                1. Your application will be reviewed by our team
                {'\n'}2. We'll verify all your documents
                {'\n'}3. You'll receive an email notification once approved
                {'\n'}4. After approval, you can log in and start accepting
                rides
              </Text>
              <Text style={styles.infoNote}>
                The verification process typically takes 1-3 business days.
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
                {isLoading ? 'Submitting...' : 'Submit'}
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
        <Text style={styles.title}>Register as Driver</Text>

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

export default RegisterDriverScreen;
