import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {AuthProvider, useAuth} from './src/context/AuthContext';
import AuthNavigator from './src/navigation/AuthNavigator';
import AppNavigator from './src/navigation/AppNavigator';
import {ProfileProvider} from './src/context/ProfileContext';
import {SafeAreaProvider} from 'react-native-safe-area-context';

const RootNavigation = () => {
  const {userToken, userRole} = useAuth();

  if (!userToken || !userRole) return <AuthNavigator />;
  return <AppNavigator />;
};

const App = () => {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ProfileProvider>
          <NavigationContainer>
            <RootNavigation />
          </NavigationContainer>
        </ProfileProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
};

export default App;
