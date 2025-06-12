import {createNativeStackNavigator} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../navigation/types';
import LoginScreen from '../screens/Login';
import RegisterSelectionScreen from '../screens/RegSelect';
import RegisterDriverScreen from '../screens/RegDriver';
import RegisterPassengerScreen from '../screens/RegPassenger';

const Stack = createNativeStackNavigator<RootStackParamList>();

const AuthNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false, // This will hide the header for all screens in this navigator
    }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen
      name="RegisterSelection"
      component={RegisterSelectionScreen}
    />
    <Stack.Screen name="RegisterDriver" component={RegisterDriverScreen} />
    <Stack.Screen
      name="RegisterPassenger"
      component={RegisterPassengerScreen}
    />
  </Stack.Navigator>
);

export default AuthNavigator;
