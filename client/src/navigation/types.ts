interface Location {
  type: string;
  coordinates: [number, number];
  address: string;
  mainText?: string;
  secondaryText?: string;
}

// Tab Navigator Param Lists
export type PassengerTabParamList = {
  Home: undefined;
  History: undefined;
  Notifications: undefined;
  Account: undefined;
};

export type DriverTabParamList = {
  Home: undefined;
  History: undefined;
  Notifications: undefined;
  Profile: undefined;
};

export type AdminTabParamList = {
  Home: undefined;
  Users: undefined;
  Analytics: undefined;
  Notifications: undefined;
};

// Main Stack Navigator Param List
export type RootStackParamList = {
  // Auth Screens
  Login: undefined;
  RegisterSelection: undefined;
  RegisterDriver: undefined;
  RegisterPassenger: undefined;

  // Tab Navigators
  AdminTabs: undefined;
  DriverTabs: undefined;
  PassengerTabs:
    | {
        screen?: keyof PassengerTabParamList;
      }
    | undefined;

  // Common Screens
  RideDetails: {rideId: string};
  RideHistory: undefined;
  ProfileInfo: {openCategoryModal?: boolean} | undefined;
  AccountSecurity: undefined;
  IDDocuments: undefined;

  // Passenger Specific Screens
  BookRide: undefined;
  SavedAddresses: undefined;
  MapLocationPicker: {
    callbackId: string;
    preselectedLocation?: Location;
  };

  // Driver Specific Screens
  DriverVehicleDocuments: undefined;

  // Modal/Overlay Screens
  Notifications: undefined;
};

// Navigation Props Types
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {BottomTabNavigationProp} from '@react-navigation/bottom-tabs';

export type RootStackNavigationProp =
  NativeStackNavigationProp<RootStackParamList>;
export type PassengerTabNavigationProp =
  BottomTabNavigationProp<PassengerTabParamList>;
export type DriverTabNavigationProp =
  BottomTabNavigationProp<DriverTabParamList>;
export type AdminTabNavigationProp = BottomTabNavigationProp<AdminTabParamList>;
