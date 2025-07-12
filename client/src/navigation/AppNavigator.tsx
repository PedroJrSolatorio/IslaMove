import {createNativeStackNavigator} from '@react-navigation/native-stack';
import AdminTabs from '../navigation/AdminTabs';
import DriverTabs from './DriverTabs';
import PassengerTabs from '../navigation/PassengerTabs';
import BookRide from '../screens/BookRide';
import RideHistory from '../screens/RideHistory';
import Settings from '../screens/Settings';
import MapLocationPicker from '../components/MapLocationPicker';
import {useAuth} from '../context/AuthContext';
import {IconButton} from 'react-native-paper';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const {userRole} = useAuth();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false, // This will hide the header for all screens in this navigator
      }}>
      {userRole === 'admin' && (
        <Stack.Screen name="AdminTabs" component={AdminTabs} />
      )}
      {userRole === 'driver' && (
        <>
          <Stack.Screen name="DriverTabs" component={DriverTabs} />
          <Stack.Screen
            name="Settings"
            component={Settings}
            options={({navigation, route}) => ({
              headerShown: true,
              headerTitle: 'Settings Page',
              headerBackVisible: false, // Hide the default back button
              headerLeft: () => (
                // Custom right component for the back arrow
                <IconButton
                  icon="arrow-left"
                  iconColor="#000"
                  size={24}
                  onPress={() => navigation.goBack()}
                />
              ),
              headerTitleAlign: 'center',
              headerShadowVisible: true,
              headerStyle: {
                // Optional: for custom header background color
                backgroundColor: '#f8f8f8',
              },
              headerTintColor: '#000', // Optional: color for title and back button icon
            })}
          />
        </>
      )}
      {userRole === 'passenger' && (
        <>
          <Stack.Screen name="PassengerTabs" component={PassengerTabs} />
          <Stack.Screen name="BookRide" component={BookRide} />
          <Stack.Screen
            name="MapLocationPicker"
            component={MapLocationPicker}
            options={{
              headerShown: false,
              presentation: 'modal',
            }}
          />
          <Stack.Screen name="RideHistory" component={RideHistory} />
          <Stack.Screen
            name="Settings"
            component={Settings}
            options={({navigation, route}) => ({
              headerShown: true,
              headerTitle: 'Settings Page',
              headerBackVisible: false, // Hide the default back button
              headerLeft: () => (
                // Custom right component for the back arrow
                <IconButton
                  icon="arrow-left"
                  iconColor="#000"
                  size={24}
                  onPress={() => navigation.goBack()}
                />
              ),
              headerTitleAlign: 'center',
              headerShadowVisible: true,
              headerStyle: {
                // Optional: for custom header background color
                backgroundColor: '#f8f8f8',
              },
              headerTintColor: '#000', // Optional: color for title and back button icon
            })}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
