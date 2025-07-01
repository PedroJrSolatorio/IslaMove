import React, {useEffect, useState} from 'react';
import {View, ScrollView, ActivityIndicator} from 'react-native';
import {Card, Title, Text, Avatar, Button, Chip} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import api from '../../utils/api';
import {GlobalStyles} from '../styles/GlobalStyles';
import {TabsStyles} from '../styles/TabsStyles';

const PAGE_SIZE = 10;
const STATUS_OPTIONS = [
  {label: 'All', value: ''},
  {label: 'Completed', value: 'completed'},
  {label: 'Cancelled', value: 'cancelled'},
];

const RideHistory = () => {
  const navigation = useNavigation();
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [status, setStatus] = useState('');
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
      <Card style={{margin: 16}}>
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
            <Card key={ride._id} style={TabsStyles.recentRideItem}>
              <Card.Content
                style={{flexDirection: 'row', alignItems: 'center'}}>
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
                    {new Date(ride.createdAt).toLocaleString()}
                  </Text>
                  <Text style={{color: '#888', fontSize: 12}}>
                    Status: {ride.status}
                  </Text>
                </View>
                <Text style={TabsStyles.recentRidePrice}>₱{ride.price}</Text>
              </Card.Content>
            </Card>
          ))}
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
            Previous
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
      <Button
        style={{margin: 16}}
        mode="outlined"
        onPress={() => navigation.goBack()}>
        Back
      </Button>
    </View>
  );
};

export default RideHistory;
