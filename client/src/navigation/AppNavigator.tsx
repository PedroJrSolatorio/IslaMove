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
import {StatusBar, Text, View} from 'react-native';
import DriverIDDocumentsScreen from '../screens/driverScreens/IDDocumentsScreen';
import PassengerIDDocumentsScreen from '../screens/passengerScreens/IDDocumentsScreen';
import SavedAddressesScreen from '../screens/passengerScreens/SavedAddressesScreen';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const {userRole} = useAuth();
  const insets = useSafeAreaInsets();

  type CustomHeaderProps = {
    navigation: any; // Replace 'any' with a proper type if possible
    title: string;
  };

  // A reusable custom header component to avoid repetition
  const CustomHeader = ({navigation, title}: CustomHeaderProps) => (
    <View
      style={{
        height: 75 + insets.top, // Add top inset to the header height
        backgroundColor: '#f8f8f8', // Header background color
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: insets.top, // Apply top padding to push content below status bar
        position: 'relative', // Necessary for absolute positioning of title
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
          top: insets.top,
          bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
        <Text style={{fontSize: 20, fontWeight: 'bold'}}>{title}</Text>
      </View>
    </View>
  );

  return (
    <>
      {/* Set global StatusBar style for screens within this navigator */}
      <StatusBar
        barStyle="dark-content" // Assuming light header background, so dark text is visible
        backgroundColor="transparent" // Make status bar transparent
        translucent={true} // Allow content to draw under status bar on Android
      />
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
              options={({navigation}) => ({
                headerShown: true,
                header: () => (
                  <CustomHeader
                    navigation={navigation}
                    title="Account & Security"
                  />
                ),
              })}
            />
            <Stack.Screen
              name="IDDocuments"
              component={DriverIDDocumentsScreen}
              options={({navigation}) => ({
                headerShown: true,
                header: () => (
                  <CustomHeader
                    navigation={navigation}
                    title="ID Document Details"
                  />
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
                  <CustomHeader
                    navigation={navigation}
                    title="Account & Security"
                  />
                ),
              })}
            />
            <Stack.Screen
              name="IDDocuments"
              component={PassengerIDDocumentsScreen}
              options={({navigation, route}) => ({
                headerShown: true,
                header: () => (
                  <CustomHeader
                    navigation={navigation}
                    title="ID Document Details"
                  />
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
    </>
  );
};

export default AppNavigator;
