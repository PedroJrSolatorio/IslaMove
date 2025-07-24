import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  ScrollView,
  StatusBar,
  RefreshControl,
  Alert,
  ActivityIndicator,
  ToastAndroid,
  Platform,
} from 'react-native';
import {
  Card,
  Title,
  Text,
  Button,
  Chip,
  IconButton,
  Snackbar,
  Menu,
} from 'react-native-paper';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {GlobalStyles} from '../styles/GlobalStyles';
import {Colors} from '../styles/Colors';
import {Spacing} from '../styles/Spacing';
import {styles} from '../styles/NotificationsStyles';
import NotificationApiService from '../services/api/notificationApi';
import {RootStackNavigationProp} from '../navigation/types'; // Adjust path as needed

interface Notification {
  _id: string;
  type:
    | 'profile_image_status'
    | 'warning'
    | 'senior_id_validation'
    | 'category_change_request'
    | 'category_change_auto'
    | 'admin_news'
    | 'school_id_reminder'
    | 'senior_eligibility'
    | 'account_security'
    | 'promo'
    | 'system_update';
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  readAt?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  data?: {
    actionRequired?: boolean;
    [key: string]: any;
  };
}

interface NotificationStats {
  total: number;
  unread: number;
  high_priority: number;
  urgent: number;
}

const NotificationScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<RootStackNavigationProp>();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats>({
    total: 0,
    unread: 0,
    high_priority: 0,
    urgent: 0,
  });
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [menuVisible, setMenuVisible] = useState<string | null>(null);

  // Show message to user
  const showMessage = (message: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      setSnackbarMessage(message);
      setSnackbarVisible(true);
    }
  };

  // Helper to format timestamp
  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-PH', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } else if (diffDays === 1) {
      return (
        'Yesterday, ' +
        date.toLocaleTimeString('en-PH', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      );
    } else if (diffDays < 7) {
      return (
        date.toLocaleDateString('en-PH', {weekday: 'short'}) +
        ', ' +
        date.toLocaleTimeString('en-PH', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      );
    } else {
      return date.toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
  };

  // Fetch notifications from API
  const fetchNotifications = useCallback(
    async (reset = false) => {
      try {
        if (reset) {
          setRefreshing(true);
          setPagination(prev => ({...prev, page: 1}));
        } else {
          setLoadingMore(true);
        }

        const currentPage = reset ? 1 : pagination.page;
        const filterOptions = {
          page: currentPage,
          limit: pagination.limit,
          read: filter === 'unread' ? false : null,
        };

        const response = await NotificationApiService.getNotifications(
          filterOptions,
        );

        if (response.success) {
          const newNotifications = response.data;
          setNotifications(prev =>
            reset ? newNotifications : [...prev, ...newNotifications],
          );
          setPagination(response.pagination);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
        showMessage('Failed to load notifications');
      } finally {
        setRefreshing(false);
        setLoadingMore(false);
        setLoading(false);
      }
    },
    [filter, pagination.page, pagination.limit],
  );

  // Fetch notification statistics
  const fetchStats = useCallback(async () => {
    try {
      const response = await NotificationApiService.getNotificationStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching notification stats:', error);
    }
  }, []);

  // Load initial data
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchNotifications(true);
      fetchStats();
    }, [filter]),
  );

  // Filter change handler
  const handleFilterChange = (newFilter: 'all' | 'unread') => {
    if (newFilter !== filter) {
      setFilter(newFilter);
      setNotifications([]);
      setPagination(prev => ({...prev, page: 1}));
    }
  };

  // Load more notifications
  const loadMoreNotifications = () => {
    if (!loadingMore && pagination.page < pagination.pages) {
      setPagination(prev => ({...prev, page: prev.page + 1}));
      fetchNotifications(false);
    }
  };

  // Handle notification press
  const handleNotificationPress = async (notification: Notification) => {
    try {
      if (!notification.read) {
        // Optimistically update UI
        setNotifications(prev =>
          prev.map(notif =>
            notif._id === notification._id
              ? {...notif, read: true, readAt: new Date().toISOString()}
              : notif,
          ),
        );
        setStats(prev => ({...prev, unread: Math.max(0, prev.unread - 1)}));

        // Update on server
        await NotificationApiService.markNotificationAsRead(notification._id);
      }

      // Handle navigation based on notification type
      handleNotificationNavigation(notification);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      // Revert optimistic update
      setNotifications(prev =>
        prev.map(notif =>
          notif._id === notification._id
            ? {...notif, read: false, readAt: undefined}
            : notif,
        ),
      );
      setStats(prev => ({...prev, unread: prev.unread + 1}));
      showMessage('Failed to mark notification as read');
    }
  };

  // Handle navigation based on notification type
  const handleNotificationNavigation = (notification: Notification) => {
    switch (notification.type) {
      case 'profile_image_status':
        // Navigate to Profile tab in PassengerTabs
        navigation.navigate('PassengerTabs', {screen: 'Account'});
        break;
      case 'category_change_request':
      case 'category_change_auto':
        // Navigate to ProfileInfo screen for category related notifications
        navigation.navigate('ProfileInfo');
        break;
      case 'senior_id_validation':
      case 'school_id_reminder':
      case 'senior_eligibility':
        // Navigate to IDDocuments screen for ID related notifications
        navigation.navigate('IDDocuments');
        break;
      case 'account_security':
        // Navigate to AccountSecurity screen
        navigation.navigate('AccountSecurity');
        break;
      case 'warning':
        // For warnings, navigate to Account tab as there's no specific warnings screen
        navigation.navigate('PassengerTabs', {screen: 'Account'});
        break;
      case 'promo':
        // For promotions, navigate to Home tab or stay in current screen
        navigation.navigate('PassengerTabs', {screen: 'Home'});
        break;
      default:
        // For admin_news and system_update, just mark as read
        break;
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = () => {
    Alert.alert(
      'Mark All as Read',
      'Are you sure you want to mark all notifications as read?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Mark All',
          onPress: async () => {
            try {
              // Optimistically update UI
              const unreadCount = notifications.filter(n => !n.read).length;
              setNotifications(prev =>
                prev.map(notif => ({
                  ...notif,
                  read: true,
                  readAt: new Date().toISOString(),
                })),
              );
              setStats(prev => ({...prev, unread: 0}));

              // Update on server
              await NotificationApiService.markAllNotificationsAsRead();
              showMessage('All notifications marked as read');
            } catch (error) {
              console.error('Error marking all notifications as read:', error);
              // Revert optimistic update
              fetchNotifications(true);
              fetchStats();
              showMessage('Failed to mark all notifications as read');
            }
          },
        },
      ],
    );
  };

  // Delete notification
  const handleDeleteNotification = async (notificationId: string) => {
    try {
      // Optimistically update UI
      const deletedNotification = notifications.find(
        n => n._id === notificationId,
      );
      setNotifications(prev =>
        prev.filter(notif => notif._id !== notificationId),
      );

      if (deletedNotification && !deletedNotification.read) {
        setStats(prev => ({
          ...prev,
          unread: Math.max(0, prev.unread - 1),
          total: Math.max(0, prev.total - 1),
        }));
      } else {
        setStats(prev => ({...prev, total: Math.max(0, prev.total - 1)}));
      }

      // Delete on server
      await NotificationApiService.deleteNotification(notificationId);
      showMessage('Notification deleted');
    } catch (error) {
      console.error('Error deleting notification:', error);
      // Revert optimistic update
      fetchNotifications(true);
      fetchStats();
      showMessage('Failed to delete notification');
    }
  };

  const getFilteredNotifications = () => {
    return notifications;
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'promo':
        return {name: 'tag-multiple', color: Colors.accent};
      case 'warning':
      case 'account_security':
        return {name: 'alert-circle', color: Colors.danger};
      case 'system_update':
        return {name: 'cached', color: Colors.info};
      case 'profile_image_status':
        return {name: 'account-circle', color: Colors.primary};
      case 'category_change_request':
      case 'category_change_auto':
        return {name: 'account-switch', color: Colors.info};
      case 'senior_id_validation':
      case 'school_id_reminder':
        return {name: 'card-account-details', color: Colors.danger};
      case 'senior_eligibility':
        return {name: 'account-heart', color: Colors.success};
      case 'admin_news':
        return {name: 'bullhorn', color: Colors.primary};
      default:
        return {name: 'bell', color: Colors.gray};
    }
  };

  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'urgent':
        return Colors.danger;
      case 'high':
        return Colors.danger;
      case 'medium':
        return Colors.info;
      case 'low':
      default:
        return Colors.gray;
    }
  };

  // //testing notification
  // const handleSendTestNotification = async () => {
  //   try {
  //     const testData = {
  //       title: 'Test Notification',
  //       message: 'This is a test notification from the mobile app.',
  //       type: 'system_update', // match your schema's enum
  //       priority: 'medium',
  //     };

  //     const response = await NotificationApiService.createTestNotification(
  //       testData,
  //     );
  //     Alert.alert('Success', 'Test notification created!');
  //     console.log('✅ Test notification response:', response);
  //   } catch (error: any) {
  //     Alert.alert(
  //       'Error',
  //       error.message || 'Failed to send test notification.',
  //     );
  //   }
  // };

  const renderNotificationCard = (notification: Notification) => {
    const {name: iconName, color: iconColor} = getNotificationIcon(
      notification.type,
    );
    const priorityColor = getPriorityColor(notification.priority);

    return (
      <Card
        key={notification._id}
        style={[
          styles.notificationCard,
          !notification.read && styles.unreadCard,
          notification.priority === 'urgent' && styles.urgentCard,
        ]}
        elevation={2}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.iconContainer}>
            <Icon name={iconName} size={28} color={iconColor} />
          </View>
          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.notificationTitle} numberOfLines={2}>
                {notification.title}
              </Text>
              {(notification.priority === 'high' ||
                notification.priority === 'urgent') && (
                <View
                  style={[
                    styles.priorityBadge,
                    {backgroundColor: priorityColor},
                  ]}>
                  <Text style={styles.priorityText}>
                    {notification.priority.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.notificationMessage} numberOfLines={3}>
              {notification.message}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.notificationTimestamp}>
                {formatTimestamp(notification.createdAt)}
              </Text>
              {notification.data?.actionRequired && (
                <Text style={styles.actionRequiredText}>Action Required</Text>
              )}
            </View>
          </View>
          <View style={styles.actionsContainer}>
            {!notification.read && <View style={styles.unreadDot} />}
            <Menu
              visible={menuVisible === notification._id}
              onDismiss={() => setMenuVisible(null)}
              anchor={
                <IconButton
                  icon="dots-vertical"
                  size={20}
                  onPress={() => setMenuVisible(notification._id)}
                  iconColor={Colors.gray}
                />
              }>
              <Menu.Item
                onPress={() => {
                  setMenuVisible(null);
                  handleNotificationPress(notification);
                }}
                title={notification.read ? 'View' : 'Mark as Read'}
                leadingIcon={notification.read ? 'eye' : 'check'}
              />
              <Menu.Item
                onPress={() => {
                  setMenuVisible(null);
                  Alert.alert(
                    'Delete Notification',
                    'Are you sure you want to delete this notification?',
                    [
                      {text: 'Cancel', style: 'cancel'},
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () =>
                          handleDeleteNotification(notification._id),
                      },
                    ],
                  );
                }}
                title="Delete"
                leadingIcon="delete"
                titleStyle={{color: Colors.danger}}
              />
            </Menu>
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return (
      <View
        style={[
          GlobalStyles.container,
          styles.loadingContainer,
          {paddingTop: insets.top},
        ]}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="transparent"
          translucent
        />
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            size={24}
            onPress={() => navigation.goBack()}
            iconColor={Colors.text}
            style={styles.backButton}
          />
          <Title style={styles.headerTitle}>Notifications</Title>
          <View style={styles.headerActions} />
        </View>
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading notifications...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[GlobalStyles.container, {paddingTop: insets.top}]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Header */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          onPress={() => navigation.goBack()}
          iconColor={Colors.text}
          style={styles.backButton}
        />
        <Title style={styles.headerTitle}>Notifications</Title>
        <Button
          mode="text"
          onPress={handleMarkAllAsRead}
          disabled={stats.unread === 0}
          labelStyle={[
            styles.markAllReadButtonLabel,
            stats.unread === 0 && styles.disabledButtonLabel,
          ]}
          contentStyle={styles.markAllReadButtonContent}>
          Mark All Read
        </Button>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterContainer}>
        <Chip
          selected={filter === 'all'}
          onPress={() => handleFilterChange('all')}
          style={[
            styles.filterChip,
            filter === 'all' && styles.filterChipSelected,
          ]}
          textStyle={[
            styles.filterChipText,
            filter === 'all' && styles.filterChipTextSelected,
          ]}>
          All ({stats.total})
        </Chip>
        <Chip
          selected={filter === 'unread'}
          onPress={() => handleFilterChange('unread')}
          style={[
            styles.filterChip,
            filter === 'unread' && styles.filterChipSelected,
          ]}
          textStyle={[
            styles.filterChipText,
            filter === 'unread' && styles.filterChipTextSelected,
          ]}>
          Unread ({stats.unread})
        </Chip>
        {stats.urgent > 0 && (
          <Chip
            style={[styles.filterChip, styles.urgentChip]}
            textStyle={styles.urgentChipText}>
            Urgent ({stats.urgent})
          </Chip>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchNotifications(true)}
            tintColor={Colors.primary}
          />
        }
        onScroll={({nativeEvent}) => {
          const {layoutMeasurement, contentOffset, contentSize} = nativeEvent;
          const paddingToBottom = 20;
          if (
            layoutMeasurement.height + contentOffset.y >=
            contentSize.height - paddingToBottom
          ) {
            loadMoreNotifications();
          }
        }}
        scrollEventThrottle={400}>
        {getFilteredNotifications().length === 0 ? (
          <View style={styles.emptyContainer}>
            <Icon name="bell-off-outline" size={80} color={Colors.lightGray} />
            <Text style={styles.emptyText}>
              {filter === 'unread'
                ? 'No unread notifications!'
                : 'No notifications here!'}
            </Text>
            <Text style={styles.emptySubText}>
              {filter === 'unread'
                ? "You've read all your notifications."
                : "You're all caught up and ready to go."}
            </Text>
            <Button
              mode="contained"
              onPress={() =>
                navigation.navigate('PassengerTabs', {screen: 'Home'})
              }
              style={styles.emptyStateButton}
              labelStyle={styles.emptyStateButtonLabel}>
              Go to Home
            </Button>
            {/* for testing */}
            {/* <View style={{padding: 16}}>
              <Button
                mode="contained"
                onPress={handleSendTestNotification}
                style={styles.emptyStateButton}
                labelStyle={styles.emptyStateButtonLabel}>
                Test
              </Button>
            </View> */}
          </View>
        ) : (
          <>
            {getFilteredNotifications().map(renderNotificationCard)}

            {/* Load More Button */}
            {pagination.page < pagination.pages && (
              <View style={styles.loadMoreContainer}>
                {loadingMore ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Button
                    mode="outlined"
                    onPress={loadMoreNotifications}
                    style={styles.loadMoreButton}
                    labelStyle={styles.loadMoreButtonLabel}>
                    Load More Notifications
                  </Button>
                )}
              </View>
            )}
          </>
        )}

        <View style={{height: insets.bottom + Spacing.medium}} />
      </ScrollView>

      {/* Snackbar for iOS */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={styles.snackbar}>
        {snackbarMessage}
      </Snackbar>
    </View>
  );
};

export default NotificationScreen;
