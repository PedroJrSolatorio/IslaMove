import React, {useState, useContext, useEffect} from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Platform,
  BackHandler,
  ToastAndroid,
} from 'react-native';
import {Button, Text} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {GlobalStyles} from '../styles/GlobalStyles';
import {AuthContext} from '../context/AuthContext';

// Dashboard tabs
import DriverManagement from './adminTabs/dManagement';
import PassengerManagement from './adminTabs/pManagement';
import ZoneFareCalculator from './adminTabs/zoneFare';
import AdminStats from './adminTabs/adminStats';
import {useProfile} from '../context/ProfileContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function AdminHome() {
  const {userToken, userRole, logout} = useContext(AuthContext);
  const navigation = useNavigation<NavigationProp>();
  const [activeTab, setActiveTab] = useState('stats');
  const {profileData} = useProfile();

  // Custom back handler (Android only)
  useEffect(() => {
    if (Platform.OS === 'android') {
      let backPressCount = 0;

      const backAction = () => {
        if (backPressCount === 0) {
          backPressCount += 1;
          ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
          setTimeout(() => (backPressCount = 0), 2000);
          return true;
        }
        BackHandler.exitApp();
        return false;
      };

      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        backAction,
      );

      return () => backHandler.remove();
    }
  }, []);

  // Simulate loading
  const loading = userToken === null || userRole === null;

  useEffect(() => {
    if (!loading && (!userToken || userRole !== 'admin')) {
      navigation.navigate('Login'); // Use your screen name
    }
  }, [loading, userToken, userRole]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'drivers':
        return <DriverManagement />;
      case 'passengers':
        return <PassengerManagement />;
      case 'fares':
        return <ZoneFareCalculator />;
      case 'stats':
      default:
        return <AdminStats />;
    }
  };

  return (
    <View style={GlobalStyles.container}>
      <View style={GlobalStyles.header}>
        <Text style={GlobalStyles.headerTitle}>
          Admin Dashboard (
          {profileData?.firstName?.split(' ')[0] || 'Passenger'}!)
        </Text>
        <View style={{height: 46}} />
      </View>

      <View style={styles.tabBar}>
        <Button
          mode={activeTab === 'stats' ? 'contained' : 'text'}
          onPress={() => setActiveTab('stats')}
          style={styles.tabButton}>
          Stats
        </Button>
        <Button
          mode={activeTab === 'drivers' ? 'contained' : 'text'}
          onPress={() => setActiveTab('drivers')}
          style={styles.tabButton}>
          Drivers
        </Button>
        <Button
          mode={activeTab === 'passengers' ? 'contained' : 'text'}
          onPress={() => setActiveTab('passengers')}
          style={styles.tabButton}>
          Passengers
        </Button>
        <Button
          mode={activeTab === 'fares' ? 'contained' : 'text'}
          onPress={() => setActiveTab('fares')}
          style={styles.tabButton}>
          Fares
        </Button>
      </View>

      <View style={styles.content}>{renderTabContent()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabButton: {
    flex: 1,
    borderRadius: 0,
  },
  content: {
    flex: 1,
  },
});
