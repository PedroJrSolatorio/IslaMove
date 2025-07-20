import React, {useState} from 'react';
import {
  View,
  Text,
  ImageBackground,
  StyleSheet,
  Alert,
  StatusBar,
} from 'react-native';
import {Button, Divider} from 'react-native-paper';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/types';
import {AxiosError} from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GoogleSignin,
  GoogleSigninButton,
} from '@react-native-google-signin/google-signin';
import api, {CustomAxiosRequestConfig} from '../../utils/api';
import {GlobalStyles} from '../styles/GlobalStyles';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'RegisterSelection'
>;

const RegisterSelectionScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const [googleLoading, setGoogleLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const handleGoogleSignUp = async (role: string) => {
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      // Clear any previous sign-in
      await GoogleSignin.signOut();

      const signInResult = await GoogleSignin.signIn();
      console.log('Google Sign-In Result:', signInResult);

      if (signInResult.type !== 'success') {
        Alert.alert('Sign Up', 'Google Sign-Up was cancelled or failed');
        return;
      }

      const {data} = signInResult;

      // Validate that we have the required data
      if (!data.idToken) {
        Alert.alert('Error', 'Failed to get Google ID token');
        return;
      }

      console.log('Sending to backend:', {
        idToken: data.idToken ? 'Present' : 'Missing',
        email: data.user.email,
        name: data.user.name,
        role: role,
      });

      const config: CustomAxiosRequestConfig = {
        skipAuthInterceptor: true,
      };

      // Send to Google signup endpoint
      const response = await api.post(
        `/api/auth/google-signup`,
        {
          idToken: data.idToken,
          email: data.user.email,
          name: data.user.name,
          role: role,
        },
        config,
      );

      console.log('Backend response:', response.data);

      if (response.status === 200) {
        // Store temporary token and user data
        await AsyncStorage.setItem('tempToken', response.data.token);
        await AsyncStorage.setItem(
          'googleUserData',
          JSON.stringify({
            firstName: response.data.firstName,
            lastName: response.data.lastName,
            email: response.data.email,
            userId: response.data.userId,
            isProfileComplete: response.data.isProfileComplete,
          }),
        );

        // Navigate to appropriate registration screen
        if (role === 'driver') {
          navigation.navigate('RegisterDriver');
        } else {
          navigation.navigate('RegisterPassenger');
        }
      }
    } catch (error: any) {
      console.error('Google Sign-Up error:', error);
      if (error.response) {
        console.error('Backend error response:', error.response.data);
        console.error('Backend error status:', error.response.status);
      }
      const axiosError = error as AxiosError<{message?: string}>;
      const backendMessage =
        axiosError.response?.data?.message || 'Google Sign-Up failed';
      Alert.alert('Google Sign-Up Failed', backendMessage);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={{flex: 1}}>
      <StatusBar
        barStyle="light-content" // Since having a background image, light content might work better
        backgroundColor="transparent"
        translucent={true}
      />
      <ImageBackground
        source={require('../assets/images/IslaMove_background.png')}
        style={styles.background}>
        <View style={[styles.overlay, {paddingTop: insets.top}]}>
          <Text style={styles.title}>Create an Account</Text>
          <Text style={styles.subtitle}>Choose your role to continue.</Text>

          <View style={styles.buttonContainer}>
            <Button
              mode="contained"
              style={GlobalStyles.primaryButton}
              onPress={() => navigation.navigate('RegisterPassenger')}>
              Register as Passenger (Email)
            </Button>

            <GoogleSigninButton
              style={styles.googleButton}
              size={GoogleSigninButton.Size.Wide}
              color={GoogleSigninButton.Color.Light}
              onPress={() => handleGoogleSignUp('passenger')}
              disabled={googleLoading}
            />

            <View style={GlobalStyles.dividerContainer}>
              <Divider style={GlobalStyles.divider} />
              <Text style={GlobalStyles.dividerText}>or</Text>
              <Divider style={GlobalStyles.divider} />
            </View>

            <Button
              mode="contained"
              style={styles.driverButton}
              onPress={() => navigation.navigate('RegisterDriver')}>
              Register as Driver (Email)
            </Button>

            <GoogleSigninButton
              style={styles.googleButton}
              size={GoogleSigninButton.Size.Wide}
              color={GoogleSigninButton.Color.Light}
              onPress={() => handleGoogleSignUp('driver')}
              disabled={googleLoading}
            />

            <Button
              mode="text"
              icon="arrow-left"
              labelStyle={GlobalStyles.registerButtonText}
              onPress={() => navigation.navigate('Login')}>
              Back
            </Button>

            {googleLoading && (
              <Text style={styles.loadingText}>
                Setting up Google account...
              </Text>
            )}
          </View>
        </View>
        <View style={{height: insets.bottom}} />
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    marginBottom: 30,
  },
  buttonContainer: {
    width: '80%',
  },
  driverButton: {
    marginVertical: 10,
    backgroundColor: '#FF9500',
  },
  googleButton: {
    width: '100%',
    height: 48,
    marginBottom: 15,
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
  },
});

export default RegisterSelectionScreen;
