import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import PassengerHome from '../screens/PassengerHome';
import RideHistory from '../screens/RideHistory';
import PassengerProfile from '../screens/PassengerProfile';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Notifications from '../screens/Notifications';

const Tab = createBottomTabNavigator();

const PassengerTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1877F2',
        tabBarInactiveTintColor: 'gray',
      }}>
      <Tab.Screen
        name="Home"
        component={PassengerHome}
        options={{
          tabBarIcon: ({color, size}) => (
            <Icon name="home" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={RideHistory}
        options={{
          tabBarIcon: ({color, size}) => (
            <Icon name="history" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={Notifications}
        options={{
          tabBarIcon: ({color, size}) => (
            <Icon name="bell" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Account"
        component={PassengerProfile}
        options={{
          tabBarIcon: ({color, size}) => (
            <Icon name="account" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default PassengerTabs;
