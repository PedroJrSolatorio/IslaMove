import {createNativeStackNavigator} from '@react-navigation/native-stack';
import AdminTabs from '../navigation/AdminTabs';
import DriverTabs from './DriverTabs';
import PassengerTabs from '../navigation/PassengerTabs';
import BookRide from '../screens/BookRide';
import {useAuth} from '../context/AuthContext';

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
        <Stack.Screen name="DriverTabs" component={DriverTabs} />
      )}
      {userRole === 'passenger' && (
        <>
          <Stack.Screen name="PassengerTabs" component={PassengerTabs} />
          <Stack.Screen name="BookRide" component={BookRide} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
