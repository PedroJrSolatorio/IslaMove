import React, {useState, useContext} from 'react';
import {
  View,
  ScrollView,
  ActivityIndicator,
  Platform,
  BackHandler,
  ToastAndroid,
} from 'react-native';
import {Card, Title, Paragraph, Button, Avatar, Text} from 'react-native-paper';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {GlobalStyles} from '../styles/GlobalStyles';
import {TabsStyles} from '../styles/TabsStyles';
import {useAuth} from '../context/AuthContext'; // this or {AuthContext} will work
// import {AuthContext} from '../context/AuthContext';
import {useProfile} from '../context/ProfileContext';
import api from '../../utils/api';

let backPressCount = 0;

const PassengerHome = () => {
  const navigation = useNavigation();
  const {userToken, userRole, logout} = useAuth();
  // const {userToken, userRole, logout} = useContext(AuthContext);
  const {profileData, refreshProfile} = useProfile();
  const [initialLoad, setInitialLoad] = useState(true);
  const [recentRides, setRecentRides] = useState<any[]>([]);
  const [ridesLoading, setRidesLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      if (!profileData || !profileData._id) {
        refreshProfile()
          .then(() => setNetworkError(false))
          .catch(() => setNetworkError(true))
          .finally(() => setInitialLoad(false));
      } else {
        setInitialLoad(false);
      }
      return () => {};
    }, []),
  );

  // Use this effect just once when component mounts
  React.useEffect(() => {
    if (profileData && profileData._id) {
      setInitialLoad(false);
    }
  }, [profileData]);

  // Refresh profile data when the screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (!profileData || !profileData._id) {
        refreshProfile().finally(() => {
          setInitialLoad(false);
        });
      } else {
        setInitialLoad(false);
      }
      return () => {};
    }, []),
  );

  useFocusEffect(
    React.useCallback(() => {
      const fetchRecentRides = async () => {
        setRidesLoading(true);
        try {
          const res = await api.get('/api/rides/recent');
          if (res.data.success) {
            setRecentRides(res.data.rides);
          }
        } catch (err) {
          console.error('Failed to fetch recent rides:', err);
        }
        setRidesLoading(false);
      };
      fetchRecentRides();
    }, []),
  );

  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS === 'android') {
        const backAction = () => {
          if (backPressCount === 0) {
            backPressCount += 1;
            ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
            setTimeout(() => (backPressCount = 0), 2000);
            return true;
          }
          BackHandler.exitApp();
          return true;
        };

        const backHandler = BackHandler.addEventListener(
          'hardwareBackPress',
          backAction,
        );

        return () => backHandler.remove(); // Proper cleanup
      }
    }, []),
  );

  // Only show loading on initial app load, not on every navigation
  if (initialLoad && (!profileData || !profileData._id)) {
    return (
      <View style={GlobalStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text>Loading profile...</Text>
        {networkError && (
          <Button
            mode="contained"
            style={{marginTop: 16}}
            onPress={() => {
              setInitialLoad(true);
              setNetworkError(false);
              refreshProfile()
                .then(() => setNetworkError(false))
                .catch(() => setNetworkError(true))
                .finally(() => setInitialLoad(false));
            }}>
            Retry
          </Button>
        )}
      </View>
    );
  }

  if (!userToken || userRole !== 'passenger') {
    logout();
    return null;
  }

  return (
    <>
      <View style={GlobalStyles.header}>
        <Text style={GlobalStyles.headerTitle}>
          Welcome back, {profileData?.firstName?.split(' ')[0] || 'Passenger'}!
        </Text>
        <View style={{height: 46}} />
      </View>
      <ScrollView style={GlobalStyles.container}>
        <Card style={TabsStyles.rideCard}>
          <View style={[TabsStyles.rideCardRow, {paddingVertical: 16}]}>
            <Card.Content>
              <Title>Book a Ride</Title>
              <Paragraph>Where are you going?</Paragraph>
            </Card.Content>
            <Card.Actions>
              <Button
                mode="contained"
                onPress={() => navigation.navigate('BookRide' as never)}>
                Book Now
              </Button>
            </Card.Actions>
          </View>
        </Card>

        <Card style={TabsStyles.recentRidesCard}>
          <Card.Content>
            <Title>Recent Rides</Title>
            {ridesLoading ? (
              <ActivityIndicator size="small" color="#6200ee" />
            ) : recentRides.length === 0 ? (
              <Text>No recent rides found.</Text>
            ) : (
              recentRides.map(ride => (
                <View key={ride._id} style={TabsStyles.recentRideItem}>
                  <Avatar.Icon
                    size={30}
                    icon="car"
                    style={TabsStyles.recentRideIcon}
                  />
                  <View style={TabsStyles.recentRideDetails}>
                    <Text style={TabsStyles.recentRideDestination}>
                      {ride.toZone?.name ||
                        ride.destinationLocation?.address ||
                        'Destination'}
                    </Text>
                    <Text style={TabsStyles.recentRideDate}>
                      {new Date(ride.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={TabsStyles.recentRidePrice}>₱{ride.price}</Text>
                </View>
              ))
            )}
          </Card.Content>
          <Card.Actions>
            <Button onPress={() => navigation.navigate('RideHistory' as never)}>
              View All
            </Button>
          </Card.Actions>
        </Card>
      </ScrollView>
    </>
  );
};

export default PassengerHome;
