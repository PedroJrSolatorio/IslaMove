import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import {BACKEND_URL} from '@env';

type Role = 'admin' | 'driver' | 'passenger' | null;

interface UserData {
  userId: string;
  firstName: string;
  username: string;
  // Add other user data fields as needed
}
interface AuthData {
  token: string;
  refreshToken: string;
  role: Role;
  userData: UserData;
}

interface AuthContextProps {
  userRole: Role;
  userToken: string | null;
  refreshToken: string | null;
  userData: UserData | null;
  login: (data: AuthData) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<boolean>;
  isLoading: boolean;
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthContext = createContext<AuthContextProps>({
  userRole: null,
  userToken: null,
  refreshToken: null,
  userData: null,
  login: async () => {},
  logout: async () => {},
  refreshAccessToken: async () => false,
  isLoading: true,
});

// Create an axios instance just for token refresh to avoid interceptor loops
const authAxios = axios.create({
  baseURL: BACKEND_URL,
  timeout: 10000,
});

export const AuthProvider = ({children}: AuthProviderProps) => {
  const [userRole, setUserRole] = useState<Role>(null);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load stored authentication data when the app starts
  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('userToken');
        const storedRefreshToken = await AsyncStorage.getItem('refreshToken');
        const storedRole = (await AsyncStorage.getItem('userRole')) as Role;
        const storedUserData = await AsyncStorage.getItem('userData');

        if (storedToken && storedUserData) {
          setUserToken(storedToken);
          setRefreshToken(storedRefreshToken);
          setUserRole(storedRole);
          setUserData(JSON.parse(storedUserData));
        }
      } catch (error) {
        console.error('Error loading auth data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredAuth();
  }, []);

  const login = async (data: AuthData): Promise<void> => {
    try {
      console.log('🔐 Starting login process...');

      // Save to AsyncStorage first
      await AsyncStorage.multiSet([
        ['userToken', data.token],
        ['refreshToken', data.refreshToken],
        ['userRole', data.role || ''],
        ['userData', JSON.stringify(data.userData)],
        ['userId', data.userData.userId],
      ]);

      // Then update state
      setUserRole(data.role);
      setUserToken(data.token);
      setRefreshToken(data.refreshToken);
      setUserData(data.userData);

      console.log(
        '✅ Auth data saved successfully. User ID:',
        data.userData.userId,
      );
    } catch (error) {
      console.error('❌ Error saving auth data:', error);
      throw error; // Re-throw so the login component knows about the error
    }
  };

  const refreshAccessToken = async (): Promise<boolean> => {
    try {
      if (!refreshToken) {
        console.log('No refresh token available');
        return false;
      }

      const response = await authAxios.post('/api/auth/refresh', {
        refreshToken: refreshToken,
      });

      if (response.data.success) {
        const newToken = response.data.data.token;
        const newRefreshToken = response.data.data.refreshToken;

        // Update tokens in state
        setUserToken(newToken);
        setRefreshToken(newRefreshToken);

        // Update tokens in storage
        await AsyncStorage.setItem('userToken', newToken);
        await AsyncStorage.setItem('refreshToken', newRefreshToken);

        console.log('Access token refreshed successfully');
        return true;
      } else {
        console.log('Failed to refresh token');
        return false;
      }
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      // Clear state
      setUserRole(null);
      setUserToken(null);
      setRefreshToken(null);
      setUserData(null);

      // Clear ALL auth-related items from AsyncStorage
      const keysToRemove = [
        'userToken',
        'refreshToken',
        'userRole',
        'userData',
        'userId',
        // Add any other auth-related keys you might have
      ];

      // Clear AsyncStorage
      await AsyncStorage.multiRemove(keysToRemove);

      // Verify the items were actually removed
      const verifyCleared = await AsyncStorage.multiGet(keysToRemove);
      const stillPresent = verifyCleared.filter(
        ([key, value]) => value !== null,
      );

      if (stillPresent.length > 0) {
        console.warn('⚠️ Some items were not cleared:', stillPresent);

        // Force remove any remaining items
        for (const [key] of stillPresent) {
          await AsyncStorage.removeItem(key);
        }
      }

      console.log('Auth data cleared successfully');

      // Final verification
      const finalCheck = await AsyncStorage.multiGet(keysToRemove);
      const finalStillPresent = finalCheck.filter(
        ([key, value]) => value !== null,
      );

      if (finalStillPresent.length === 0) {
        console.log('✅ Logout verification passed - all data cleared');
      } else {
        console.error(
          '❌ Logout verification failed - some data still present:',
          finalStillPresent,
        );
      }
    } catch (error) {
      console.error('Error clearing auth data:', error);

      // Even if there's an error, try to clear the state
      setUserRole(null);
      setUserToken(null);
      setRefreshToken(null);
      setUserData(null);

      throw error; // Re-throw so the UI can handle it
    }
  };

  return (
    <AuthContext.Provider
      value={{
        userRole,
        userToken,
        refreshToken,
        userData,
        login,
        logout,
        refreshAccessToken,
        isLoading,
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
