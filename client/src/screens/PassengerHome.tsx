import React, {useState} from 'react';
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
import {useAuth} from '../context/AuthContext';
import {useProfile} from '../context/ProfileContext';

let backPressCount = 0;

const PassengerHome = () => {
  const navigation = useNavigation();
  const {userToken, userRole, logout} = useAuth();
  const {profileData, refreshProfile} = useProfile();
  const [initialLoad, setInitialLoad] = useState(true);

  // Use this effect just once when component mounts
  React.useEffect(() => {
    // If profile data is already loaded, don't show loading indicator
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
  if (initialLoad && !profileData._id) {
    return (
      <View style={GlobalStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text>Loading profile...</Text>
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
          Welcome back, {profileData.fullName.split(' ')[0] || 'Passenger'}!
        </Text>
        <View style={{height: 46}} />
      </View>
      <ScrollView style={GlobalStyles.container}>
        <Card style={TabsStyles.bookRideCard}>
          <Card.Content>
            <Title>Book a Ride</Title>
            <Paragraph>Where are you going today?</Paragraph>
          </Card.Content>
          <Card.Actions>
            <Button
              mode="contained"
              onPress={() => navigation.navigate('BookRide' as never)}>
              Book Now
            </Button>
          </Card.Actions>
        </Card>

        <Card style={TabsStyles.recentRidesCard}>
          <Card.Content>
            <Title>Recent Rides</Title>

            <View style={TabsStyles.recentRideItem}>
              <Avatar.Icon
                size={30}
                icon="car"
                style={TabsStyles.recentRideIcon}
              />
              <View style={TabsStyles.recentRideDetails}>
                <Text style={TabsStyles.recentRideDestination}>
                  Downtown Mall
                </Text>
                <Text style={TabsStyles.recentRideDate}>March 12, 2025</Text>
              </View>
              <Text style={TabsStyles.recentRidePrice}>$12.50</Text>
            </View>

            <View style={TabsStyles.recentRideItem}>
              <Avatar.Icon
                size={30}
                icon="car"
                style={TabsStyles.recentRideIcon}
              />
              <View style={TabsStyles.recentRideDetails}>
                <Text style={TabsStyles.recentRideDestination}>
                  Airport Terminal B
                </Text>
                <Text style={TabsStyles.recentRideDate}>March 10, 2025</Text>
              </View>
              <Text style={TabsStyles.recentRidePrice}>$34.75</Text>
            </View>
          </Card.Content>
          <Card.Actions>
            <Button onPress={() => navigation.navigate('RideHistory' as never)}>
              View All
            </Button>
          </Card.Actions>
        </Card>

        <Card style={TabsStyles.recentRidesCard}>
          <Card.Content>
            <Title>Recent Rides</Title>

            <View style={TabsStyles.recentRideItem}>
              <Avatar.Icon
                size={30}
                icon="car"
                style={TabsStyles.recentRideIcon}
              />
              <View style={TabsStyles.recentRideDetails}>
                <Text style={TabsStyles.recentRideDestination}>
                  Downtown Mall
                </Text>
                <Text style={TabsStyles.recentRideDate}>March 12, 2025</Text>
              </View>
              <Text style={TabsStyles.recentRidePrice}>$12.50</Text>
            </View>

            <View style={TabsStyles.recentRideItem}>
              <Avatar.Icon
                size={30}
                icon="car"
                style={TabsStyles.recentRideIcon}
              />
              <View style={TabsStyles.recentRideDetails}>
                <Text style={TabsStyles.recentRideDestination}>
                  Airport Terminal B
                </Text>
                <Text style={TabsStyles.recentRideDate}>March 10, 2025</Text>
              </View>
              <Text style={TabsStyles.recentRidePrice}>$34.75</Text>
            </View>
          </Card.Content>
          <Card.Actions>
            <Button onPress={() => navigation.navigate('RideHistory' as never)}>
              View All
            </Button>
          </Card.Actions>
        </Card>

        <Card style={TabsStyles.recentRidesCard}>
          <Card.Content>
            <Title>Recent Rides</Title>

            <View style={TabsStyles.recentRideItem}>
              <Avatar.Icon
                size={30}
                icon="car"
                style={TabsStyles.recentRideIcon}
              />
              <View style={TabsStyles.recentRideDetails}>
                <Text style={TabsStyles.recentRideDestination}>
                  Downtown Mall
                </Text>
                <Text style={TabsStyles.recentRideDate}>March 12, 2025</Text>
              </View>
              <Text style={TabsStyles.recentRidePrice}>$12.50</Text>
            </View>

            <View style={TabsStyles.recentRideItem}>
              <Avatar.Icon
                size={30}
                icon="car"
                style={TabsStyles.recentRideIcon}
              />
              <View style={TabsStyles.recentRideDetails}>
                <Text style={TabsStyles.recentRideDestination}>
                  Airport Terminal B
                </Text>
                <Text style={TabsStyles.recentRideDate}>March 10, 2025</Text>
              </View>
              <Text style={TabsStyles.recentRidePrice}>$34.75</Text>
            </View>
          </Card.Content>
          <Card.Actions>
            <Button onPress={() => navigation.navigate('RideHistory' as never)}>
              View All
            </Button>
          </Card.Actions>
        </Card>

        {/* <Button mode="outlined" style={{marginTop: 32}} onPress={logout}>
        Logout
      </Button> */}
      </ScrollView>
    </>
  );
};

export default PassengerHome;
