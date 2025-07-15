import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  ImageBackground,
  Alert,
  Platform,
  ToastAndroid,
  BackHandler,
} from 'react-native';
import {Button, TextInput, Divider} from 'react-native-paper';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {useAuth} from '../context/AuthContext';
import {GlobalStyles} from '../styles/GlobalStyles';
import api from '../../utils/api';
import {useFocusEffect} from '@react-navigation/native';
import {AxiosError, AxiosRequestConfig} from 'axios';
import {useProfile} from '../context/ProfileContext';
import {
  GoogleSignin,
  GoogleSigninButton,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import {GOOGLE_CONFIG, debugGoogleConfig} from '../config/googleConfig';
import DeviceInfo from 'react-native-device-info';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

let backPressCount = 0;

const LoginScreen = ({navigation}: Props) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const {login, userToken, userRole} = useAuth();
  const {refreshProfile} = useProfile();
  const [passwordVisible, setPasswordVisible] = useState(false);

  // Initialize Google Sign-In
  useEffect(() => {
    GoogleSignin.configure(GOOGLE_CONFIG);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS === 'android') {
        const backAction = () => {
          if (backPressCount === 0) {
            backPressCount += 1;
            ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
            setTimeout(() => (backPressCount = 0), 2000);
            return true;
          }
          BackHandler.exitApp();
          return true;
        };

        const backHandler = BackHandler.addEventListener(
          'hardwareBackPress',
          backAction,
        );

        return () => backHandler.remove(); // Proper cleanup
      }
    }, []),
  );

  useEffect(() => {
    if (userToken && userRole) {
      navigateBasedOnRole(userRole);
    }
  }, []);

  useEffect(() => {
    const initializeGoogleSignIn = async () => {
      try {
        // Debug configuration
        debugGoogleConfig();

        // Configure Google Sign-In
        await GoogleSignin.configure(GOOGLE_CONFIG);
        console.log('✅ Google Sign-In configured successfully');

        // Check Play Services
        const hasPlayServices = await GoogleSignin.hasPlayServices();
        console.log('✅ Google Play Services available:', hasPlayServices);
      } catch (error) {
        console.error('❌ Google Sign-In initialization error:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
      }
    };

    initializeGoogleSignIn();
  }, []);

  const navigateBasedOnRole = (role: string) => {
    switch (role) {
      case 'driver':
        navigation.replace('DriverHome');
        break;
      case 'passenger':
        navigation.replace('PassengerHome');
        break;
      case 'admin':
        navigation.replace('AdminHome');
        break;
      default:
        Alert.alert('Error', 'Unknown user role');
    }
  };

  const validateUserToken = async () => {
    if (!userToken) return false;
    setIsValidating(true);

    try {
      const response = await api.get(`/api/auth/validate`);

      if (response.status === 200 && response.data?.role) {
        return true;
      }
      return false;
    } catch (error) {
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter both username and password');
      return;
    }

    setLoading(true);
    try {
      const deviceId = await DeviceInfo.getUniqueId();
      const response = await api.post(
        `/api/auth/login`,
        {
          username,
          password,
          deviceId,
        },
        {skipAuthInterceptor: true} as AxiosRequestConfig & {
          skipAuthInterceptor: boolean;
        },
      );

      const tokenPayload = JSON.parse(atob(response.data.token.split('.')[1]));
      const role = tokenPayload.role;

      await login({
        token: response.data.token,
        refreshToken: response.data.refreshToken,
        role,
        userData: {
          userId: response.data.userId,
          firstName: response.data.firstName,
          username: response.data.username,
        },
      });
      // Check if deletion was cancelled and show appropriate message
      if (response.data.deletionCancelled) {
        Alert.alert(
          'Account Restored',
          response.data.message || 'Account deletion cancelled successfully',
        );
      }
      // Wait a bit for AsyncStorage to be updated, then refresh profile
      setTimeout(() => {
        refreshProfile();
      }, 100);
    } catch (error) {
      const axiosError = error as AxiosError<{message?: string}>;
      const backendMessage =
        axiosError.response?.data?.message || 'Invalid username or password';

      Alert.alert('Login Failed', backendMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      // Check if device supports Google Play Services
      await GoogleSignin.hasPlayServices();
      // Clear any previous sign-in
      await GoogleSignin.signOut();

      // Get user info from Google
      const signInResult = await GoogleSignin.signIn();

      // Check if sign in was successful
      if (signInResult.type !== 'success') {
        Alert.alert('Sign In', 'Google Sign-In was cancelled or failed');
        return;
      }

      const {data} = signInResult;
      const deviceId = await DeviceInfo.getUniqueId();

      // Send Google token to your backend for verification
      const response = await api.post(
        `/api/auth/google-login`,
        {
          idToken: data.idToken,
          accessToken: data.serverAuthCode,
          email: data.user.email,
          name: data.user.name,
          photo: data.user.photo,
          deviceId,
        },
        {skipAuthInterceptor: true} as AxiosRequestConfig & {
          skipAuthInterceptor: boolean;
        },
      );

      const tokenPayload = JSON.parse(atob(response.data.token.split('.')[1]));
      const role = tokenPayload.role;

      await login({
        token: response.data.token,
        refreshToken: response.data.refreshToken,
        role,
        userData: {
          userId: response.data.userId,
          firstName: response.data.firstName,
          username: response.data.username,
        },
      });
      if (response.data.deletionCancelled) {
        Alert.alert(
          'Account Restored',
          response.data.message || 'Account deletion cancelled successfully',
        );
      }
      setTimeout(() => {
        refreshProfile();
      }, 100);
    } catch (error: any) {
      // Check if this is a Google Sign-In specific error first
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled the login flow
        console.log('Google Sign-In cancelled');
        return; // Don't show error for cancellation
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // Operation (e.g. sign in) is in progress already
        Alert.alert('Sign In', 'Google Sign-In is already in progress');
        return;
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        // Play services not available or outdated
        Alert.alert('Error', 'Google Play Services not available');
        return;
      }

      // Handle the specific "Authentication failed" message that likely means unregistered user
      if (error.message === 'Authentication failed') {
        Alert.alert(
          'Account Not Registered',
          'Your Google account is not registered with our app. Please register first.',
          [
            {
              text: 'Register Now',
              onPress: () => navigation.navigate('RegisterSelection'),
            },
            {
              text: 'OK',
              style: 'cancel',
            },
          ],
        );
        return;
      }

      // Handle axios/backend errors - check multiple ways the error might be structured
      if (
        error.response ||
        error.status ||
        (error.message && error.message.includes('401'))
      ) {
        // This is likely an axios error with a response from the backend
        const status = error.response?.status || error.status;
        const errorData = error.response?.data || error.data;
        const backendMessage = errorData?.message || error.message;

        console.log(
          'Detected backend error - Status:',
          status,
          'Message:',
          backendMessage,
        );

        if (
          status === 401 ||
          backendMessage?.includes('not registered') ||
          backendMessage?.includes('not found')
        ) {
          // Handle the specific case where Google account is not registered
          const displayMessage =
            backendMessage ||
            'Google account not registered. Please register first.';

          Alert.alert('Account Not Registered', displayMessage, [
            {
              text: 'Register Now',
              onPress: () => navigation.navigate('RegisterSelection'),
            },
            {
              text: 'OK',
              style: 'cancel',
            },
          ]);
        } else {
          // Handle other backend errors
          const displayMessage = backendMessage || 'Server error occurred';
          Alert.alert('Sign-In Failed', displayMessage);
        }
      } else {
        // Handle other types of errors (network, etc.)
        console.error('Unexpected error during Google Sign-In:', error);
        Alert.alert(
          'Error',
          'An unexpected error occurred during sign-in. Please try again.',
        );
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleRetryValidation = async () => {
    const isValid = await validateUserToken();
    if (isValid && userRole) {
      navigateBasedOnRole(userRole);
    } else if (userToken) {
      Alert.alert(
        'Session Expired',
        'Your session has expired. Please log in again.',
      );
    } else {
      Alert.alert('Login Required', 'Please log in to continue.');
    }
  };

  return (
    <ImageBackground
      source={require('../assets/images/IslaMove_background.png')}
      style={GlobalStyles.background}>
      <View style={GlobalStyles.overlay}>
        <Text style={GlobalStyles.title}>Welcome to IslaMove</Text>
        <Text style={GlobalStyles.subtitle}>Ready? Let's get moving.</Text>

        <View style={GlobalStyles.buttonContainer}>
          <TextInput
            label="Username"
            value={username}
            onChangeText={setUsername}
            style={GlobalStyles.input}
          />
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!passwordVisible}
            style={GlobalStyles.input}
            right={
              <TextInput.Icon
                icon={passwordVisible ? 'eye-off' : 'eye'}
                onPress={() => setPasswordVisible(!passwordVisible)}
              />
            }
          />
          <Button
            mode="contained"
            onPress={handleLogin}
            style={GlobalStyles.primaryButton}
            loading={loading}
            disabled={loading}>
            Login
          </Button>

          <View style={GlobalStyles.dividerContainer}>
            <Divider style={GlobalStyles.divider} />
            <Text style={GlobalStyles.dividerText}>or</Text>
            <Divider style={GlobalStyles.divider} />
          </View>

          <GoogleSigninButton
            style={GlobalStyles.googleButton}
            size={GoogleSigninButton.Size.Wide}
            color={GoogleSigninButton.Color.Light}
            onPress={handleGoogleSignIn}
            disabled={loading || googleLoading}
          />

          {googleLoading && (
            <Text style={GlobalStyles.loadingText}>
              Signing in with Google...
            </Text>
          )}

          {userToken && (
            <Button
              mode="outlined"
              onPress={handleRetryValidation}
              style={GlobalStyles.secondaryButton}
              labelStyle={GlobalStyles.resumeText}
              loading={isValidating}
              disabled={isValidating || loading || googleLoading}>
              Resume Session
            </Button>
          )}

          <View style={GlobalStyles.noAccountContainer}>
            <Text style={GlobalStyles.noAccountText}>
              Don't have an account?
            </Text>
            <Button
              mode="text"
              labelStyle={GlobalStyles.registerButtonText}
              onPress={() => navigation.navigate('RegisterSelection')}>
              Register
            </Button>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
};

export default LoginScreen;
