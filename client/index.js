/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import React from 'react';
import {Provider as PaperProvider} from 'react-native-paper';
import customTheme from './src/styles/theme';

const Main = () => (
  <PaperProvider theme={customTheme}>
    <App />
  </PaperProvider>
);

// NOTE: added lines 8-16 for PaperProvider to use a custom theme

// AppRegistry.registerComponent(appName, () => App); //use this if not using PaperProvider
AppRegistry.registerComponent(appName, () => Main);
