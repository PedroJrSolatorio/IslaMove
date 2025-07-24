import React from 'react';
import {View, ScrollView, StatusBar, StyleSheet} from 'react-native';
import {
  Card,
  Title,
  Text,
  Avatar,
  Button,
  Divider,
  Chip,
} from 'react-native-paper';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {GlobalStyles} from '../../styles/GlobalStyles'; // Assuming you have GlobalStyles
import {Colors} from '../../styles/Colors'; // Assuming you have Colors

const RideDetails = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {ride}: any = route.params;
  const insets = useSafeAreaInsets();

  if (!ride) {
    return (
      <View style={GlobalStyles.container}>
        <Text style={{textAlign: 'center', marginTop: 50}}>
          Ride details not found.
        </Text>
        <Button
          style={{margin: 16}}
          mode="outlined"
          onPress={() => navigation.goBack()}>
          Back
        </Button>
      </View>
    );
  }

  // Dummy driver data for demonstration
  const driver = {
    name: 'Matthew Thompson',
    avatar: 'https://via.placeholder.com/150/FF5733/FFFFFF?text=MT', // Placeholder image
    rating: 4.9,
    reviews: 2204,
  };

  return (
    <View style={GlobalStyles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent={true}
      />
      <View style={[styles.header, {paddingTop: insets.top + 10}]}>
        <Icon
          name="arrow-left"
          size={24}
          color="#000000"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        />
        <Title style={styles.headerTitle}>Ride Details</Title>
        <Icon name="dots-vertical" size={24} color="#000000" />
      </View>

      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.locationContainer}>
              <View style={styles.locationRow}>
                <Icon
                  name="map-marker-outline"
                  size={20}
                  color={Colors.success}
                />
                <View style={styles.locationTextContainer}>
                  <Text style={styles.locationLabel}>New York University</Text>
                  <Text style={styles.locationAddress}>
                    New York, NY 10012, USA
                  </Text>
                </View>
                <Text style={styles.timeText}>14:25 PM</Text>
              </View>
              <View style={styles.locationLine} />
              <View style={styles.locationRow}>
                <Icon name="flag-checkered" size={20} color={Colors.danger} />
                <View style={styles.locationTextContainer}>
                  <Text style={styles.locationLabel}>
                    Jefferson Market Library
                  </Text>
                  <Text style={styles.locationAddress}>
                    425 6th Ave. New York, NY 10011, USA
                  </Text>
                </View>
                <Text style={styles.timeText}>14:37 PM</Text>
              </View>
              <Text style={styles.tripDuration}>
                Yesterday, Dec 21, 2024 • 12 mins
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Driver Information */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.driverInfoContainer}>
              <Avatar.Image size={60} source={{uri: driver.avatar}} />
              <View style={styles.driverDetails}>
                <View style={styles.driverNameVerification}>
                  <Text style={styles.driverName}>{driver.name}</Text>
                  <Icon name="check-circle" size={18} color={Colors.primary} />
                </View>
                <View style={styles.driverRating}>
                  <Icon name="star" size={16} color={Colors.yellow} />
                  <Text style={styles.ratingText}>{driver.rating}</Text>
                  <Text style={styles.reviewsText}>
                    {driver.reviews} reviews
                  </Text>
                </View>
              </View>
              <View style={styles.driverActions}>
                <Button
                  icon="chat"
                  mode="outlined"
                  onPress={() => console.log('Chat')}
                  style={styles.actionButton}>
                  Chat
                </Button>
                <Button
                  icon="phone"
                  mode="outlined"
                  onPress={() => console.log('Call')}
                  style={styles.actionButton}>
                  Call
                </Button>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Price Details */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.priceItem}>
              Price (/passenger){' '}
              <Text style={styles.priceValue}>${ride.price}</Text>
            </Text>
            <Text style={styles.priceItem}>
              Booked (1 passenger(s)){' '}
              <Text style={styles.priceValue}>${ride.price}</Text>
            </Text>
            <Divider style={styles.divider} />
            <Text style={styles.priceItem}>
              Trip Fare (x1){' '}
              <Text style={styles.priceValue}>
                ${(ride.price * 1).toFixed(2)}
              </Text>
            </Text>
            <Text style={styles.priceItem}>
              Discounts (10%){' '}
              <Text style={styles.priceValue}>
                -${(ride.price * 0.1).toFixed(2)}
              </Text>
            </Text>
            <Text style={styles.priceItem}>
              Tax (5%){' '}
              <Text style={styles.priceValue}>
                ${(ride.price * 0.05).toFixed(2)}
              </Text>
            </Text>
            <Text style={styles.priceItem}>
              Driver Tip <Text style={styles.priceValue}>$2.00</Text>
            </Text>
            <Divider style={styles.divider} />
            <Text style={styles.totalPaid}>
              Total Paid{' '}
              <Text style={styles.totalPaidValue}>
                $
                {(
                  ride.price * 1 -
                  ride.price * 0.1 +
                  ride.price * 0.05 +
                  2
                ).toFixed(2)}
              </Text>
            </Text>
          </Card.Content>
        </Card>

        {/* Status and Payment */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <Chip style={styles.statusChip}>{ride.status}</Chip>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Payment</Text>
              <Text style={styles.infoValue}>JoyRide Wallet</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date</Text>
              <Text style={styles.infoValue}>
                {new Date(ride.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Time</Text>
              <Text style={styles.infoValue}>
                {new Date(ride.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Transaction ID</Text>
              <Text style={styles.infoValue}>TRX1221240956</Text>
              <Icon
                name="content-copy"
                size={16}
                color="#888888"
                style={styles.copyIcon}
              />
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Booking ID</Text>
              <Text style={styles.infoValue}>BKG926084</Text>
              <Icon
                name="content-copy"
                size={16}
                color="#888888"
                style={styles.copyIcon}
              />
            </View>
          </Card.Content>
        </Card>

        <Button
          mode="contained"
          style={styles.shareButton}
          onPress={() => console.log('Share Receipt')}>
          Share Receipt
        </Button>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: Colors.background, // Or your header background color
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  scrollViewContent: {
    paddingBottom: 20,
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    elevation: 2,
    backgroundColor: Colors.lightText,
  },
  locationContainer: {
    paddingVertical: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  locationTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  locationLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  locationAddress: {
    fontSize: 14,
    color: Colors.gray,
  },
  timeText: {
    fontSize: 14,
    color: Colors.gray,
  },
  locationLine: {
    height: 30,
    width: 2,
    backgroundColor: '#ddd',
    marginLeft: 9,
    marginVertical: -5,
  },
  tripDuration: {
    fontSize: 12,
    color: Colors.gray,
    marginTop: 8,
    textAlign: 'right',
  },
  driverInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  driverDetails: {
    flex: 1,
    marginLeft: 15,
  },
  driverNameVerification: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 5,
  },
  driverRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  ratingText: {
    marginLeft: 5,
    fontSize: 14,
    color: Colors.text,
  },
  reviewsText: {
    marginLeft: 5,
    fontSize: 12,
    color: Colors.gray,
  },
  driverActions: {
    flexDirection: 'row',
  },
  actionButton: {
    marginLeft: 10,
    borderColor: '#ccc',
  },
  priceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    fontSize: 16,
    color: Colors.text,
  },
  priceValue: {
    fontWeight: 'bold',
  },
  totalPaid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  totalPaidValue: {
    color: Colors.primary,
  },
  divider: {
    marginVertical: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 15,
    color: Colors.gray,
  },
  infoValue: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  statusChip: {
    backgroundColor: '#e0ffe0', // Light green for completed
    height: 25,
    justifyContent: 'center',
  },
  copyIcon: {
    marginLeft: 5,
  },
  shareButton: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: Colors.primary,
  },
});

export default RideDetails;
