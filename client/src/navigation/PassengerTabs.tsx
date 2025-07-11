import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import PassengerHome from '../screens/PassengerHome';
import PassengerProfile from '../screens/PassengerProfile';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const Tab = createBottomTabNavigator();

const PassengerTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false, // hide header if you want
        tabBarActiveTintColor: '#3498db',
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
        name="Profile"
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
