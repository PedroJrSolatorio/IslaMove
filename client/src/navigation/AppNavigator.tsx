import {createNativeStackNavigator} from '@react-navigation/native-stack';
import DriverHome from '../screens/DriverHome';
import PassengerTabs from '../navigation/PassengerTabs';
import {useAuth} from '../context/AuthContext';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const {userRole} = useAuth();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false, // This will hide the header for all screens in this navigator
      }}>
      {userRole === 'driver' && (
        <Stack.Screen name="DriverHome" component={DriverHome} />
      )}
      {userRole === 'passenger' && (
        <>
          <Stack.Screen name="PassengerTabs" component={PassengerTabs} />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
