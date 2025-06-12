import React, {useState, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
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

interface VehicleInfo {
  make: string;
  model: string;
  year: string;
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

  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;
  const [isLoading, setIsLoading] = useState(false);

  const [personalInfo, setPersonalInfo] = useState({
    fullName: '',
    email: '',
    phone: '',
    licenseNumber: '',
  });

  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo>({
    make: '',
    model: '',
    year: '',
    color: '',
    type: 'bao-bao',
    plateNumber: '',
    bodyNumber: '',
  });

  const [profileImage, setProfileImage] = useState('');
  const [profileImageMime, setProfileImageMime] = useState('');

  const [documents, setDocuments] = useState<DocumentInfo[]>([
    {
      documentType: 'License',
      fileURL: '',
      mimeType: '',
      verified: false,
      uploadDate: new Date(),
    },
    {
      documentType: 'Registration',
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

  const handleVehicleChange = (name: keyof VehicleInfo, value: string) => {
    setVehicleInfo({...vehicleInfo, [name]: value});
  };

  const handleCredentialsChange = (
    name: keyof typeof credentials,
    value: string,
  ) => {
    setCredentials({...credentials, [name]: value});
  };

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'This app needs access to your camera to take pictures',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    } else {
      // For iOS permission is handled by the image picker
      return true;
    }
  };

  const pickImage = async (documentType?: string) => {
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

        // Compress the image
        const compressed = await compressImage(
          selectedAsset.uri || '',
          0.5,
          documentType ? 1200 : 600, // Higher resolution for documents
        );

        if (documentType) {
          // For documents, update the documents array
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
          // For profile image, update the profileImage state
          setProfileImage(compressed.uri);
          setProfileImageMime(compressed.mime);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takePicture = async (documentType?: string) => {
    try {
      const hasPermission = await requestCameraPermission();

      if (!hasPermission) {
        Alert.alert(
          'Permission Required',
          'You need to grant camera permission to take pictures',
        );
        return;
      }

      const options = {
        mediaType: 'photo' as const,
        includeBase64: false,
        maxHeight: 2000,
        maxWidth: 2000,
        quality: 1 as PhotoQuality, // Ensure quality is within the range [0, 1]
        saveToPhotos: false,
      };

      const result = await launchCamera(options);

      if (result.didCancel) {
        return;
      }

      if (result.errorCode) {
        throw new Error(result.errorMessage);
      }

      if (result.assets && result.assets.length > 0) {
        const selectedAsset = result.assets[0];

        // Compress the image
        const compressed = await compressImage(
          selectedAsset.uri || '',
          0.5,
          documentType ? 1200 : 600, // Higher resolution for documents
        );

        if (documentType) {
          // For documents, update the documents array
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
          // For profile image, update the profileImage state
          setProfileImage(compressed.uri);
          setProfileImageMime(compressed.mime);
        }
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to capture image. Please try again.');
    }
  };

  const validatePersonalInfo = () => {
    const {fullName, email, phone, licenseNumber} = personalInfo;

    if (!fullName || !email || !phone || !licenseNumber) {
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

    return true;
  };

  const checkExistingUser = async () => {
    try {
      setIsLoading(true);

      const response = await api.post('/auth/check-user', {
        email: personalInfo.email,
        phone: personalInfo.phone,
        username: credentials.username,
      });

      setIsLoading(false);

      if (response.status >= 200 && response.status < 300) {
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
        } else if (data.field === 'username' && currentStep === 5) {
          Alert.alert(
            'Username Taken',
            'This username is already taken. Please choose another one.',
          );
          return false;
        }

        Alert.alert('Error', data.error || 'Failed to check user information');
        return false;
      }

      return true;
    } catch (error) {
      setIsLoading(false);
      console.error('Error checking existing user:', error);
      Alert.alert(
        'Network Error',
        'Could not check if user already exists. Please check your connection.',
      );
      return false;
    }
  };

  const validateVehicleInfo = () => {
    const {make, model, year, color, plateNumber, bodyNumber} = vehicleInfo;

    if (!make || !model || !year || !color || !plateNumber || !bodyNumber) {
      Alert.alert(
        'Validation Error',
        'All vehicle information fields are required.',
      );
      return false;
    }

    const yearValue = parseInt(year);
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

    return true;
  };

  const nextStep = async () => {
    let isValid = false;

    switch (currentStep) {
      case 1:
        isValid = validatePersonalInfo();
        if (isValid) {
          // Check if email and phone already exist before proceeding
          const userAvailable = await checkExistingUser();
          if (!userAvailable) return;
        }
        break;
      case 2:
        isValid = validateVehicleInfo();
        break;
      case 3:
        isValid = validateProfileImage();
        break;
      case 4:
        isValid = validateDocuments();
        break;
      case 5:
        isValid = validateCredentials();
        if (isValid) {
          // Final check for username availability
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

      // Create a FormData object to handle multipart/form-data submission
      const formData = new FormData();

      // Add basic information
      formData.append('fullName', personalInfo.fullName);
      formData.append('username', credentials.username);
      formData.append('email', personalInfo.email);
      formData.append('phone', personalInfo.phone);
      formData.append('password', credentials.password);
      formData.append('role', 'driver');
      formData.append('licenseNumber', personalInfo.licenseNumber);

      // Add vehicle information as JSON string
      formData.append(
        'vehicle',
        JSON.stringify({
          ...vehicleInfo,
          year: parseInt(vehicleInfo.year),
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

      // Add documents - field names should match the ones expected in the backend
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

      // Using your api service instead of direct fetch
      const response = await api.postForm('/auth/register', formData);

      setIsLoading(false);

      if (response.status >= 200 && response.status < 300) {
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
              placeholder="Full Name"
              value={personalInfo.fullName}
              onChangeText={value =>
                handlePersonalInfoChange('fullName', value)
              }
            />
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
            <Text style={styles.stepTitle}>Step 2: Vehicle Information</Text>
            <TextInput
              style={styles.input}
              placeholder="Vehicle Make"
              value={vehicleInfo.make}
              onChangeText={value => handleVehicleChange('make', value)}
            />
            <TextInput
              style={styles.input}
              placeholder="Vehicle Model"
              value={vehicleInfo.model}
              onChangeText={value => handleVehicleChange('model', value)}
            />
            <TextInput
              style={styles.input}
              placeholder="Vehicle Year"
              keyboardType="numeric"
              value={vehicleInfo.year}
              onChangeText={value => handleVehicleChange('year', value)}
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
      case 3:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Step 3: Profile Photo</Text>
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

            <Text style={styles.tipsText}>
              Tips for a good profile photo:
              {'\n'}• Use a clear, well-lit headshot
              {'\n'}• Make sure your face is clearly visible
              {'\n'}• Choose a neutral background
              {'\n'}• Wear professional attire
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
            <Text style={styles.stepTitle}>Step 4: Document Upload</Text>
            <Text style={styles.stepInstructions}>
              Please upload clear images of the following documents. Make sure
              the entire document is visible and all details are clear.
            </Text>

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
      case 5:
        return (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Step 5: Create Account</Text>
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

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
    marginBottom: 8,
  },
  progressText: {
    textAlign: 'center',
    color: '#666',
  },
  stepContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  stepInstructions: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    marginBottom: 16,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
  },
  dropdown: {
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
  },
  button: {
    height: 48,
    justifyContent: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  halfButton: {
    flex: 0.48,
    height: 48,
    justifyContent: 'center',
  },
  // Profile image styles
  profileImageContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  profilePreviewContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  profilePreview: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 8,
  },
  emptyProfileContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyProfileText: {
    color: '#999',
  },
  // Document styles
  documentItem: {
    marginBottom: 24,
  },
  documentLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  documentPreviewContainer: {
    marginBottom: 8,
  },
  documentPreview: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
    marginBottom: 8,
    borderRadius: 4,
  },
  documentButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  documentButton: {
    flex: 0.45,
  },
  tipsText: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 5,
    marginVertical: 15,
    fontSize: 14,
    lineHeight: 20,
  },
  infoContainer: {
    backgroundColor: '#e7f3fe',
    padding: 15,
    borderRadius: 5,
    marginVertical: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  infoTitle: {
    fontWeight: 'bold',
    marginBottom: 10,
    fontSize: 16,
  },
  infoText: {
    lineHeight: 22,
    marginBottom: 10,
  },
  infoNote: {
    fontStyle: 'italic',
    color: '#666',
  },
});

export default RegisterDriverScreen;
