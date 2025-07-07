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
import {GOOGLE_CONFIG} from '../config/googleConfig';

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
      const response = await api.post(
        `/api/auth/login`,
        {
          username,
          password,
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

      // Get user info from Google
      const signInResult = await GoogleSignin.signIn();

      // Check if sign in was successful
      if (signInResult.type !== 'success') {
        Alert.alert('Sign In', 'Google Sign-In was cancelled or failed');
        return;
      }

      const {data} = signInResult;

      // Send Google token to your backend for verification
      const response = await api.post(
        `/api/auth/google-login`,
        {
          idToken: data.idToken,
          accessToken: data.serverAuthCode,
          email: data.user.email,
          name: data.user.name,
          photo: data.user.photo,
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

      setTimeout(() => {
        refreshProfile();
      }, 100);
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled the login flow
        console.log('Google Sign-In cancelled');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        // Operation (e.g. sign in) is in progress already
        Alert.alert('Sign In', 'Google Sign-In is already in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        // Play services not available or outdated
        Alert.alert('Error', 'Google Play Services not available');
      } else {
        // Some other error happened
        const axiosError = error as AxiosError<{message?: string}>;
        const backendMessage =
          axiosError.response?.data?.message || 'Google Sign-In failed';
        Alert.alert('Google Sign-In Failed', backendMessage);
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
      source={require('../assets/images/welcomeImg.webp')}
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
            secureTextEntry
            style={GlobalStyles.input}
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
