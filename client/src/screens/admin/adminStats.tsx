import React, {useState, useEffect} from 'react';
import {View, ScrollView, RefreshControl, Alert} from 'react-native';
import {
  Card,
  Title,
  Text,
  Button,
  Divider,
  ActivityIndicator,
  Badge,
  ProgressBar,
} from 'react-native-paper';
import axios from 'axios';
import {BACKEND_URL} from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {styles} from '../../styles/adminStatsStyles';

const AdminStats = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalDrivers: 0,
    totalPassengers: 0,
    activeDrivers: 0,
    pendingDriverVerifications: 0,
    ridesCompleted: 0,
    ridesInProgress: 0,
    averageRating: 0,
    averagePassengerRating: 0,
    lowRatedDrivers: 0,
    lowRatedPassengers: 0,
    supportTickets: 0,
    averageWaitTime: 0,
    cancellationStats: {
      total: 0,
      byPassenger: 0,
      byDriver: 0,
      rate: 0,
    },
  });
  const [timeFrame, setTimeFrame] = useState('day');

  useEffect(() => {
    fetchStats();
  }, [timeFrame]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setRefreshing(true);
      const token = await AsyncStorage.getItem('userToken');

      const statsResponse = await axios.get(
        `${BACKEND_URL}/api/admin/stats?timeFrame=${timeFrame}`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );

      setStats(statsResponse.data);
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      Alert.alert('Error', 'Failed to load dashboard statistics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getTimeFrameLabel = () => {
    switch (timeFrame) {
      case 'day':
        return 'Last 24 hours';
      case 'week':
        return 'Last 7 days';
      case 'month':
        return 'Last 30 days';
      default:
        return 'Last 24 hours';
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={{marginTop: 16}}>Loading dashboard statistics...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={fetchStats} />
      }>
      {/* Time Frame Selector */}
      <View style={styles.timeFrameContainer}>
        {['day', 'week', 'month'].map(tf => (
          <Button
            key={tf}
            mode={timeFrame === tf ? 'contained' : 'outlined'}
            onPress={() => setTimeFrame(tf)}
            style={styles.timeFrameButton}>
            {tf.charAt(0).toUpperCase() + tf.slice(1)}
          </Button>
        ))}
      </View>

      <Text style={styles.timeFrameLabel}>
        Statistics for: {getTimeFrameLabel()}
      </Text>

      {/* Summary Stats */}
      <View style={styles.statCardsContainer}>
        <Card style={styles.statCard}>
          <Card.Content>
            <Text style={styles.statLabel}>Drivers</Text>
            <Title style={styles.statValue}>{stats.totalDrivers}</Title>
            <Text style={styles.statSubtext}>{stats.activeDrivers} active</Text>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content>
            <Text style={styles.statLabel}>Passengers</Text>
            <Title style={styles.statValue}>{stats.totalPassengers}</Title>
            <Text style={styles.statSubtext}>Total registered</Text>
          </Card.Content>
        </Card>
      </View>

      {/* Rides Stats */}
      <View style={styles.statCardsContainer}>
        <Card style={styles.statCard}>
          <Card.Content>
            <Text style={styles.statLabel}>Completed Rides</Text>
            <Title style={styles.statValue}>{stats.ridesCompleted}</Title>
            <Text style={styles.statSubtext}>In selected period</Text>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content>
            <Text style={styles.statLabel}>Active Rides</Text>
            <Title style={styles.statValue}>{stats.ridesInProgress}</Title>
            <Text style={styles.statSubtext}>Currently in progress</Text>
          </Card.Content>
        </Card>
      </View>

      {/* Performance Metrics */}
      <Card style={styles.metricsCard}>
        <Card.Title title="Performance Metrics" />
        <Card.Content>
          {[
            {
              label: 'Average Driver Rating',
              value: stats.averageRating,
              progress: stats.averageRating / 5,
            },
            {
              label: 'Average Passenger Rating',
              value: stats.averagePassengerRating,
              progress: stats.averagePassengerRating / 5,
            },
            {
              label: 'Average Wait Time',
              value: `${stats.averageWaitTime} min`,
              progress: Math.min(stats.averageWaitTime / 15, 1),
              color: stats.averageWaitTime > 10 ? '#FF9800' : '#4CAF50',
            },
            {
              label: 'Cancellation Rate',
              value: `${stats.cancellationStats.rate}%`,
              progress: stats.cancellationStats.rate / 100,
              color: stats.cancellationStats.rate > 15 ? '#F44336' : '#FF9800',
            },
          ].map((metric, idx) => (
            <View style={styles.metricItem} key={idx}>
              <View style={styles.metricHeader}>
                <Text style={styles.metricLabel}>{metric.label}</Text>
                <Text style={styles.metricValue}>{metric.value}</Text>
              </View>
              <ProgressBar
                progress={metric.progress}
                color={metric.color || '#4CAF50'}
                style={styles.progressBar}
              />
            </View>
          ))}
        </Card.Content>
      </Card>

      {/* Cancellation Breakdown */}
      <Card style={styles.fullWidthCard}>
        <Card.Title title="Cancellations Breakdown" />
        <Card.Content>
          <View style={styles.cancellationContainer}>
            <View style={styles.cancellationItem}>
              <Text style={styles.cancellationLabel}>Total</Text>
              <Text style={styles.cancellationValue}>
                {stats.cancellationStats.total}
              </Text>
            </View>
            <View style={styles.cancellationItem}>
              <Text style={styles.cancellationLabel}>By Passengers</Text>
              <Text style={styles.cancellationValue}>
                {stats.cancellationStats.byPassenger}
              </Text>
            </View>
            <View style={styles.cancellationItem}>
              <Text style={styles.cancellationLabel}>By Drivers</Text>
              <Text style={styles.cancellationValue}>
                {stats.cancellationStats.byDriver}
              </Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Attention Section */}
      <Card style={styles.sectionCard}>
        <Card.Title title="Attention Required" />
        <Card.Content>
          {[
            {
              label: 'Driver verifications pending',
              value: stats.pendingDriverVerifications,
            },
            {
              label: 'Low-rated drivers (below 3.0)',
              value: stats.lowRatedDrivers,
            },
            {
              label: 'Low-rated passengers (below 3.0)',
              value: stats.lowRatedPassengers,
            },
            {
              label: 'Customer support tickets',
              value: stats.supportTickets,
            },
          ].map((item, idx) => (
            <View key={idx}>
              <View style={styles.attentionItem}>
                <Badge size={28} style={styles.badge}>
                  {item.value}
                </Badge>
                <Text>{item.label}</Text>
              </View>
              {idx < 3 && <Divider style={styles.attentionDivider} />}
            </View>
          ))}
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

export default AdminStats;
