import {createNativeStackNavigator} from '@react-navigation/native-stack';
import AdminHome from '../screens/AdminHome';
import DriverHome from '../screens/DriverHome';
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
        <Stack.Screen name="AdminHome" component={AdminHome} />
      )}
      {userRole === 'driver' && (
        <Stack.Screen name="DriverHome" component={DriverHome} />
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
