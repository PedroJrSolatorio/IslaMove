/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import React from 'react';
import {Provider as PaperProvider} from 'react-native-paper';
import customTheme from './src/styles/theme';
import Toast, {BaseToast, ErrorToast} from 'react-native-toast-message';

// Custom toast config to make it larger
const toastConfig = {
  success: props => (
    <BaseToast
      {...props}
      style={{borderLeftColor: '#4CAF50', height: 80}}
      text1Style={{fontSize: 18, fontWeight: 'bold'}}
      text2Style={{fontSize: 16}}
    />
  ),
  info: props => (
    <BaseToast
      {...props}
      style={{borderLeftColor: '#2196F3', height: 80}}
      contentContainerStyle={{paddingHorizontal: 15}}
      text1Style={{
        fontSize: 18,
        fontWeight: 'bold',
      }}
      text2Style={{
        fontSize: 16,
      }}
    />
  ),
  error: props => (
    <ErrorToast
      {...props}
      style={{height: 80}}
      text1Style={{fontSize: 18, fontWeight: 'bold'}}
      text2Style={{fontSize: 16}}
    />
  ),
};

const Main = () => (
  <PaperProvider theme={customTheme}>
    <App />
    <Toast config={toastConfig} />
  </PaperProvider>
);

// NOTE: added lines 8-16 for PaperProvider to use a custom theme

// AppRegistry.registerComponent(appName, () => App); //use this if not using PaperProvider
AppRegistry.registerComponent(appName, () => Main);
