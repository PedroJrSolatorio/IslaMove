import axios, {AxiosInstance, AxiosError, AxiosRequestConfig} from 'axios';
import {BACKEND_URL} from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Alert, Platform} from 'react-native';
import DeviceInfo from 'react-native-device-info';

interface ApiErrorResponse {
  message?: string;
  error?: string;
  code?: string;
}

export interface CustomAxiosRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
  skipAuthInterceptor?: boolean;
}

// Create a separate axios instance for token refresh to avoid interceptor loops
const refreshTokenInstance = axios.create({
  baseURL: BACKEND_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'X-Platform': Platform.OS,
  },
});

// Navigation reference
let navigationRef: any = null;

export const setNavigationRef = (ref: any) => {
  navigationRef = ref;
};

const api = axios.create({
  baseURL: BACKEND_URL,
  timeout: 15000, // Increased timeout for slower connections
  headers: {
    'Content-Type': 'application/json',
    'X-Platform': Platform.OS,
  },
});

// Add request interceptor to add auth token
api.interceptors.request.use(
  async config => {
    const customConfig = config as CustomAxiosRequestConfig;

    if (customConfig.skipAuthInterceptor) {
      return config; // Skip attaching Authorization header
    }

    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  },
);

// Add response interceptor to handle token refresh
api.interceptors.response.use(
  response => response,
  async (error: AxiosError<ApiErrorResponse>) => {
    // Get original request that failed
    const originalRequest = error.config as CustomAxiosRequestConfig;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Check for session revoked error specifically
    if (
      error.response?.status === 401 &&
      error.response?.data?.code === 'SESSION_REVOKED'
    ) {
      return handleLogout(
        'Your session has expired because you logged in on another device.',
      );
    }

    // If response is 401 Unauthorized and we haven't tried refreshing yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Get refresh token
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        const deviceId = await DeviceInfo.getUniqueId(); // Get device ID

        if (!refreshToken) {
          // No refresh token, force logout
          return handleLogout('No refresh token available');
        }

        // Call refresh token endpoint
        const response = await refreshTokenInstance.post('/api/auth/refresh', {
          refreshToken: refreshToken,
          deviceId: deviceId,
        });

        // Check if refresh was successful
        if (response.data.success) {
          // Store new tokens
          const newToken = response.data.data.token;
          const newRefreshToken = response.data.data.refreshToken;

          await AsyncStorage.setItem('userToken', newToken);
          await AsyncStorage.setItem('refreshToken', newRefreshToken);

          // Update Authorization header and retry request
          api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          } else {
            originalRequest.headers = {Authorization: `Bearer ${newToken}`};
          }

          // Retry the original request with new token
          return api(originalRequest);
        } else {
          // Refresh failed
          return handleLogout('Token refresh failed');
        }
      } catch (refreshError: any) {
        const backendMessage =
          refreshError.response?.data?.message || 'Error refreshing token';
        return handleLogout(backendMessage);
      }
    }

    // Handle other errors or if refresh failed
    if (error.response) {
      const status = error.response.status;

      if (status === 400) {
        // Bad request
        Alert.alert('Error', 'Invalid request. Please check your inputs.');
      } else if (status === 403) {
        // Forbidden
        Alert.alert(
          'Access Denied',
          'You do not have permission to perform this action.',
        );
      } else if (status === 404) {
        // Not found
        if (originalRequest.url?.includes('/api/users/profile')) {
          Alert.alert('Error', 'User profile not found.');
        }
      } else if (status === 500) {
        // Server error
        Alert.alert(
          'Server Error',
          'Something went wrong on our end. Please try again later.',
        );
      }
    } else if (error.request) {
      // Network error
      Alert.alert(
        'Network Error',
        'Unable to connect to the server. Please check your internet connection.',
      );
    }

    return Promise.reject(error);
  },
);

// Helper function to handle logout
const handleLogout = async (reason: string) => {
  console.log(`Logging out: ${reason}`);

  try {
    // Clear auth data
    await AsyncStorage.multiRemove([
      'userToken',
      'refreshToken',
      'userRole',
      'userData',
      'userId',
    ]);

    // Navigate to login if possible
    if (navigationRef && navigationRef.navigate) {
      Alert.alert('Session Expired', reason, [
        {
          text: 'OK',
          onPress: () => navigationRef.navigate('Login'),
        },
      ]);
    } else {
      // Show alert if we can't navigate
      Alert.alert('Session Expired', reason);
    }
  } catch (error) {
    console.error('Error during logout:', error);
  }

  return Promise.reject(new Error('Authentication failed'));
};

export default api;
