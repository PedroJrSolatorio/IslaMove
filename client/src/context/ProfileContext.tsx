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

interface Address {
  _id: string;
  label: string;
  address: string;
  location?: Location;
}

interface Profile {
  _id: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  profileImage: string | null;
  savedAddresses: Address[];
  createdAt: string;
}

interface ProfileContextProps {
  profileData: Profile;
  loading: boolean;
  updateProfile: (updatedData: Partial<Profile>) => Promise<void>;
  updatePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<any>;
  refreshProfile: () => Promise<void>;
}

// Create the context with a default value
const ProfileContext = createContext<ProfileContextProps>({
  profileData: {
    _id: '',
    username: '',
    fullName: '',
    email: '',
    phone: '',
    profileImage: null,
    savedAddresses: [],
    createdAt: '',
  },
  loading: true,
  updateProfile: async () => {},
  updatePassword: async () => {},
  refreshProfile: async () => {},
});

// Create a provider component
export const ProfileProvider: React.FC<{children: ReactNode}> = ({
  children,
}) => {
  const [profileData, setProfileData] = useState<Profile>({
    _id: '',
    username: '',
    fullName: '',
    email: '',
    phone: '',
    profileImage: null,
    savedAddresses: [],
    createdAt: '',
  });
  const [loading, setLoading] = useState(true);

  // Function to fetch profile data from API
  const fetchProfile = async () => {
    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem('userId');

      if (!userId) {
        // console.error('User ID not found.');
        setLoading(false);
        return;
      }

      const response = await api.get(`/api/users/profile/${userId}`);
      setProfileData(response.data);
      setLoading(false);
    } catch (error: any) {
      console.error('❌ Error fetching profile:', error);

      if (error.response) {
        console.log('📦 Server response error:', error.response.data);
      } else if (error.request) {
        console.log('📡 No response received:', error.request);
      } else {
        console.log('💥 Request setup error:', error.message);
      }

      Alert.alert('Error', 'Failed to load profile.');
      setLoading(false);
    }
  };

  // Function to update profile data
  const updateProfile = async (updatedData: Partial<Profile>) => {
    try {
      setLoading(true);

      // Merge the updated data with existing data
      const newProfileData = {...profileData, ...updatedData};

      // Send update to the server
      const response = await api.put(
        `/api/users/profile/${profileData._id}`,
        newProfileData,
      );

      if (response.status !== 200) {
        throw new Error(response.data.error || 'Failed to update profile');
      }

      // Update local state with the response data
      setProfileData(response.data);
      setLoading(false);

      return response.data;
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile.');
      setLoading(false);
      throw error;
    }
  };

  // Initial fetch when the app loads
  useEffect(() => {
    fetchProfile();
  }, []);

  const updatePassword = async (
    currentPassword: string,
    newPassword: string,
  ) => {
    try {
      setLoading(true);

      // Separate endpoint call specifically for password updates
      const response = await api.put(`/api/users/profile/${profileData._id}`, {
        currentPassword,
        newPassword,
      });

      if (response.status !== 200) {
        throw new Error(response.data.error || 'Failed to update password');
      }

      setLoading(false);
      return response.data;
    } catch (error: any) {
      console.error('Error updating password:', error);
      setLoading(false);

      // Propagate the error message from the server if available
      if (error.response && error.response.data && error.response.data.error) {
        throw new Error(error.response.data.error);
      }
      throw error;
    }
  };

  // Provide the context value to children
  return (
    <ProfileContext.Provider
      value={{
        profileData,
        loading,
        updateProfile,
        updatePassword,
        refreshProfile: fetchProfile,
      }}>
      {children}
    </ProfileContext.Provider>
  );
};

// Custom hook for using the profile context
export const useProfile = () => useContext(ProfileContext);
