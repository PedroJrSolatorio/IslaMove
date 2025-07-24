import React, {useEffect, useState} from 'react';
import {
  View,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import {Card, Title, Text, Button, Chip} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import api from '../../utils/api';
import {GlobalStyles} from '../styles/GlobalStyles';
import {TabsStyles} from '../styles/TabsStyles';
import {Colors} from '../styles/Colors';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const PAGE_SIZE = 10;
const STATUS_OPTIONS = [
  {label: 'All', value: ''},
  {label: 'Completed', value: 'completed'},
  {label: 'Cancelled', value: 'cancelled'},
];

const RideHistory = () => {
  const navigation = useNavigation<NavigationProp>();
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [status, setStatus] = useState('');
  const insets = useSafeAreaInsets();
  const [showingAll, setShowingAll] = useState<
    'none' | 'completed' | 'cancelled'
  >('none');

  const fetchRideHistory = async (
    pageNum = 1,
    statusFilter = status,
    fetchAll: 'none' | 'completed' | 'cancelled' = 'none',
  ) => {
    setLoading(true);
    try {
      let params: any;
      if (fetchAll === 'completed') {
        params = {status: 'completed', limit: 'all'};
      } else if (fetchAll === 'cancelled') {
        params = {status: 'cancelled', limit: 'all'};
      } else {
        params = {page: pageNum, limit: PAGE_SIZE};
        if (statusFilter) params.status = statusFilter;
      }
      const res = await api.get('/api/rides/history', {params});
      if (res.data.success) {
        setRides(res.data.rides);
        setPage(res.data.page);
        setPages(res.data.pages);
      }
    } catch (err) {
      console.error('Failed to fetch ride history:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (showingAll === 'completed') {
      fetchRideHistory(1, 'completed', 'completed');
    } else if (showingAll === 'cancelled') {
      fetchRideHistory(1, 'cancelled', 'cancelled');
    } else {
      fetchRideHistory(1, status, 'none');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, showingAll]);

  const handlePageChange = (newPage: number) => {
    fetchRideHistory(newPage, status, 'none');
  };

  const handleShowAllCompleted = () => setShowingAll('completed');
  const handleShowAllCancelled = () => setShowingAll('cancelled');
  const handleBackToPaginated = () => setShowingAll('none');

  return (
    <View style={GlobalStyles.container}>
      <StatusBar
        barStyle="dark-content" // Or "light-content" if your background is dark
        backgroundColor="transparent" // Make status bar transparent
        translucent={true} // Allow content to draw under status bar on Android
      />
      <Card style={[{margin: 16}, {paddingTop: insets.top + 20}]}>
        <Card.Content>
          <Title>Ride History</Title>
          <View style={{flexDirection: 'row', flexWrap: 'wrap', marginTop: 8}}>
            {STATUS_OPTIONS.map(opt => (
              <Chip
                key={opt.value}
                selected={status === opt.value}
                onPress={() => {
                  setStatus(opt.value);
                  setShowingAll('none');
                }}
                style={{marginRight: 8, marginBottom: 8}}>
                {opt.label}
              </Chip>
            ))}
          </View>
        </Card.Content>
      </Card>
      {/* Show All Buttons */}
      {status === 'completed' && showingAll !== 'completed' && (
        <Button
          mode="contained"
          style={{marginHorizontal: 16, marginBottom: 8}}
          onPress={handleShowAllCompleted}>
          Show All Completed
        </Button>
      )}
      {status === 'cancelled' && showingAll !== 'cancelled' && (
        <Button
          mode="contained"
          style={{marginHorizontal: 16, marginBottom: 8}}
          onPress={handleShowAllCancelled}>
          Show All Cancelled
        </Button>
      )}
      {showingAll !== 'none' && (
        <Button
          mode="outlined"
          style={{marginHorizontal: 16, marginBottom: 8}}
          onPress={handleBackToPaginated}>
          Back to Paginated
        </Button>
      )}
      {loading ? (
        <ActivityIndicator
          size="large"
          color="#6200ee"
          style={{marginTop: 32}}
        />
      ) : rides.length === 0 ? (
        <Text style={{textAlign: 'center', marginTop: 32}}>
          No rides found.
        </Text>
      ) : (
        <ScrollView>
          {rides.map(ride => (
            <TouchableOpacity
              key={ride._id}
              onPress={() =>
                (navigation as any).navigate('RideDetails', {ride})
              }>
              <Card key={ride._id} style={TabsStyles.recentRideItem}>
                <Card.Content style={TabsStyles.recentRideContent}>
                  <View style={TabsStyles.recentRideDetails}>
                    <View style={TabsStyles.locationRow}>
                      <Icon
                        name="map-marker-outline"
                        size={20}
                        color={Colors.success}
                      />
                      <Text style={TabsStyles.locationTextCustom}>
                        {ride.fromZone?.name ||
                          ride.pickupLocation?.address ||
                          'Pickup Location'}
                      </Text>
                    </View>
                    <View style={TabsStyles.locationRow}>
                      <Icon
                        name="flag-checkered"
                        size={20}
                        color={Colors.danger}
                      />
                      <Text style={TabsStyles.locationTextCustom}>
                        {ride.toZone?.name ||
                          ride.destinationLocation?.address ||
                          'Destination'}
                      </Text>
                    </View>
                    <Text style={TabsStyles.recentRideDate}>
                      {new Date(ride.createdAt).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={TabsStyles.recentRidePrice}>₱{ride.price}</Text>
                </Card.Content>
              </Card>
            </TouchableOpacity>
          ))}
          <View style={{height: insets.bottom}} />
        </ScrollView>
      )}
      {/* Pagination Controls */}
      {showingAll === 'none' && (
        <View
          style={{flexDirection: 'row', justifyContent: 'center', margin: 16}}>
          <Button
            mode="outlined"
            disabled={page <= 1}
            onPress={() => handlePageChange(page - 1)}
            style={{marginRight: 8}}>
            Prev
          </Button>
          <Text style={{alignSelf: 'center', marginHorizontal: 8}}>
            Page {page} of {pages}
          </Text>
          <Button
            mode="outlined"
            disabled={page >= pages}
            onPress={() => handlePageChange(page + 1)}>
            Next
          </Button>
        </View>
      )}
    </View>
  );
};

export default RideHistory;
