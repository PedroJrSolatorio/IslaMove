import {createNativeStackNavigator} from '@react-navigation/native-stack';
import AdminTabs from '../navigation/AdminTabs';
import DriverTabs from './DriverTabs';
import PassengerTabs from '../navigation/PassengerTabs';
import BookRide from '../screens/BookRide';
import RideHistory from '../screens/RideHistory';
import AccountSecurity from '../screens/AccountSecurity';
import MapLocationPicker from '../components/MapLocationPicker';
import {useAuth} from '../context/AuthContext';
import {IconButton} from 'react-native-paper';
import DriverProfileInfoScreen from '../screens/driverScreens/ProfileInfoScreen';
import DriverVehicleDocumentsScreen from '../screens/driverScreens/DriverVehicleDocumentsScreen';
import PassengerProfileInfoScreen from '../screens/passengerScreens/ProfileInfoScreen';
import {Text, View} from 'react-native';
import DriverIDDocumentsScreen from '../screens/driverScreens/IDDocumentsScreen';
import PassengerIDDocumentsScreen from '../screens/passengerScreens/IDDocumentsScreen';
import SavedAddressesScreen from '../screens/passengerScreens/SavedAddressesScreen';

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
            name="ProfileInfo"
            component={DriverProfileInfoScreen}
          />
          <Stack.Screen
            name="AccountSecurity"
            component={AccountSecurity}
            options={({navigation, route}) => ({
              headerShown: true,
              headerTitle: 'Accoun & tSecurity',
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
          <Stack.Screen
            name="IDDocuments"
            component={DriverIDDocumentsScreen}
            options={({navigation, route}) => ({
              headerShown: true,
              header: () => (
                <View
                  style={{
                    height: 80,
                    backgroundColor: '#f8f8f8',
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                  }}>
                  <IconButton
                    icon="arrow-left"
                    iconColor="#000"
                    size={24}
                    onPress={() => navigation.goBack()}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      alignItems: 'center',
                    }}>
                    <Text style={{fontSize: 20, fontWeight: 'bold'}}>
                      ID Document Details
                    </Text>
                  </View>
                </View>
              ),
            })}
          />
          <Stack.Screen
            name="DriverVehicleDocuments"
            component={DriverVehicleDocumentsScreen}
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
            name="ProfileInfo"
            component={PassengerProfileInfoScreen}
          />
          <Stack.Screen
            name="AccountSecurity"
            component={AccountSecurity}
            options={({navigation, route}) => ({
              headerShown: true,
              header: () => (
                <View
                  style={{
                    height: 80,
                    backgroundColor: '#f8f8f8',
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                  }}>
                  <IconButton
                    icon="arrow-left"
                    iconColor="#000"
                    size={24}
                    onPress={() => navigation.goBack()}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      alignItems: 'center',
                    }}>
                    <Text style={{fontSize: 20, fontWeight: 'bold'}}>
                      Account & Security
                    </Text>
                  </View>
                </View>
              ),
            })}
          />
          <Stack.Screen
            name="IDDocuments"
            component={PassengerIDDocumentsScreen}
            options={({navigation, route}) => ({
              headerShown: true,
              header: () => (
                <View
                  style={{
                    height: 80,
                    backgroundColor: '#f8f8f8',
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                  }}>
                  <IconButton
                    icon="arrow-left"
                    iconColor="#000"
                    size={24}
                    onPress={() => navigation.goBack()}
                  />
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      alignItems: 'center',
                    }}>
                    <Text style={{fontSize: 20, fontWeight: 'bold'}}>
                      ID Document Details
                    </Text>
                  </View>
                </View>
              ),
            })}
          />
          <Stack.Screen
            name="SavedAddresses"
            component={SavedAddressesScreen}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
