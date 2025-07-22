import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  Alert,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
  Linking,
  StatusBar,
} from 'react-native';
import {Button, ProgressBar, List, TextInput} from 'react-native-paper';
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
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {GoogleSignin} from '@react-native-google-signin/google-signin';

interface CustomJwtPayload {
  isTemp?: boolean;
  // Add other fields you might expect from the token
  [key: string]: any;
}

interface HomeAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

interface ParentInfo {
  userId?: any;
  consentGiven?: boolean;
  consentDate?: string;
  email: string;
  firstName: string;
  lastName: string;
  relationship: string;
  password: string;
  isExistingUser: boolean;
  consentMethod?: 'password_verification' | 'google_oauth';
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
  const [isGoogleUser, setIsGoogleUser] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  const [isLoading, setIsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const insets = useSafeAreaInsets();
  const [parentConsent, setParentConsent] = useState<{
    given: boolean;
    parentInfo: ParentInfo | null;
  }>({
    given: false,
    parentInfo: null,
  });
  const [birthCertificate, setBirthCertificate] = useState<{
    imageUrl: string;
    mimeType: string;
  }>({
    imageUrl: '',
    mimeType: '',
  });

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

  const pickImage = async (
    imageType?: 'profile' | 'idDocument' | 'birthCertificate',
  ) => {
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

        // Determine compression settings based on image type
        let quality = 0.5;
        let maxSize = 600; // default for profile

        if (imageType === 'idDocument' || imageType === 'birthCertificate') {
          maxSize = 1200; // higher quality for documents
        }

        const compressed = await compressImage(
          selectedAsset.uri || '',
          quality,
          maxSize,
        );

        // Set the appropriate state based on image type
        switch (imageType) {
          case 'idDocument':
            setIdDocument({
              ...idDocument,
              imageUrl: compressed.uri,
              mimeType: compressed.mime,
            });
            break;
          case 'birthCertificate':
            setBirthCertificate({
              imageUrl: compressed.uri,
              mimeType: compressed.mime,
            });
            break;
          case 'profile':
          default:
            setProfileImage(compressed.uri);
            setProfileImageMime(compressed.mime);
            break;
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takePicture = async (
    imageType?: 'profile' | 'idDocument' | 'birthCertificate',
  ) => {
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

          // Determine compression settings based on image type
          let quality = 0.5;
          let maxSize = 600; // default for profile

          if (imageType === 'idDocument' || imageType === 'birthCertificate') {
            maxSize = 1200; // higher quality for documents
          }

          // Process the image
          compressImage(selectedAsset.uri, quality, maxSize)
            .then(compressed => {
              // Set the appropriate state based on image type
              switch (imageType) {
                case 'idDocument':
                  setIdDocument({
                    ...idDocument,
                    imageUrl: compressed.uri,
                    mimeType: compressed.mime,
                  });
                  break;
                case 'birthCertificate':
                  setBirthCertificate({
                    imageUrl: compressed.uri,
                    mimeType: compressed.mime,
                  });
                  break;
                case 'profile':
                default:
                  setProfileImage(compressed.uri);
                  setProfileImageMime(compressed.mime);
                  break;
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
    if (age < 12) {
      Alert.alert(
        'Validation Error',
        'You must be at least 12 years old to register.',
      );
      return false;
    }

    // Special validation for minors (under 18)
    if (age < 18 && !parentConsent.given) {
      Alert.alert(
        'Parental Consent Required',
        'Since you are under 18 years old, parental consent is required to proceed.',
      );
      return false;
    }

    // Check birth certificate for 12-year-olds
    if (age === 12 && !birthCertificate.imageUrl) {
      Alert.alert(
        'Birth Certificate Required',
        'A birth certificate is required for 12-year-old registration. This document will be deleted after verification for privacy protection.',
      );
      return false;
    }

    // Auto-assign student_child category for 12-year-olds
    if (age === 12) {
      setPersonalInfo(prev => ({
        ...prev,
        passengerCategory: 'student_child',
      }));
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

      const response = await api.post('/api/auth/check-user', checkData, {
        headers,
      });

      setIsLoading(false);

      if (response.status === 200) {
        return true;
      }

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

  const ParentGuardianConsent = ({
    age,
    onConsentGiven,
  }: {
    age: number;
    onConsentGiven: (granted: boolean) => void;
  }) => {
    const [parentInfo, setParentInfo] = useState({
      email: '',
      firstName: '',
      lastName: '',
      relationship: 'parent',
      password: '',
      isExistingUser: false,
    });
    const [loginMethod, setLoginMethod] = useState('credentials');
    const [isLoading, setIsLoading] = useState(false);

    const handleParentLogin = async () => {
      if (
        !parentInfo.email ||
        !parentInfo.password ||
        !parentInfo.firstName ||
        !parentInfo.lastName
      ) {
        Alert.alert('Error', 'Please fill in all parent/guardian information.');
        return;
      }

      try {
        setIsLoading(true);

        // Verify parent credentials
        const response = await api.post('/api/auth/verify-parent-consent', {
          email: parentInfo.email,
          password: parentInfo.password,
          firstName: parentInfo.firstName,
          lastName: parentInfo.lastName,
          relationship: parentInfo.relationship,
          childAge: age,
        });

        if (response.status === 200) {
          // Parent verified successfully
          setParentConsent({
            given: true,
            parentInfo: {
              ...parentInfo,
              userId: response.data.parentId,
              consentGiven: true,
              consentDate: new Date().toISOString(),
            },
          });

          Alert.alert(
            'Consent Granted',
            'Parental consent has been successfully verified. You may now proceed with registration.',
            [{text: 'OK', onPress: () => onConsentGiven(true)}],
          );
        }
      } catch (error: any) {
        console.error('Parent verification error:', error);
        if (error.response?.status === 404) {
          Alert.alert(
            'Parent Not Found',
            'No account found with these credentials. The parent/guardian needs to create an account first or use Google sign-in.',
          );
        } else if (error.response?.status === 401) {
          Alert.alert('Invalid Credentials', 'Incorrect email or password.');
        } else if (error.response?.status === 403) {
          Alert.alert(
            'Age Requirement Not Met',
            'Parent/guardian must be at least 19 years old to provide consent.',
          );
        } else if (error.response?.status === 400 && error.response?.data?.error?.includes('birthdate')) {
          Alert.alert(
            'Missing Information',
            'Parent/guardian birthdate is required. Please update your profile first.',
          );
        } else {
          Alert.alert(
            'Error',
            'Failed to verify parent credentials. Please try again.',
          );
        }
      } finally {
        setIsLoading(false);
      }
    };

    const handleGoogleParentAuth = async () => {
      try {
        setIsLoading(true);

        if (!parentInfo.firstName?.trim() || !parentInfo.lastName?.trim()) {
          Alert.alert('Missing Info', "Fill out parent's name first.");
          return;
        }

        await GoogleSignin.hasPlayServices();
        await GoogleSignin.signOut();
        const userInfo = await GoogleSignin.signIn();
        const idToken = userInfo.data?.idToken;

        if (!idToken) {
          Alert.alert('Error', 'Failed to get Google authentication token.');
          return;
        }

        // Trigger Google authentication for parent
        const response = await api.post('/api/auth/parent-google-consent', {
          idToken: idToken,
          firstName: parentInfo.firstName,
          lastName: parentInfo.lastName,
          relationship: parentInfo.relationship,
          childAge: age,
        });

        if (response.status === 200) {
          setParentConsent({
            given: true,
            parentInfo: {
              ...parentInfo,
              userId: response.data.parentId,
              email: response.data.parentEmail,
              consentGiven: true,
              consentDate: new Date().toISOString(),
              consentMethod: 'google_oauth',
            },
          });
          Alert.alert(
            'Consent Granted',
            'Parental consent has been successfully verified via Google. You may now proceed with registration.',
            [{text: 'OK', onPress: () => onConsentGiven(true)}],
          );
        }
      } catch (error: any) {
        console.error('Google parent auth error:', error);

        if (error.response?.status === 404) {
          Alert.alert(
            'Parent Not Found',
            'No account found with this Google account. The parent/guardian needs to create an account first.',
          );
        } else if (error.response?.status === 401) {
          Alert.alert(
            'Verification Failed',
            error.response?.data?.error || 'Google authentication failed.',
          );
        } else if (error.response?.status === 403) {
          Alert.alert(
            'Age Requirement Not Met',
            'Parent/guardian must be at least 19 years old to provide consent.',
          );
        } else if (error.response?.status === 400 && error.response?.data?.error?.includes('birthdate')) {
          Alert.alert(
            'Missing Information',
            'Parent/guardian birthdate is required. Please update your profile first.',
          );
        } else {
          Alert.alert(
            'Error',
            'Failed to verify parent credentials via Google. Please try again.',
          );
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Show success message if consent is already granted
    if (parentConsent.given && parentConsent.parentInfo) {
      return (
        <View style={styles.parentConsentContainer}>
          <View style={styles.consentGrantedContainer}>
            <Text style={styles.consentGrantedTitle}>
              ✅ Parent Consent Granted
            </Text>
            <Text style={styles.consentGrantedText}>
              Consent has been successfully verified by:
            </Text>
            <View style={styles.parentInfoDisplay}>
              <Text style={styles.parentInfoText}>
                <Text style={styles.parentInfoLabel}>Name:</Text>{' '}
                {parentConsent.parentInfo.firstName}{' '}
                {parentConsent.parentInfo.lastName}
              </Text>
              <Text style={styles.parentInfoText}>
                <Text style={styles.parentInfoLabel}>Relationship:</Text>{' '}
                {parentConsent.parentInfo.relationship.charAt(0).toUpperCase() +
                  parentConsent.parentInfo.relationship.slice(1)}
              </Text>
              <Text style={styles.parentInfoText}>
                <Text style={styles.parentInfoLabel}>Email:</Text>{' '}
                {parentConsent.parentInfo.email}
              </Text>
              <Text style={styles.parentInfoText}>
                <Text style={styles.parentInfoLabel}>Date:</Text>{' '}
                {new Date(
                  parentConsent.parentInfo.consentDate || '',
                ).toLocaleDateString()}
              </Text>
              {parentConsent.parentInfo.consentMethod && (
                <Text style={styles.parentInfoText}>
                  <Text style={styles.parentInfoLabel}>Method:</Text>{' '}
                  {parentConsent.parentInfo.consentMethod === 'google_oauth'
                    ? 'Google Authentication'
                    : 'Email & Password'}
                </Text>
              )}
            </View>
            <Text style={styles.proceedText}>
              You may now proceed with the registration process.
            </Text>
          </View>
        </View>
      );
    }

    // Show the consent form if consent is not yet granted
    return (
      <View style={styles.parentConsentContainer}>
        <Text style={styles.parentConsentTitle}>Parental Consent Required</Text>
        <Text style={styles.parentConsentText}>
          Since the user is under 18 years old ({age} years), a parent or
          guardian must provide consent.
        </Text>

        {/* Parent/Guardian information form */}
        <TextInput
          mode="outlined"
          label="Parent/Guardian First Name"
          value={parentInfo.firstName}
          onChangeText={value =>
            setParentInfo({...parentInfo, firstName: value})
          }
        />

        <TextInput
          mode="outlined"
          label="Parent/Guardian Last Name"
          value={parentInfo.lastName}
          onChangeText={value =>
            setParentInfo({...parentInfo, lastName: value})
          }
        />

        <List.Accordion
          title={`Relationship: ${parentInfo.relationship}`}
          style={styles.dropdown}>
          {['parent', 'guardian'].map(relationship => (
            <List.Item
              key={relationship}
              title={
                relationship.charAt(0).toUpperCase() + relationship.slice(1)
              }
              onPress={() => {
                setParentInfo({...parentInfo, relationship});
              }}
            />
          ))}
        </List.Accordion>

        {/* Login method selection */}
        <View style={styles.loginMethodContainer}>
          <Text style={styles.loginMethodTitle}>
            Parent/Guardian Login Method:
          </Text>
          <Button
            mode={loginMethod === 'credentials' ? 'contained' : 'outlined'}
            onPress={() => setLoginMethod('credentials')}
            style={styles.loginMethodButton}>
            Email & Password
          </Button>
          <Button
            mode={loginMethod === 'google' ? 'contained' : 'outlined'}
            onPress={() => setLoginMethod('google')}
            style={styles.loginMethodButton}>
            Google Account
          </Button>
        </View>

        {loginMethod === 'credentials' ? (
          <>
            <TextInput
              mode="outlined"
              label="Parent/Guardian Email"
              keyboardType="email-address"
              value={parentInfo.email}
              onChangeText={value =>
                setParentInfo({...parentInfo, email: value})
              }
              style={styles.paperInput}
            />
            <TextInput
              mode="outlined"
              label="Parent/Guardian Password"
              secureTextEntry
              value={parentInfo.password}
              onChangeText={value =>
                setParentInfo({...parentInfo, password: value})
              }
              style={styles.paperInput}
            />
            <Button
              mode="contained"
              onPress={handleParentLogin}
              style={styles.consentButton}
              loading={isLoading}
              disabled={isLoading}>
              {isLoading ? 'Verifying...' : 'Verify & Give Consent'}
            </Button>
          </>
        ) : (
          <Button
            mode="contained"
            onPress={handleGoogleParentAuth}
            style={styles.consentButton}
            loading={isLoading}
            disabled={isLoading}>
            {isLoading
              ? 'Authenticating...'
              : 'Sign in with Google to Give Consent'}
          </Button>
        )}
        <Text style={styles.consentText}>
          * The parent/guardian must have an existing account or create one to
          provide consent.
        </Text>
      </View>
    );
  };

  const BirthCertificateUpload = ({age}: {age: number}) => {
    if (age !== 12) return null;
    return (
      <View style={styles.birthCertificateContainer}>
        <Text style={styles.documentLabel}>
          Birth Certificate (Required for 12-year-olds)
        </Text>
        <Text style={styles.privacyNote}>
          🔒 Privacy Protection: Your birth certificate will be automatically
          deleted after verification for your safety and privacy.
        </Text>

        {birthCertificate.imageUrl ? (
          <View style={styles.documentPreviewContainer}>
            <Image
              source={{uri: birthCertificate.imageUrl}}
              style={styles.documentPreview}
              resizeMode="contain"
            />
            <Text style={styles.uploadedNote}>
              Uploaded – you can change it below
            </Text>
            <View style={styles.documentButtonRow}>
              <Button
                mode="outlined"
                onPress={() => pickImage('birthCertificate')}
                style={styles.documentButton}
                icon="folder">
                Gallery
              </Button>
              <Button
                mode="outlined"
                onPress={() => takePicture('birthCertificate')}
                style={styles.documentButton}
                icon="camera">
                Camera
              </Button>
            </View>
          </View>
        ) : (
          <View style={styles.documentButtonRow}>
            <Button
              mode="outlined"
              onPress={() => pickImage('birthCertificate')}
              style={styles.documentButton}
              icon="folder">
              Gallery
            </Button>
            <Button
              mode="outlined"
              onPress={() => takePicture('birthCertificate')}
              style={styles.documentButton}
              icon="camera">
              Camera
            </Button>
          </View>
        )}
      </View>
    );
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
      formData.append('email', personalInfo.email);
      formData.append('phone', personalInfo.phone);
      formData.append('role', 'passenger');
      formData.append('passengerCategory', personalInfo.passengerCategory);

      // Add parent consent for minors
      if (age < 18 && parentConsent.given) {
        formData.append(
          'parentGuardian',
          JSON.stringify(parentConsent.parentInfo),
        );
      }

      // Add birth certificate for 12-year-olds
      if (age === 12 && birthCertificate.imageUrl) {
        const uriParts = birthCertificate.imageUrl.split('.');
        const fileType = uriParts[uriParts.length - 1];

        formData.append('birthCertificate', {
          uri:
            Platform.OS === 'android'
              ? birthCertificate.imageUrl
              : birthCertificate.imageUrl.replace('file://', ''),
          name: `birth_certificate.${fileType}`,
          type: birthCertificate.mimeType || `image/${fileType}`,
        } as any);
      }

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
      }
      formData.append('isGoogleUser', String(isGoogleUser)); // Ensure boolean is sent as string

      const endpoint = isGoogleUser
        ? '/api/auth/complete-google-registration'
        : '/api/auth/register';

      // Make the API call with the constructed formData and config
      const response = await api.postForm(endpoint, formData, requestConfig);

      setIsLoading(false);

      if (response.status >= 200 && response.status < 300) {
        if (isGoogleUser) {
          // Clear temp token and redirect to login
          await AsyncStorage.removeItem('tempToken');
          await AsyncStorage.removeItem('googleUserData');
        }
        let successMessage = 'Your account has been created successfully!';
        if (age === 12) {
          successMessage +=
            '\n\nNote: Your birth certificate will be deleted after verification for privacy protection.';
        }

        Alert.alert('Registration Successful', successMessage, [
          {text: 'OK', onPress: () => navigation.navigate('Login')},
        ]);
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
              mode="outlined"
              label="Last Name"
              style={styles.paperInput}
              outlineStyle={styles.paperInputOutline}
              contentStyle={styles.paperInputContent}
              value={personalInfo.lastName}
              onChangeText={value =>
                handlePersonalInfoChange('lastName', value)
              }
            />
            <TextInput
              mode="outlined"
              label="First Name"
              style={styles.paperInput}
              outlineStyle={styles.paperInputOutline}
              contentStyle={styles.paperInputContent}
              value={personalInfo.firstName}
              onChangeText={value =>
                handlePersonalInfoChange('firstName', value)
              }
            />
            <TextInput
              mode="outlined"
              maxLength={1}
              label="Middle Initial"
              style={styles.paperInput}
              outlineStyle={styles.paperInputOutline}
              contentStyle={styles.paperInputContent}
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
              mode="outlined"
              label="Email"
              style={styles.paperInput}
              outlineStyle={styles.paperInputOutline}
              contentStyle={styles.paperInputContent}
              keyboardType="email-address"
              value={personalInfo.email}
              onChangeText={value => handlePersonalInfoChange('email', value)}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
            {emailFocused && (
              <Text style={styles.infoText2}>
                * Please use a valid Google account email to ensure you can
                recover your account.
              </Text>
            )}
            <TextInput
              mode="outlined"
              label="Phone Number"
              style={styles.paperInput}
              outlineStyle={styles.paperInputOutline}
              contentStyle={styles.paperInputContent}
              keyboardType="phone-pad"
              value={personalInfo.phone}
              onChangeText={value => handlePersonalInfoChange('phone', value)}
            />

            <List.Accordion
              title={`Passenger Category: ${personalInfo.passengerCategory}`}
              style={styles.dropdown}>
              {['regular', 'student', 'student_child', 'senior'].map(
                category => (
                  <List.Item
                    key={category}
                    title={category.charAt(0).toUpperCase() + category.slice(1)}
                    onPress={() => {
                      handlePersonalInfoChange('passengerCategory', category);
                    }}
                  />
                ),
              )}
            </List.Accordion>

            {/* Add Parental Consent for minors */}
            {calculateAge(personalInfo.birthdate) < 18 &&
              calculateAge(personalInfo.birthdate) >= 12 && (
                <ParentGuardianConsent
                  age={calculateAge(personalInfo.birthdate)}
                  onConsentGiven={granted => {
                    if (!granted) {
                      Alert.alert(
                        'Error',
                        'Parental consent is required to proceed.',
                      );
                    }
                  }}
                />
              )}

            {/* Add Birth Certificate upload for 12-year-olds */}
            <BirthCertificateUpload
              age={calculateAge(personalInfo.birthdate)}
            />

            <Text style={styles.categoryInfo}>
              • Regular: Standard passenger rates
              {'\n'}• Student & Senior: Discounted rates
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
              mode="outlined"
              label="Street Address"
              style={styles.paperInput}
              outlineStyle={styles.paperInputOutline}
              contentStyle={styles.paperInputContent}
              value={homeAddress.street}
              onChangeText={value => handleAddressChange('street', value)}
            />
            <TextInput
              mode="outlined"
              label="City"
              style={styles.paperInput}
              outlineStyle={styles.paperInputOutline}
              contentStyle={styles.paperInputContent}
              value={homeAddress.city}
              onChangeText={value => handleAddressChange('city', value)}
            />
            <TextInput
              mode="outlined"
              label="State/Province"
              style={styles.paperInput}
              outlineStyle={styles.paperInputOutline}
              contentStyle={styles.paperInputContent}
              value={homeAddress.state}
              onChangeText={value => handleAddressChange('state', value)}
            />
            <TextInput
              mode="outlined"
              label="ZIP/Postal Code"
              style={styles.paperInput}
              outlineStyle={styles.paperInputOutline}
              contentStyle={styles.paperInputContent}
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
                  <Text style={styles.uploadedNote}>
                    Uploaded – you can change it below
                  </Text>
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
              ) : (
                <View style={styles.profilePreviewContainer}>
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
            <View>
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
                  <Text style={styles.uploadedNote}>
                    Uploaded – you can change it below
                  </Text>
                  <View style={styles.documentButtonRow}>
                    <Button
                      mode="outlined"
                      onPress={() => pickImage('idDocument')}
                      style={styles.documentButton}
                      icon="folder">
                      Gallery
                    </Button>
                    <Button
                      mode="outlined"
                      onPress={() => takePicture('idDocument')}
                      style={styles.documentButton}
                      icon="camera">
                      Camera
                    </Button>
                  </View>
                </View>
              ) : (
                <View style={styles.documentButtonRow}>
                  <Button
                    mode="outlined"
                    onPress={() => pickImage('idDocument')}
                    style={styles.documentButton}
                    icon="folder">
                    Gallery
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() => takePicture('idDocument')}
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
            <Text style={styles.stepTitle}>Step 4: Create Account</Text>
            <TextInput
              mode="outlined"
              label="Username"
              style={styles.paperInput}
              outlineStyle={styles.paperInputOutline}
              contentStyle={styles.paperInputContent}
              value={credentials.username}
              onChangeText={value => handleCredentialsChange('username', value)}
            />
            <TextInput
              mode="outlined"
              label="Password"
              secureTextEntry={!passwordVisible}
              value={credentials.password}
              onChangeText={value => handleCredentialsChange('password', value)}
              style={styles.paperInput}
              outlineStyle={styles.paperInputOutline}
              contentStyle={styles.paperInputContent}
              right={
                <TextInput.Icon
                  icon={passwordVisible ? 'eye-off' : 'eye'}
                  onPress={() => setPasswordVisible(!passwordVisible)}
                />
              }
            />
            <TextInput
              mode="outlined"
              label="Confirm Password"
              secureTextEntry={!passwordVisible}
              value={credentials.confirmPassword}
              onChangeText={value =>
                handleCredentialsChange('confirmPassword', value)
              }
              style={styles.paperInput}
              outlineStyle={styles.paperInputOutline}
              contentStyle={styles.paperInputContent}
              right={
                <TextInput.Icon
                  icon={passwordVisible ? 'eye-off' : 'eye'}
                  onPress={() => setPasswordVisible(!passwordVisible)}
                />
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
                {isLoading ? 'Creating...' : 'Create'}
              </Button>
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={{flex: 1}}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent={true}
      />
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.scrollContainer,
          {paddingTop: insets.top + 15},
        ]}>
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
        <View style={{height: insets.bottom}} />
      </ScrollView>
    </View>
  );
};

export default RegisterPassengerScreen;
