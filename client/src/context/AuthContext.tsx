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
import DeviceInfo from 'react-native-device-info';
import SocketService from '../services/SocketService';
import {Alert} from 'react-native';
import Toast from 'react-native-toast-message';

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
  logout: (message?: string) => Promise<void>;
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
    const loadStoredAuthAndConnectSocket = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('userToken');
        const storedRefreshToken = await AsyncStorage.getItem('refreshToken');
        const storedRole = (await AsyncStorage.getItem('userRole')) as Role;
        const storedUserDataRaw = await AsyncStorage.getItem('userData');
        const storedUserData = storedUserDataRaw
          ? JSON.parse(storedUserDataRaw)
          : null;
        const currentDeviceId = await DeviceInfo.getUniqueId();

        if (storedToken && storedUserData) {
          setUserToken(storedToken);
          setRefreshToken(storedRefreshToken);
          setUserRole(storedRole);
          setUserData(storedUserData);

          // Connect Socket.IO using your service
          try {
            await SocketService.connect(storedToken, currentDeviceId); // Pass deviceId
            console.log('SocketService connected on app start.');

            // Register the session revoked listener
            SocketService.setOnSessionRevoked(async data => {
              const receivedDeviceId = data.newDeviceId;
              if (currentDeviceId !== receivedDeviceId) {
                console.warn(
                  'Session revoked by another device (Socket.IO). Forcing logout.',
                );
                await logout(data.message); // Call logout with message
                // The logout function will handle navigation to Login
              } else {
                console.log(
                  'Received session_revoked event for current device, ignoring (Socket.IO).',
                );
              }
            });
          } catch (socketError) {
            console.error(
              'SocketService connection failed on app start:',
              socketError,
            );
            // If socket connection fails, maybe the token is bad, force logout
            logout(
              'Failed to establish secure connection. Please log in again.',
            );
          }
        }
      } catch (error) {
        console.error('Error loading auth data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredAuthAndConnectSocket();

    // Cleanup: Disconnect socket and clear listener when AuthProvider unmounts
    return () => {
      SocketService.disconnect();
      SocketService.clearOnSessionRevoked();
    };
  }, []);

  const login = async (data: AuthData): Promise<void> => {
    try {
      console.log('🔐 Starting login process...');
      const currentDeviceId = await DeviceInfo.getUniqueId();

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

      // Connect Socket.IO on successful login
      try {
        await SocketService.connect(data.token, currentDeviceId); // Pass deviceId
        console.log('SocketService connected after login.');

        // Register the session revoked listener for the new connection
        SocketService.setOnSessionRevoked(async data => {
          const receivedDeviceId = data.newDeviceId;
          if (currentDeviceId !== receivedDeviceId) {
            console.warn(
              'Session revoked by another device (Socket.IO). Forcing logout.',
            );
            await logout(data.message);
          } else {
            console.log(
              'Received session_revoked event for current device, ignoring (Socket.IO).',
            );
          }
        });
      } catch (socketError) {
        console.error(
          'SocketService connection failed after login:',
          socketError,
        );
        // If socket connection fails, perhaps token is bad, proceed with logout
        logout('Failed to establish secure connection. Please log in again.');
      }

      console.log(
        '✅ Auth data saved successfully. User ID:',
        data.userData.userId,
      );
    } catch (error) {
      console.error('❌ Error saving auth data:', error);
      throw error;
    }
  };

  const refreshAccessToken = async (): Promise<boolean> => {
    try {
      if (!refreshToken) {
        console.log('No refresh token available');
        return false;
      }
      const currentDeviceId = await DeviceInfo.getUniqueId();

      const response = await authAxios.post('/api/auth/refresh', {
        refreshToken: refreshToken,
        deviceId: currentDeviceId,
      });

      if (response.data.success) {
        const newToken = response.data.data.token;
        const newRefreshToken = response.data.data.refreshToken;

        setUserToken(newToken);
        setRefreshToken(newRefreshToken);

        await AsyncStorage.setItem('userToken', newToken);
        await AsyncStorage.setItem('refreshToken', newRefreshToken);

        // Re-authenticate Socket.IO with the new token
        // Disconnect and reconnect to force re-handshake with new token
        if (SocketService.isConnected()) {
          SocketService.disconnect();
          await SocketService.connect(newToken, currentDeviceId); // Reconnect with new token
          console.log('SocketService re-authenticated with new token.');
        } else {
          // If socket was not connected, try connecting now with the new token
          await SocketService.connect(newToken, currentDeviceId);
          console.log('SocketService connected after token refresh.');
        }

        console.log('Access token refreshed successfully');
        return true;
      } else {
        console.log('Failed to refresh token');
        return false;
      }
    } catch (error: any) {
      console.error('Error refreshing token:', error);
      // Crucial: Handle SESSION_REVOKED from HTTP refresh endpoint as a fallback
      if (error.response?.data?.code === 'SESSION_REVOKED') {
        console.warn(
          'Refresh token rejected due to session revocation via HTTP. Forcing logout.',
        );
        await logout(error.response.data.message); // Call logout with message
      }
      return false;
    }
  };

  // Modify logout to accept an optional message for the Alert
  const logout = async (
    message: string = 'You have been logged out.',
  ): Promise<void> => {
    try {
      // Disconnect Socket.IO first
      SocketService.disconnect();
      SocketService.clearOnSessionRevoked(); // Clear the listener

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
        'recentLocations',
      ];
      await AsyncStorage.multiRemove(keysToRemove);

      console.log('Auth data cleared and Socket.IO disconnected.');

      Toast.show({
        type: 'success',
        text1: message,
      });
    } catch (error) {
      console.error('Error during logout:', error);
      throw error;
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
