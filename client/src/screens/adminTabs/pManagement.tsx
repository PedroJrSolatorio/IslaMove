import React, {useState, useEffect} from 'react';
import {
  View,
  ScrollView,
  Image,
  RefreshControl,
  Alert,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  SafeAreaView,
} from 'react-native';
import axios from 'axios';
import {BACKEND_URL} from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {styles} from '../../styles/pManagementStyles';

interface GeoLocation {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
  address?: string;
}

interface Address {
  label: string;
  address: string;
  location: GeoLocation;
}

interface Warning {
  message: string;
  Date: Date;
  readStatus: boolean;
}

interface IdDocument {
  type: 'school_id' | 'senior_id' | 'valid_id' | 'drivers_license';
  imageUrl: string;
  uploadedAt: Date;
  verified: boolean;
  verifiedAt?: Date;
  verifiedBy?: string;
}

interface HomeAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  coordinates?: [number, number];
}

interface AgreementAccepted {
  documentType: 'terms_and_conditions' | 'privacy_policy';
  version: string;
  acceptedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

interface Passenger {
  _id: string;
  lastName: string;
  firstName: string;
  middleInitial: string;
  birthdate: Date;
  age: number;
  username: string;
  email: string;
  phone: string;
  homeAddress: HomeAddress;
  idDocument: IdDocument;
  role: 'passenger';
  profileImage: string;
  isBlocked: boolean;
  blockReason: string;
  warnings: Warning[];
  rating: number;
  totalRides: number;
  totalRatings: number;
  isVerified: boolean;
  verificationStatus: string;
  agreementsAccepted: AgreementAccepted[];
  passengerCategory: 'regular' | 'student' | 'senior';
  savedAddresses: Address[];
  createdAt: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  passengers: Passenger[];
  count: number;
}

const VERIFICATION_STATUS = {
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

const PassengerManagement = () => {
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPassenger, setSelectedPassenger] = useState<Passenger | null>(
    null,
  );
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [isIdVerificationModalVisible, setIsIdVerificationModalVisible] =
    useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [actionType, setActionType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [expandedAddresses, setExpandedAddresses] = useState<{
    [key: string]: boolean;
  }>({});

  useEffect(() => {
    fetchPassengers();
  }, []);

  const fetchPassengers = async () => {
    try {
      setRefreshing(true);
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.get<ApiResponse>(
        `${BACKEND_URL}/api/admin/passengers`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );

      const passengerUsers = response.data.passengers || [];
      setPassengers(passengerUsers);

      // Count pending verification requests
      const pending = passengerUsers.filter(
        passenger =>
          passenger.verificationStatus === VERIFICATION_STATUS.PENDING &&
          !passenger.isBlocked,
      ).length;
      setPendingCount(pending);
      setRefreshing(false);
    } catch (error) {
      console.error('Error fetching passengers:', error);
      setRefreshing(false);
      Alert.alert('Error', 'Failed to load passengers');
    }
  };

  const handleSendWarning = async () => {
    if (!selectedPassenger) return;
    if (!warningMessage.trim()) {
      Alert.alert('Error', 'Please enter a warning message');
      return;
    }
    try {
      const token = await AsyncStorage.getItem('userToken');

      await axios.post(
        `${BACKEND_URL}/api/admin/passengers/${selectedPassenger._id}/warning`,
        {message: warningMessage},
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
      Alert.alert('Success', 'Warning sent to passenger');
      setIsModalVisible(false);
      setWarningMessage('');
      fetchPassengers();
    } catch (error) {
      console.error('Error sending warning:', error);
      Alert.alert('Error', 'Failed to send warning');
    }
  };

  const handleBlockPassenger = async () => {
    if (!selectedPassenger) return;
    if (!blockReason.trim()) {
      Alert.alert('Error', 'Please provide a reason for blocking');
      return;
    }
    try {
      const token = await AsyncStorage.getItem('userToken');

      await axios.put(
        `${BACKEND_URL}/api/admin/passengers/${selectedPassenger._id}/block`,
        {reason: blockReason},
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
      Alert.alert('Success', 'Passenger blocked');
      setIsModalVisible(false);
      setBlockReason('');
      fetchPassengers();
    } catch (error) {
      console.error('Error blocking passenger:', error);
      Alert.alert('Error', 'Failed to block passenger');
    }
  };

  const handleUnblockPassenger = async (passenger: Passenger) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.put(
        `${BACKEND_URL}/api/admin/passengers/${passenger._id}/unblock`,
        {},
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
      Alert.alert('Success', 'Passenger unblocked');
      fetchPassengers();
    } catch (error) {
      console.error('Error unblocking passenger:', error);
      Alert.alert('Error', 'Failed to unblock passenger');
    }
  };

  const handleVerifyId = async (passenger: Passenger, isApproved: boolean) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.put(
        `${BACKEND_URL}/api/admin/passengers/${passenger._id}/verify-id`,
        {verified: isApproved},
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
      Alert.alert('Success', `ID ${isApproved ? 'approved' : 'rejected'}`);
      setIsIdVerificationModalVisible(false);
      fetchPassengers();
    } catch (error) {
      console.error('Error verifying ID:', error);
      Alert.alert('Error', 'Failed to verify ID');
    }
  };

  const toggleAddresses = (passengerId: string) => {
    setExpandedAddresses(prev => ({
      ...prev,
      [passengerId]: !prev[passengerId],
    }));
  };

  const getFullName = (passenger: Passenger) => {
    return `${passenger.firstName} ${passenger.middleInitial}. ${passenger.lastName}`;
  };

  const getVerificationStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return '#2ecc71';
      case 'rejected':
        return '#e74c3c';
      case 'under_review':
        return '#f39c12';
      case 'pending':
        return '#95a5a6';
      default:
        return '#95a5a6';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'student':
        return '#3498db';
      case 'senior':
        return '#9b59b6';
      default:
        return '#34495e';
    }
  };

  const filteredPassengers = () => {
    let filtered = [...passengers];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        passenger =>
          getFullName(passenger)
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          passenger.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          passenger.phone.includes(searchQuery),
      );
    }

    // Apply tab filter
    switch (activeTab) {
      case 'blocked':
        return filtered.filter(passenger => passenger.isBlocked);
      case 'lowRated':
        return filtered.filter(
          passenger => passenger.rating < 3.5 && !passenger.isBlocked,
        );
      case 'pendingVerification':
        return filtered.filter(
          passenger =>
            passenger.verificationStatus === 'pending' ||
            passenger.verificationStatus === 'under_review',
        );
      case 'unverified':
        return filtered.filter(passenger => !passenger.isVerified);
      default:
        return filtered;
    }
  };

  const renderHeader = () => (
    <View>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Passenger Management</Text>
        {pendingCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingCount}</Text>
          </View>
        )}
      </View>

      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          placeholder="Search by name, email or phone"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchInput}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="close" size={20} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'all' ? styles.activeTab : null,
          ]}
          onPress={() => setActiveTab('all')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'all' ? styles.activeTabText : null,
            ]}>
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'pendingVerification' ? styles.activeTab : null,
          ]}
          onPress={() => setActiveTab('pendingVerification')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'pendingVerification' ? styles.activeTabText : null,
            ]}>
            Pending Verification
          </Text>
          {pendingCount > 0 && (
            <View style={styles.smallBadge}>
              <Text style={styles.smallBadgeText}>{pendingCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'lowRated' ? styles.activeTab : null,
          ]}
          onPress={() => setActiveTab('lowRated')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'lowRated' ? styles.activeTabText : null,
            ]}>
            Low Rated
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'blocked' ? styles.activeTab : null,
          ]}
          onPress={() => setActiveTab('blocked')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'blocked' ? styles.activeTabText : null,
            ]}>
            Blocked
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'unverified' ? styles.activeTab : null,
          ]}
          onPress={() => setActiveTab('unverified')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'unverified' ? styles.activeTabText : null,
            ]}>
            Unverified
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderEmptyComponent = () => (
    <View style={styles.noResultsCard}>
      <Text style={styles.noResultsText}>No passengers found</Text>
    </View>
  );

  const renderPassengerItem = ({item: passenger}: {item: Passenger}) => (
    <View style={styles.passengerCard}>
      <View style={styles.passengerHeader}>
        <View style={styles.passengerInfo}>
          {passenger.profileImage ? (
            <Image
              source={{uri: passenger.profileImage}}
              style={styles.passengerAvatar}
            />
          ) : (
            <View
              style={[
                styles.passengerAvatar,
                styles.passengerAvatarPlaceholder,
              ]}>
              <Text style={styles.avatarText}>
                {passenger.firstName?.charAt(0) || '?'}
              </Text>
            </View>
          )}
          <View>
            <Text style={styles.passengerName}>{getFullName(passenger)}</Text>
            <Text style={styles.passengerEmail}>{passenger.email}</Text>
            <View style={styles.categoryContainer}>
              <View
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: getCategoryColor(
                      passenger.passengerCategory,
                    ),
                  },
                ]}>
                <Text style={styles.categoryText}>
                  {passenger.passengerCategory?.toUpperCase() || 'REGULAR'}
                </Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusChip,
              {
                backgroundColor: passenger.isBlocked
                  ? '#e74c3c'
                  : passenger.rating < 3.5
                  ? '#f39c12'
                  : '#2ecc71',
              },
            ]}>
            <Text style={styles.statusText}>
              {passenger.isBlocked
                ? 'Blocked'
                : passenger.rating < 3.5
                ? 'Low Rating'
                : 'Active'}
            </Text>
          </View>
          <View
            style={[
              styles.verificationChip,
              {
                backgroundColor: getVerificationStatusColor(
                  passenger.verificationStatus,
                ),
              },
            ]}>
            <Text style={styles.verificationText}>
              {passenger.verificationStatus.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Phone:</Text>
        <Text>{passenger.phone || 'N/A'}</Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Age:</Text>
        <Text>{passenger.age || 'N/A'} years old</Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Rating:</Text>
        <Text>
          {passenger.rating.toFixed(1) || '0.0'} ({passenger.totalRatings}{' '}
          ratings)
        </Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Total Rides:</Text>
        <Text>{passenger.totalRides || 0}</Text>
      </View>

      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Home Address:</Text>
        <Text>
          {passenger.homeAddress
            ? `${passenger.homeAddress.street}, ${passenger.homeAddress.city}, ${passenger.homeAddress.state} ${passenger.homeAddress.zipCode}`
            : 'N/A'}
        </Text>
      </View>

      {passenger.isBlocked && (
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>Block Reason:</Text>
          <Text>{passenger.blockReason}</Text>
        </View>
      )}

      {passenger.warnings && passenger.warnings.length > 0 && (
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>Latest Warning:</Text>
          <Text>
            {passenger.warnings[passenger.warnings.length - 1].message}
          </Text>
          <Text style={styles.warningDate}>
            {new Date(
              passenger.warnings[passenger.warnings.length - 1].Date,
            ).toLocaleDateString()}
          </Text>
        </View>
      )}

      {passenger.savedAddresses && passenger.savedAddresses.length > 0 && (
        <View>
          <TouchableOpacity
            style={styles.addressAccordion}
            onPress={() => toggleAddresses(passenger._id)}>
            <Icon name="location-on" size={24} color="#333" />
            <Text style={styles.addressTitle}>Saved Addresses</Text>
            <Icon
              name={
                expandedAddresses[passenger._id]
                  ? 'keyboard-arrow-up'
                  : 'keyboard-arrow-down'
              }
              size={24}
              color="#333"
            />
          </TouchableOpacity>

          {expandedAddresses[passenger._id] && (
            <View style={styles.addressList}>
              {passenger.savedAddresses.map((address, index) => (
                <View key={index} style={styles.addressItem}>
                  <Icon name="home" size={20} color="#555" />
                  <View style={styles.addressTextContainer}>
                    <Text style={styles.addressLabel}>{address.label}</Text>
                    <Text style={styles.addressText}>{address.address}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.profileButton]}
          onPress={() => {
            setSelectedPassenger(passenger);
            setIsProfileModalVisible(true);
          }}>
          <Text style={styles.buttonText}>View Profile</Text>
        </TouchableOpacity>

        {(passenger.verificationStatus === 'pending' ||
          passenger.verificationStatus === 'under_review') && (
          <TouchableOpacity
            style={[styles.actionButton, styles.verifyButton]}
            onPress={() => {
              setSelectedPassenger(passenger);
              setIsIdVerificationModalVisible(true);
            }}>
            <Text style={styles.buttonText}>Verify ID</Text>
          </TouchableOpacity>
        )}

        {!passenger.isBlocked && (
          <>
            <TouchableOpacity
              style={[styles.actionButton, styles.warningButton]}
              onPress={() => {
                setSelectedPassenger(passenger);
                setActionType('warning');
                setIsModalVisible(true);
              }}>
              <Text style={styles.buttonText}>Send Warning</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.blockButton]}
              onPress={() => {
                setSelectedPassenger(passenger);
                setActionType('block');
                setIsModalVisible(true);
              }}>
              <Text style={styles.blockButtonText}>Block</Text>
            </TouchableOpacity>
          </>
        )}

        {passenger.isBlocked && (
          <TouchableOpacity
            style={[styles.actionButton, styles.unblockButton]}
            onPress={() => handleUnblockPassenger(passenger)}>
            <Text style={styles.buttonText}>Unblock</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Action Modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setIsModalVisible(false);
          setWarningMessage('');
          setBlockReason('');
        }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              {actionType === 'warning' ? 'Send Warning' : 'Block Passenger'}
            </Text>

            {actionType === 'warning' && (
              <>
                <TextInput
                  placeholder="Warning Message"
                  value={warningMessage}
                  onChangeText={setWarningMessage}
                  multiline
                  style={styles.textInput}
                />
                <TouchableOpacity
                  style={[styles.modalButton, styles.warningButton]}
                  onPress={handleSendWarning}>
                  <Text style={styles.buttonText}>Send Warning</Text>
                </TouchableOpacity>
              </>
            )}

            {actionType === 'block' && (
              <>
                <TextInput
                  placeholder="Reason for Blocking"
                  value={blockReason}
                  onChangeText={setBlockReason}
                  multiline
                  style={styles.textInput}
                />
                <TouchableOpacity
                  style={[styles.modalButton, {backgroundColor: '#e74c3c'}]}
                  onPress={handleBlockPassenger}>
                  <Text style={styles.buttonText}>Block Passenger</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setIsModalVisible(false);
                setWarningMessage('');
                setBlockReason('');
              }}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Profile Detail Modal */}
      <Modal
        visible={isProfileModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsProfileModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.profileModalContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Passenger Profile</Text>

              {selectedPassenger && (
                <>
                  <View style={styles.profileHeader}>
                    {selectedPassenger.profileImage ? (
                      <Image
                        source={{uri: selectedPassenger.profileImage}}
                        style={styles.profileImage}
                      />
                    ) : (
                      <View style={styles.profileImagePlaceholder}>
                        <Text style={styles.profileImageText}>
                          {selectedPassenger.firstName.charAt(0) || '?'}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.profileName}>
                      {getFullName(selectedPassenger)}
                    </Text>
                    <Text style={styles.profileEmail}>
                      {selectedPassenger.email}
                    </Text>
                  </View>

                  <View style={styles.profileSection}>
                    <Text style={styles.sectionTitle}>
                      Personal Information
                    </Text>
                    <View style={styles.profileRow}>
                      <Text style={styles.profileLabel}>Username:</Text>
                      <Text style={styles.profileValue}>
                        {selectedPassenger.username || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.profileRow}>
                      <Text style={styles.profileLabel}>Phone:</Text>
                      <Text style={styles.profileValue}>
                        {selectedPassenger.phone || 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.profileRow}>
                      <Text style={styles.profileLabel}>Age:</Text>
                      <Text style={styles.profileValue}>
                        {selectedPassenger.age || 'N/A'} years old
                      </Text>
                    </View>
                    <View style={styles.profileRow}>
                      <Text style={styles.profileLabel}>Category:</Text>
                      <Text style={styles.profileValue}>
                        {selectedPassenger.passengerCategory}
                      </Text>
                    </View>
                    <View style={styles.profileRow}>
                      <Text style={styles.profileLabel}>Birthdate:</Text>
                      <Text style={styles.profileValue}>
                        {selectedPassenger.birthdate
                          ? new Date(
                              selectedPassenger.birthdate,
                            ).toLocaleDateString()
                          : 'N/A'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.profileSection}>
                    <Text style={styles.sectionTitle}>Verification Status</Text>
                    <View style={styles.profileRow}>
                      <Text style={styles.profileLabel}>Status:</Text>
                      <Text
                        style={[
                          styles.profileValue,
                          {
                            color: getVerificationStatusColor(
                              selectedPassenger.verificationStatus,
                            ),
                          },
                        ]}>
                        {selectedPassenger.verificationStatus
                          .replace('_', ' ')
                          .toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.profileRow}>
                      <Text style={styles.profileLabel}>ID Type:</Text>
                      <Text style={styles.profileValue}>
                        {selectedPassenger.idDocument?.type
                          ? selectedPassenger.idDocument.type.replace('_', ' ')
                          : 'N/A'}
                      </Text>
                    </View>
                    <View style={styles.profileRow}>
                      <Text style={styles.profileLabel}>ID Verified:</Text>
                      <Text style={styles.profileValue}>
                        {selectedPassenger.idDocument.verified ? 'Yes' : 'No'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.profileSection}>
                    <Text style={styles.sectionTitle}>Ride Statistics</Text>
                    <View style={styles.profileRow}>
                      <Text style={styles.profileLabel}>Rating:</Text>
                      <Text style={styles.profileValue}>
                        {selectedPassenger.rating?.toFixed(1) || '0.0'} (
                        {selectedPassenger.totalRatings || 0} ratings)
                      </Text>
                    </View>
                    <View style={styles.profileRow}>
                      <Text style={styles.profileLabel}>Total Rides:</Text>
                      <Text style={styles.profileValue}>
                        {selectedPassenger.totalRides || 0}
                      </Text>
                    </View>
                  </View>

                  {selectedPassenger.warnings &&
                    selectedPassenger.warnings.length > 0 && (
                      <View style={styles.profileSection}>
                        <Text style={styles.sectionTitle}>Warning History</Text>
                        {selectedPassenger.warnings.map((warning, index) => (
                          <View key={index} style={styles.warningItem}>
                            <Text style={styles.warningMessage}>
                              {warning.message}
                            </Text>
                            <Text style={styles.warningDate}>
                              {new Date(warning.Date).toLocaleDateString()}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                </>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsProfileModalVisible(false)}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ID Verification Modal */}
      <Modal
        visible={isIdVerificationModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsIdVerificationModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.verificationModalContainer}>
            <Text style={styles.modalTitle}>ID Verification</Text>

            {selectedPassenger && (
              <>
                <Text style={styles.passengerNameInModal}>
                  {getFullName(selectedPassenger)}
                </Text>
                <Text style={styles.idTypeText}>
                  ID Type:{' '}
                  {selectedPassenger.idDocument?.type
                    ? selectedPassenger.idDocument.type
                        .replace('_', ' ')
                        .toUpperCase()
                    : 'N/A'}
                </Text>

                <Image
                  source={{uri: selectedPassenger.idDocument.imageUrl}}
                  style={styles.idImage}
                  resizeMode="contain"
                />

                <View style={styles.verificationActions}>
                  <TouchableOpacity
                    style={[styles.verificationButton, styles.approveButton]}
                    onPress={() => handleVerifyId(selectedPassenger, true)}>
                    <Text style={styles.buttonText}>Approve</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.verificationButton, styles.rejectButton]}
                    onPress={() => handleVerifyId(selectedPassenger, false)}>
                    <Text style={styles.buttonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setIsIdVerificationModalVisible(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Main content with FlatList */}
      <FlatList
        data={filteredPassengers()}
        renderItem={renderPassengerItem}
        keyExtractor={item => item._id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyComponent}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchPassengers} />
        }
      />
    </SafeAreaView>
  );
};

export default PassengerManagement;
