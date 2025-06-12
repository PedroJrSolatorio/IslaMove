import React from 'react';
import {View, Text, ImageBackground, StyleSheet} from 'react-native';
import {Button} from 'react-native-paper';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useNavigation} from '@react-navigation/native';
import type {RootStackParamList} from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'RegisterSelection'
>;

const RegisterSelectionScreen = () => {
  const navigation = useNavigation<NavigationProp>();

  return (
    <ImageBackground
      source={require('../assets/images/welcomeImg.webp')}
      style={styles.background}>
      <View style={styles.overlay}>
        <Text style={styles.title}>Create an Account</Text>
        <Text style={styles.subtitle}>Choose your role to continue.</Text>

        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            style={styles.button}
            onPress={() => navigation.navigate('RegisterPassenger')}>
            Register as Passenger
          </Button>

          <Button
            mode="contained"
            style={[styles.button, styles.driverButton]}
            onPress={() => navigation.navigate('RegisterDriver')}>
            Register as Driver
          </Button>

          <Button
            mode="text"
            icon="arrow-left"
            labelStyle={styles.backButtonText}
            onPress={() => navigation.navigate('Login')}>
            Back
          </Button>
        </View>
      </View>
    </ImageBackground>
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
  button: {
    marginVertical: 10,
    backgroundColor: '#007AFF',
  },
  driverButton: {
    backgroundColor: '#FF9500',
  },
  backButtonText: {
    fontSize: 16,
    color: 'lightblue',
    textDecorationLine: 'underline',
  },
});

export default RegisterSelectionScreen;
