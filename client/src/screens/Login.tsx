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
import {Button, TextInput} from 'react-native-paper';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {useAuth} from '../context/AuthContext';
import {GlobalStyles} from '../styles/GlobalStyles';
import api from '../../utils/api';
import {useFocusEffect} from '@react-navigation/native';
import {AxiosError, AxiosRequestConfig} from 'axios';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

let backPressCount = 0;

const LoginScreen = ({navigation}: Props) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const {login, userToken, userRole} = useAuth();

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
        navigation.replace('DriverHome' as keyof RootStackParamList);
        break;
      case 'passenger':
        navigation.replace('PassengerHome' as keyof RootStackParamList);
        break;
      case 'admin':
        navigation.replace('AdminHome' as keyof RootStackParamList);
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

      if (response.status === 401) return false;
      return !!response.data?.role;
    } catch {
      return true;
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
    } catch (error) {
      const axiosError = error as AxiosError<{message?: string}>;
      const backendMessage =
        axiosError.response?.data?.message || 'Invalid username or password';

      Alert.alert('Login Failed', backendMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryValidation = async () => {
    const isValid = await validateUserToken();
    if (isValid && userRole) {
      navigateBasedOnRole(userRole);
    } else {
      Alert.alert(
        'Session Expired',
        'Your session has expired. Please log in again.',
      );
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

          {userToken && (
            <Button
              mode="outlined"
              onPress={handleRetryValidation}
              style={GlobalStyles.secondaryButton}
              labelStyle={GlobalStyles.resumeText}
              loading={isValidating}
              disabled={isValidating || loading}>
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
