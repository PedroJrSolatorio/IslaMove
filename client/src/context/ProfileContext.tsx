import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../utils/api';
import {Alert} from 'react-native';

// Define interfaces for our data types
interface Location {
  type: string;
  coordinates: [number, number];
  address: string;
}

interface HomeAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  coordinates?: [number, number];
}

interface Address {
  _id?: string;
  label: string;
  address: string;
  location: Location;
}

interface Vehicle {
  make: string;
  series: string;
  yearModel: number;
  color: string;
  type: 'bao-bao';
  plateNumber: string;
  bodyNumber: string;
}

interface IdDocument {
  type: 'school_id' | 'senior_id' | 'valid_id' | 'drivers_license';
  imageUrl: string;
  uploadedAt: string;
  verified: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
}

// NEW: Interface for pending profile image
interface PendingProfileImage {
  imageUrl: string;
  uploadedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}

interface Warning {
  message: string;
  Date: string;
  readStatus: boolean;
}

interface Document {
  documentType:
    | 'License'
    | 'Registration'
    | 'MODA Certificate'
    | 'Vehicle Photo';
  fileURL: string;
  verified: boolean;
  uploadDate: string;
}

interface Agreement {
  documentType: 'terms_and_conditions' | 'privacy_policy';
  version: string;
  acceptedAt: string;
  ipAddress?: string;
  userAgent?: string;
}

// Base profile interface with common fields
interface BaseProfile {
  _id: string;
  lastName: string;
  firstName: string;
  middleInitial: string;
  birthdate: string; // READ-ONLY (viewable but not editable)
  age: number; // READ-ONLY (viewable but not editable)
  username: string;
  email: string;
  phone: string;
  homeAddress: HomeAddress;
  role: 'passenger' | 'driver' | 'admin';
  profileImage: string; // Current active profile image
  pendingProfileImage?: PendingProfileImage; // NEW: Pending profile image
  isBlocked: boolean;
  blockReason: string;
  warnings: Warning[];
  currentLocation?: Location;
  rating: number;
  totalRides: number;
  totalRatings: number;
  isVerified: boolean;
  verificationStatus: 'pending' | 'under_review' | 'approved' | 'rejected';
  agreementsAccepted: Agreement[];
  idDocument: IdDocument; // READ-ONLY (viewable but not editable)
  createdAt: string;
  updatedAt: string;
}

// Passenger-specific profile
interface PassengerProfile extends BaseProfile {
  role: 'passenger';
  passengerCategory: 'regular' | 'student' | 'senior';
  savedAddresses: Address[];
}

// Driver-specific profile
interface DriverProfile extends BaseProfile {
  role: 'driver';
  licenseNumber: string;
  driverStatus: 'available' | 'busy' | 'offline';
  vehicle: Vehicle;
  documents: Document[];
}

// Admin profile (same as base for now)
interface AdminProfile extends BaseProfile {
  role: 'admin';
}

// Union type for all profile types
type Profile = PassengerProfile | DriverProfile | AdminProfile;

interface ProfileContextProps {
  profileData: Profile | null;
  loading: boolean;
  updateProfile: (updatedData: Partial<Profile>) => Promise<void>;
  updatePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<any>;
  uploadProfileImage: (imageFile: any) => Promise<any>; // NEW: Upload profile image function
  refreshProfile: () => Promise<void>;
}

// Updated list of fields that cannot be edited by users (but can be viewed)
const READ_ONLY_FIELDS = [
  'birthdate', // Can view but not edit
  'age', // Can view but not edit
  'licenseNumber', // Can view but not edit
  'idDocument', // Can view but not edit
  'profileImage', // Can view but not edit directly (must use upload function)
  'pendingProfileImage', // Can view but not edit directly
  'verificationStatus',
  'isVerified',
  'rating',
  'totalRides',
  'totalRatings',
  'isBlocked',
  'blockReason',
  'warnings',
  'createdAt',
  'updatedAt',
] as const;

// List of fields that are completely hidden/protected (not shown in UI)
const PROTECTED_FIELDS = ['_id', 'password'] as const;

// Create the context with a default value
const ProfileContext = createContext<ProfileContextProps>({
  profileData: null,
  loading: true,
  updateProfile: async () => {},
  updatePassword: async () => {},
  uploadProfileImage: async () => {},
  refreshProfile: async () => {},
});

// Create a provider component
export const ProfileProvider: React.FC<{children: ReactNode}> = ({
  children,
}) => {
  const [profileData, setProfileData] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Function to fetch profile data from API
  const fetchProfile = async () => {
    try {
      setLoading(true);
      let userId = await AsyncStorage.getItem('userId');

      // Clean the userId of any extra quotes
      if (userId) {
        userId = userId.replace(/^["']|["']$/g, ''); // Remove leading/trailing quotes
      }

      if (!userId) {
        // console.warn('User ID not found in AsyncStorage'); //remove this in production
        setLoading(false);
        return;
      }

      const response = await api.get(`/api/users/profile/${userId}`);

      // Validate that we received valid profile data
      if (response.data && response.data._id) {
        setProfileData(response.data);
      } else {
        console.error('Invalid profile data received:', response.data);
        Alert.alert('Error', 'Invalid profile data received.');
      }

      setLoading(false);
    } catch (error: any) {
      console.error('❌ Error fetching profile:', error);

      if (error.response) {
        console.log('📦 Server response error:', error.response.data);
        if (error.response.status === 404) {
          Alert.alert('Error', 'Profile not found. Please login again.');
        } else if (error.response.status === 401) {
          Alert.alert('Error', 'Session expired. Please login again.');
        } else {
          Alert.alert('Error', 'Failed to load profile.');
        }
      } else if (error.request) {
        console.log('📡 No response received:', error.request);
        Alert.alert('Error', 'Network error. Please check your connection.');
      } else {
        console.log('💥 Request setup error:', error.message);
        Alert.alert('Error', 'Failed to load profile.');
      }

      setLoading(false);
    }
  };

  // Function to update profile data
  const updateProfile = async (updatedData: Partial<Profile>) => {
    if (!profileData) {
      throw new Error('No profile data available');
    }

    try {
      setLoading(true);

      // Filter out undefined values
      const filteredData = Object.fromEntries(
        Object.entries(updatedData).filter(([_, value]) => value !== undefined),
      );

      // Remove read-only fields from the update data
      const readOnlyFieldsFound: string[] = [];
      READ_ONLY_FIELDS.forEach(field => {
        if (field in filteredData) {
          readOnlyFieldsFound.push(field);
          delete filteredData[field];
        }
      });

      // Remove protected fields from the update data
      const protectedFieldsFound: string[] = [];
      PROTECTED_FIELDS.forEach(field => {
        if (field in filteredData) {
          protectedFieldsFound.push(field);
          delete filteredData[field];
        }
      });

      // Alert user if they tried to update read-only fields
      if (readOnlyFieldsFound.length > 0) {
        console.warn(
          `Attempted to update read-only fields: ${readOnlyFieldsFound.join(
            ', ',
          )}`,
        );
        Alert.alert(
          'Update Restricted',
          `The following fields cannot be modified: ${readOnlyFieldsFound.join(
            ', ',
          )}. These fields are read-only or require admin approval.`,
        );
      }

      // Alert user if they tried to update protected fields
      if (protectedFieldsFound.length > 0) {
        console.warn(
          `Attempted to update protected fields: ${protectedFieldsFound.join(
            ', ',
          )}`,
        );
      }

      // Check if there's still data to update after removing non-editable fields
      if (Object.keys(filteredData).length === 0) {
        setLoading(false);
        return profileData; // Return current profile data if no valid updates
      }

      // Role-specific validation
      if (profileData.role === 'passenger') {
        // Remove driver-specific fields if somehow included
        delete filteredData.driverStatus;
        delete filteredData.vehicle;
        delete filteredData.documents;
      } else if (profileData.role === 'driver') {
        // Remove passenger-specific fields if somehow included
        delete filteredData.passengerCategory;
        delete filteredData.savedAddresses;
      }

      // Send update to the server
      const response = await api.put(
        `/api/users/profile/${profileData._id}`,
        filteredData,
      );

      if (response.status !== 200) {
        throw new Error(response.data?.error || 'Failed to update profile');
      }

      // Update local state with the response data
      // IMPORTANT: Use response.data.user instead of response.data if your backend returns { user: ... }
      const updatedProfile = response.data.user || response.data;
      setProfileData(updatedProfile);
      setLoading(false);

      return updatedProfile;
    } catch (error: any) {
      console.error('Error updating profile:', error);

      let errorMessage = 'Failed to update profile.';

      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.details) {
        if (Array.isArray(error.response.data.details)) {
          errorMessage = `Validation error: ${error.response.data.details.join(
            ', ',
          )}`;
        } else {
          errorMessage = error.response.data.details;
        }
      }

      Alert.alert('Error', errorMessage);
      setLoading(false);
      throw error;
    }
  };

  // Function to update password
  const updatePassword = async (
    currentPassword: string,
    newPassword: string,
  ) => {
    if (!profileData) {
      throw new Error('No profile data available');
    }

    try {
      setLoading(true);

      // Separate endpoint call specifically for password updates
      const response = await api.put(`/api/users/profile/${profileData._id}`, {
        currentPassword,
        newPassword,
      });

      if (response.status !== 200) {
        throw new Error(response.data?.error || 'Failed to update password');
      }

      setLoading(false);
      return response.data;
    } catch (error: any) {
      console.error('Error updating password:', error);
      setLoading(false);

      // Propagate the error message from the server if available
      const errorMessage =
        error.response?.data?.error || 'Failed to update password';
      throw new Error(errorMessage);
    }
  };

  // NEW: Function to upload profile image
  const uploadProfileImage = async (imageFile: any) => {
    if (!profileData) {
      throw new Error('No profile data available');
    }

    try {
      setLoading(true);

      // Check if there's already a pending image
      if (profileData.pendingProfileImage?.status === 'pending') {
        setLoading(false);
        throw new Error(
          'A profile image is already pending approval. You cannot upload another.',
        );
      }

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('profileImage', imageFile);

      // Upload to your backend endpoint
      const response = await api.post(
        `/api/users/profile/${profileData._id}/upload-image`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );

      if (response.status !== 200) {
        throw new Error(response.data?.error || 'Failed to upload image');
      }

      // Refresh profile to get updated pendingProfileImage data
      await fetchProfile();
      setLoading(false);

      Alert.alert(
        'Upload Successful',
        'Your profile image has been uploaded and is pending admin approval.',
      );

      return response.data;
    } catch (error: any) {
      console.error('Error uploading profile image:', error);
      setLoading(false);

      const errorMessage =
        error.response?.data?.error || 'Failed to upload profile image';

      Alert.alert('Upload Failed', errorMessage);
      throw new Error(errorMessage);
    }
  };

  // Initial fetch when the app loads
  useEffect(() => {
    fetchProfile();
  }, []);

  // Provide the context value to children
  return (
    <ProfileContext.Provider
      value={{
        profileData,
        loading,
        updateProfile,
        updatePassword,
        uploadProfileImage,
        refreshProfile: fetchProfile,
      }}>
      {children}
    </ProfileContext.Provider>
  );
};

// Custom hook for using the profile context
export const useProfile = () => {
  const context = useContext(ProfileContext);

  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }

  return context;
};

// Type guards for checking profile types
export const isPassengerProfile = (
  profile: Profile | null,
): profile is PassengerProfile => {
  return profile?.role === 'passenger';
};

export const isDriverProfile = (
  profile: Profile | null,
): profile is DriverProfile => {
  return profile?.role === 'driver';
};

export const isAdminProfile = (
  profile: Profile | null,
): profile is AdminProfile => {
  return profile?.role === 'admin';
};

// Helper function to check if a field can be edited
export const isFieldEditable = (fieldName: string): boolean => {
  return (
    !READ_ONLY_FIELDS.includes(fieldName as any) &&
    !PROTECTED_FIELDS.includes(fieldName as any)
  );
};

// Helper function to check if a field should be visible (can be read)
export const isFieldVisible = (fieldName: string): boolean => {
  return !PROTECTED_FIELDS.includes(fieldName as any);
};

// Helper function to check if a field is read-only (visible but not editable)
export const isFieldReadOnly = (fieldName: string): boolean => {
  return (
    READ_ONLY_FIELDS.includes(fieldName as any) && isFieldVisible(fieldName)
  );
};

// Helper function to get list of read-only fields
export const getReadOnlyFields = (): readonly string[] => {
  return READ_ONLY_FIELDS;
};

// Helper function to get list of protected fields
export const getProtectedFields = (): readonly string[] => {
  return PROTECTED_FIELDS;
};

// NEW: Helper function to check if profile image upload is allowed
export const canUploadProfileImage = (profile: Profile | null): boolean => {
  if (!profile) return false;

  // Cannot upload if there's already a pending image
  return !(profile.pendingProfileImage?.status === 'pending');
};

// NEW: Helper function to get profile image upload status message
export const getProfileImageUploadStatus = (
  profile: Profile | null,
): string => {
  if (!profile) return 'Profile not loaded';

  if (profile.pendingProfileImage?.status === 'pending') {
    return 'Profile image upload is pending admin approval';
  }

  if (profile.pendingProfileImage?.status === 'rejected') {
    return `Previous upload was rejected${
      profile.pendingProfileImage.rejectionReason
        ? ': ' + profile.pendingProfileImage.rejectionReason
        : ''
    }. You can upload a new profile image.`;
  }

  return 'You can upload a new profile image';
};

// NEW: Helper function to get the current effective profile image
export const getCurrentProfileImage = (profile: Profile | null): string => {
  if (!profile) return '';

  // Return the active profile image (not the pending one)
  return profile.profileImage || '';
};

// NEW: Helper function to get pending profile image info
export const getPendingProfileImageInfo = (
  profile: Profile | null,
): PendingProfileImage | null => {
  if (!profile || !profile.pendingProfileImage) return null;

  return profile.pendingProfileImage;
};
