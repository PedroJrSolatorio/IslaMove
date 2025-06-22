import React, {useState, useEffect} from 'react';
import {
  View,
  Image,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Text,
  TextInput,
  Modal,
  FlatList,
  ScrollView,
  ListRenderItem,
  SafeAreaView,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {BACKEND_URL} from '@env';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {styles} from '../../styles/dManagementStyles';

// Type definitions
interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

interface Vehicle {
  make: string;
  series: string;
  yearModel: string;
  color: string;
  type: string;
  plateNumber: string;
  bodyNumber: string;
}

interface IdDocument {
  type: 'school_id' | 'senior_id' | 'valid_id' | 'drivers_license';
  imageUrl: string;
  uploadedAt: Date;
  verified: boolean;
  verifiedAt?: Date;
  verifiedBy?: string;
}

interface Document {
  documentType: string;
  fileURL: string;
  uploadDate: string;
  verified: boolean;
}

interface Warning {
  message: string;
  Date: string;
}

interface AgreementAccepted {
  documentType: 'terms_and_conditions' | 'privacy_policy';
  version: string;
  acceptedAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

interface Driver {
  _id: string;
  firstName: string;
  lastName: string;
  middleInitial: string;
  birthdate: Date;
  age: number;
  username: string;
  email: string;
  phone: string;
  homeAddress: Address;
  idDocument: IdDocument;
  role: 'driver';
  profileImage?: string;
  isBlocked: boolean;
  blockReason?: string;
  warnings: Warning[];
  rating: number;
  totalRides: number;
  totalRatings: number;
  isVerified: boolean;
  verificationStatus: string;
  agreementsAccepted: AgreementAccepted[];
  licenseNumber: string;
  driverStatus: 'available' | 'busy' | 'offline';
  vehicle: Vehicle;
  documents: Document[];
  createdAt: string;
}

interface ApiResponse {
  success: boolean;
  message: string;
  drivers: Driver[];
  count: number;
}

interface SelectedDocument extends Document {
  driverId: string;
  documentIndex: number;
}

type ModalType = 'warning' | 'block' | 'profile' | 'documents' | '';
type TabType =
  | 'all'
  | 'pending'
  | 'verified'
  | 'blocked'
  | 'low-rated'
  | 'documents';

const VERIFICATION_STATUS = {
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending Verification',
  under_review: 'Under Review',
  approved: 'Verified',
  rejected: 'Rejected',
};

const DriverManagement: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);
  const [modalType, setModalType] = useState<ModalType>('');
  const [warningMessage, setWarningMessage] = useState<string>('');
  const [blockReason, setBlockReason] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [snackbarVisible, setSnackbarVisible] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [documentViewerVisible, setDocumentViewerVisible] =
    useState<boolean>(false);
  const [selectedDocument, setSelectedDocument] =
    useState<SelectedDocument | null>(null);

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async (): Promise<void> => {
    try {
      setRefreshing(true);
      const token = await AsyncStorage.getItem('userToken');
      const response = await axios.get<ApiResponse>(
        `${BACKEND_URL}/api/admin/drivers`,
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );

      const driverUsers = response.data.drivers || [];
      console.log('Drivers fetched:', driverUsers.length);
      setDrivers(driverUsers);

      // Count pending verification requests
      const pending = driverUsers.filter(
        driver =>
          driver.verificationStatus === VERIFICATION_STATUS.PENDING &&
          !driver.isBlocked,
      ).length;
      setPendingCount(pending);
      setRefreshing(false);
    } catch (error) {
      console.error('Error fetching drivers:', error);
      setRefreshing(false);
      showSnackbar('Failed to load drivers');
    }
  };

  const handleVerifyDriver = async (driver: Driver): Promise<void> => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.put(
        `${BACKEND_URL}/api/admin/drivers/${driver._id}/verify`,
        {verificationStatus: VERIFICATION_STATUS.APPROVED},
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
      showSnackbar('Driver verified successfully');
      fetchDrivers();
    } catch (error) {
      console.error('Error verifying driver:', error);
      showSnackbar('Failed to verify driver');
    }
  };

  const handleRejectDriver = async (driver: Driver): Promise<void> => {
    Alert.alert(
      'Reject Driver',
      'Are you sure you want to reject this driver?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('userToken');
              await axios.put(
                `${BACKEND_URL}/api/admin/drivers/${driver._id}/verify`,
                {verificationStatus: VERIFICATION_STATUS.REJECTED},
                {
                  headers: {Authorization: `Bearer ${token}`},
                },
              );
              showSnackbar('Driver rejected');
              fetchDrivers();
            } catch (error) {
              console.error('Error rejecting driver:', error);
              showSnackbar('Failed to reject driver');
            }
          },
        },
      ],
    );
  };

  const handleBlockDriver = async (): Promise<void> => {
    if (!selectedDriver) {
      showSnackbar('No driver selected');
      return;
    }

    if (!blockReason || !blockReason.trim()) {
      showSnackbar('Please provide a reason for blocking');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.put(
        `${BACKEND_URL}/api/admin/drivers/${selectedDriver._id}/block`,
        {reason: blockReason},
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
      showSnackbar('Driver blocked');
      setIsModalVisible(false);
      setBlockReason('');
      setSelectedDriver(null);
      fetchDrivers();
    } catch (error) {
      console.error('Error blocking driver:', error);
      showSnackbar('Failed to block driver');
    }
  };

  const handleUnblockDriver = async (driver: Driver): Promise<void> => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.put(
        `${BACKEND_URL}/api/admin/drivers/${driver._id}/unblock`,
        {},
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
      showSnackbar('Driver unblocked');
      fetchDrivers();
    } catch (error) {
      console.error('Error unblocking driver:', error);
      showSnackbar('Failed to unblock driver');
    }
  };

  const handleSendWarning = async (): Promise<void> => {
    if (!selectedDriver) {
      showSnackbar('No driver selected');
      return;
    }

    if (!warningMessage || !warningMessage.trim()) {
      showSnackbar('Please enter a warning message');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.post(
        `${BACKEND_URL}/api/admin/drivers/${selectedDriver._id}/warning`,
        {message: warningMessage},
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
      showSnackbar('Warning sent to driver');
      setIsModalVisible(false);
      setWarningMessage('');
      setSelectedDriver(null);
      fetchDrivers();
    } catch (error) {
      console.error('Error sending warning:', error);
      showSnackbar('Failed to send warning');
    }
  };

  const handleVerifyDocument = async (
    driverId: string,
    documentIndex: number,
  ): Promise<void> => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      await axios.put(
        `${BACKEND_URL}/api/admin/drivers/${driverId}/documents/${documentIndex}/verify`,
        {},
        {
          headers: {Authorization: `Bearer ${token}`},
        },
      );
      showSnackbar('Document verified successfully');
      fetchDrivers();
    } catch (error) {
      console.error('Error verifying document:', error);
      showSnackbar('Failed to verify document');
    }
  };

  const showSnackbar = (message: string): void => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
    setTimeout(() => {
      setSnackbarVisible(false);
    }, 3000);
  };

  const openModal = (type: ModalType, driver: Driver | null = null): void => {
    setModalType(type);
    setSelectedDriver(driver);
    setIsModalVisible(true);

    // Reset form fields
    setWarningMessage('');
    setBlockReason('');
  };

  const closeModal = (): void => {
    setIsModalVisible(false);
    setModalType('');
    setSelectedDriver(null);
    setWarningMessage('');
    setBlockReason('');
  };

  const filteredDrivers = (): Driver[] => {
    let result = drivers;

    switch (activeTab) {
      case 'pending':
        result = drivers.filter(
          driver =>
            driver.verificationStatus === VERIFICATION_STATUS.PENDING &&
            !driver.isBlocked,
        );
        break;
      case 'verified':
        result = drivers.filter(
          driver =>
            driver.verificationStatus === VERIFICATION_STATUS.APPROVED &&
            !driver.isBlocked,
        );
        break;
      case 'blocked':
        result = drivers.filter(driver => driver.isBlocked);
        break;
      case 'low-rated':
        result = drivers.filter(
          driver => driver.rating < 3.0 && !driver.isBlocked,
        );
        break;
      case 'documents':
        result = drivers.filter(
          driver =>
            driver.documents && driver.documents.some(doc => !doc.verified),
        );
        break;
    }

    // Apply search filter
    if (searchQuery) {
      result = result.filter(
        driver =>
          `${driver.firstName} ${driver.lastName}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          driver.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (driver.phone && driver.phone.includes(searchQuery)) ||
          (driver.username &&
            driver.username.toLowerCase().includes(searchQuery.toLowerCase())),
      );
    }
    return result;
  };

  const getStatusColor = (driver: Driver): string => {
    if (driver.isBlocked) return '#e74c3c'; // Red for blocked
    switch (driver.verificationStatus) {
      case VERIFICATION_STATUS.APPROVED:
        return '#2ecc71'; // Green
      case VERIFICATION_STATUS.REJECTED:
        return '#e74c3c'; // Red
      case VERIFICATION_STATUS.UNDER_REVIEW:
        return '#3498db'; // Blue
      default:
        return '#f39c12'; // Orange for pending
    }
  };

  const getDriverStatus = (driver: Driver): string => {
    if (driver.isBlocked) return 'Blocked';
    return STATUS_LABELS[driver.verificationStatus] || 'Unknown';
  };

  const getFullName = (driver: Driver): string => {
    return `${driver.firstName} ${driver.lastName}`;
  };

  const viewDriverDocument = (driver: Driver, documentIndex: number): void => {
    if (driver.documents && driver.documents[documentIndex]) {
      setSelectedDocument({
        ...driver.documents[documentIndex],
        driverId: driver._id,
        documentIndex,
      });
      setDocumentViewerVisible(true);
    } else {
      showSnackbar('Document not found');
    }
  };

  const renderHeader = () => (
    <View>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Driver Management</Text>
        {pendingCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingCount}</Text>
          </View>
        )}
      </View>

      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          placeholder="Search drivers..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon
              name="close"
              size={20}
              color="#999"
              style={styles.clearIcon}
            />
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
            activeTab === 'pending' ? styles.activeTab : null,
          ]}
          onPress={() => setActiveTab('pending')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'pending' ? styles.activeTabText : null,
            ]}>
            Pending
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
            activeTab === 'verified' ? styles.activeTab : null,
          ]}
          onPress={() => setActiveTab('verified')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'verified' ? styles.activeTabText : null,
            ]}>
            Verified
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
            activeTab === 'low-rated' ? styles.activeTab : null,
          ]}
          onPress={() => setActiveTab('low-rated')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'low-rated' ? styles.activeTabText : null,
            ]}>
            Low Rated
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'documents' ? styles.activeTab : null,
          ]}
          onPress={() => setActiveTab('documents')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'documents' ? styles.activeTabText : null,
            ]}>
            Documents
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderEmptyComponent = () => (
    <View style={styles.noResultsCard}>
      <Text style={styles.noResultsText}>No drivers found</Text>
    </View>
  );

  const renderDriverCard: ListRenderItem<Driver> = ({item: driver}) => (
    <View style={styles.driverCard}>
      <View style={styles.cardContent}>
        <View style={styles.passengerHeader}>
          <View style={styles.driverInfo}>
            {driver.profileImage ? (
              <Image
                source={{uri: driver.profileImage}}
                style={styles.passengerAvatar}
              />
            ) : (
              <View
                style={[
                  styles.passengerAvatar,
                  styles.driverAvatarPlaceholder,
                ]}>
                <Text style={styles.avatarText}>
                  {driver.firstName.charAt(0)}
                  {driver.lastName.charAt(0)}
                </Text>
              </View>
            )}
            <View>
              <Text style={styles.titleText}>{getFullName(driver)}</Text>
              <Text style={styles.paragraphText}>{driver.email}</Text>
              <Text style={styles.paragraphText}>@{driver.username}</Text>
            </View>
          </View>
          <View
            style={[styles.chip, {backgroundColor: getStatusColor(driver)}]}>
            <Text style={styles.chipText}>{getDriverStatus(driver)}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Phone:</Text>
          <Text>{driver.phone}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>License:</Text>
          <Text>{driver.licenseNumber || 'N/A'}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Vehicle:</Text>
          <Text>
            {driver.vehicle
              ? `${driver.vehicle.yearModel} ${driver.vehicle.make} ${driver.vehicle.series} (${driver.vehicle.color})`
              : 'N/A'}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Plate:</Text>
          <Text>{driver.vehicle ? driver.vehicle.plateNumber : 'N/A'}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Rating:</Text>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text
              style={
                driver.rating < 3.0
                  ? {color: '#e74c3c', fontWeight: 'bold'}
                  : {}
              }>
              {driver.rating?.toFixed(1) || 'N/A'} ({driver.totalRatings || 0}{' '}
              ratings)
            </Text>
            {driver.rating < 3.0 && (
              <Icon
                name="warning"
                size={16}
                color="#e74c3c"
                style={{marginLeft: 5}}
              />
            )}
          </View>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Total Rides:</Text>
          <Text>{driver.totalRides || 0}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status:</Text>
          <Text
            style={{
              color:
                driver.driverStatus === 'available'
                  ? '#2ecc71'
                  : driver.driverStatus === 'busy'
                  ? '#f39c12'
                  : '#95a5a6',
              fontWeight: 'bold',
            }}>
            {driver.driverStatus
              ? driver.driverStatus.toUpperCase()
              : 'OFFLINE'}
          </Text>
        </View>

        {driver.documents && driver.documents.length > 0 && (
          <View style={styles.documentsSection}>
            <Text style={styles.documentsSectionTitle}>Documents</Text>
            <View style={styles.documentsRow}>
              {driver.documents.map((doc, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.documentButton,
                    doc.verified && styles.verifiedDocument,
                  ]}
                  onPress={() => viewDriverDocument(driver, index)}>
                  <Icon
                    name={doc.verified ? 'check-circle' : 'description'}
                    size={16}
                    color={doc.verified ? '#2ecc71' : '#3498db'}
                    style={styles.documentIcon}
                  />
                  <Text style={styles.documentButtonText}>
                    {doc.documentType}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {driver.isBlocked && (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>Block Reason:</Text>
            <Text>{driver.blockReason}</Text>
          </View>
        )}

        {driver.warnings && driver.warnings.length > 0 && (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>Latest Warning:</Text>
            <Text>{driver.warnings[driver.warnings.length - 1].message}</Text>
            <Text style={styles.warningDate}>
              {new Date(
                driver.warnings[driver.warnings.length - 1].Date,
              ).toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          onPress={() => openModal('profile', driver)}
          style={[styles.actionButton, styles.profileButton]}>
          <Text style={styles.actionButtonText}>View Profile</Text>
        </TouchableOpacity>

        {driver.verificationStatus === VERIFICATION_STATUS.PENDING &&
          !driver.isBlocked && (
            <>
              <TouchableOpacity
                onPress={() => handleVerifyDriver(driver)}
                style={[styles.actionButton, styles.approveButton]}>
                <Text style={styles.actionButtonText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleRejectDriver(driver)}
                style={[styles.actionButton, styles.rejectButton]}>
                <Text style={styles.rejectButtonText}>Reject</Text>
              </TouchableOpacity>
            </>
          )}

        {driver.verificationStatus === VERIFICATION_STATUS.APPROVED &&
          !driver.isBlocked && (
            <>
              <TouchableOpacity
                onPress={() => openModal('warning', driver)}
                style={[styles.actionButton, styles.warningButton]}>
                <Text style={styles.actionButtonText}>Send Warning</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => openModal('block', driver)}
                style={[styles.actionButton, styles.blockButton]}>
                <Text style={styles.blockButtonText}>Block</Text>
              </TouchableOpacity>
            </>
          )}

        {driver.isBlocked && (
          <TouchableOpacity
            onPress={() => handleUnblockDriver(driver)}
            style={[styles.actionButton, styles.unblockButton]}>
            <Text style={styles.actionButtonText}>Unblock</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderModalContent = (): React.ReactNode => {
    switch (modalType) {
      case 'warning':
        return (
          <>
            <Text style={styles.modalTitle}>Send Warning</Text>
            <TextInput
              placeholder="Warning Message"
              value={warningMessage}
              onChangeText={setWarningMessage}
              multiline
              style={styles.textInput}
            />
            <TouchableOpacity
              onPress={handleSendWarning}
              style={[styles.modalButton, styles.sendButton]}>
              <Text style={styles.modalButtonText}>Send Warning</Text>
            </TouchableOpacity>
          </>
        );

      case 'block':
        return (
          <>
            <Text style={styles.modalTitle}>Block Driver</Text>
            <TextInput
              placeholder="Reason for Blocking"
              value={blockReason}
              onChangeText={setBlockReason}
              multiline
              style={styles.textInput}
            />
            <TouchableOpacity
              onPress={handleBlockDriver}
              style={[styles.modalButton, {backgroundColor: '#e74c3c'}]}>
              <Text style={styles.modalButtonText}>Block Driver</Text>
            </TouchableOpacity>
          </>
        );

      case 'profile':
        return (
          <>
            <Text style={styles.modalTitle}>Driver Profile</Text>
            <ScrollView style={styles.profileContent}>
              {selectedDriver && (
                <>
                  <View style={styles.profileSection}>
                    <Text style={styles.profileSectionTitle}>
                      Personal Information
                    </Text>
                    <Text style={styles.profileDetail}>
                      Name: {getFullName(selectedDriver)}
                    </Text>
                    <Text style={styles.profileDetail}>
                      Username: @{selectedDriver.username}
                    </Text>
                    <Text style={styles.profileDetail}>
                      Email: {selectedDriver.email}
                    </Text>
                    <Text style={styles.profileDetail}>
                      Phone: {selectedDriver.phone}
                    </Text>
                    <Text style={styles.profileDetail}>
                      Age: {selectedDriver.age}
                    </Text>
                    <Text style={styles.profileDetail}>
                      Birthdate:{' '}
                      {new Date(selectedDriver.birthdate).toLocaleDateString()}
                    </Text>
                  </View>

                  <View style={styles.profileSection}>
                    <Text style={styles.profileSectionTitle}>Address</Text>
                    <Text style={styles.profileDetail}>
                      {selectedDriver.homeAddress?.street},{' '}
                      {selectedDriver.homeAddress?.city},{' '}
                      {selectedDriver.homeAddress?.state}{' '}
                      {selectedDriver.homeAddress?.zipCode}
                    </Text>
                  </View>

                  <View style={styles.profileSection}>
                    <Text style={styles.profileSectionTitle}>
                      Driver Information
                    </Text>
                    <Text style={styles.profileDetail}>
                      License: {selectedDriver.licenseNumber}
                    </Text>
                    <Text style={styles.profileDetail}>
                      Status: {selectedDriver.driverStatus || 'Offline'}
                    </Text>
                    <Text style={styles.profileDetail}>
                      Rating: {selectedDriver.rating?.toFixed(1)} (
                      {selectedDriver.totalRatings} ratings)
                    </Text>
                    <Text style={styles.profileDetail}>
                      Total Rides: {selectedDriver.totalRides}
                    </Text>
                  </View>

                  {selectedDriver.vehicle && (
                    <View style={styles.profileSection}>
                      <Text style={styles.profileSectionTitle}>
                        Vehicle Information
                      </Text>
                      <Text style={styles.profileDetail}>
                        Make: {selectedDriver.vehicle.make}
                      </Text>
                      <Text style={styles.profileDetail}>
                        Series: {selectedDriver.vehicle.series}
                      </Text>
                      <Text style={styles.profileDetail}>
                        Year: {selectedDriver.vehicle.yearModel}
                      </Text>
                      <Text style={styles.profileDetail}>
                        Color: {selectedDriver.vehicle.color}
                      </Text>
                      <Text style={styles.profileDetail}>
                        Type: {selectedDriver.vehicle.type}
                      </Text>
                      <Text style={styles.profileDetail}>
                        Plate: {selectedDriver.vehicle.plateNumber}
                      </Text>
                      <Text style={styles.profileDetail}>
                        Body Number: {selectedDriver.vehicle.bodyNumber}
                      </Text>
                    </View>
                  )}

                  <View style={styles.profileSection}>
                    <Text style={styles.profileSectionTitle}>
                      Account Status
                    </Text>
                    <Text style={styles.profileDetail}>
                      Verification:{' '}
                      {STATUS_LABELS[selectedDriver.verificationStatus]}
                    </Text>
                    <Text style={styles.profileDetail}>
                      Verified: {selectedDriver.isVerified ? 'Yes' : 'No'}
                    </Text>
                    <Text style={styles.profileDetail}>
                      Blocked: {selectedDriver.isBlocked ? 'Yes' : 'No'}
                    </Text>
                    <Text style={styles.profileDetail}>
                      Joined:{' '}
                      {new Date(selectedDriver.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </>
              )}
            </ScrollView>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Main Modal */}
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContainer,
              modalType === 'profile' && styles.largeModalContainer,
            ]}>
            {renderModalContent()}
            <TouchableOpacity onPress={closeModal} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>
                {modalType === 'profile' ? 'Close' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Document Viewer Modal */}
      <Modal
        visible={documentViewerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setDocumentViewerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Driver Document</Text>
            {selectedDocument && (
              <View style={styles.documentViewer}>
                <Text style={styles.documentTitle}>
                  {selectedDocument.documentType}
                </Text>
                <Image
                  source={{uri: selectedDocument.fileURL}}
                  style={styles.documentImage}
                  resizeMode="contain"
                />
                <Text style={styles.documentDetail}>
                  Uploaded:{' '}
                  {new Date(selectedDocument.uploadDate).toLocaleDateString()}
                </Text>
                <Text style={styles.documentDetail}>
                  Status:{' '}
                  {selectedDocument.verified ? 'Verified' : 'Not Verified'}
                </Text>
                {!selectedDocument.verified && (
                  <TouchableOpacity
                    onPress={() => {
                      handleVerifyDocument(
                        selectedDocument.driverId,
                        selectedDocument.documentIndex,
                      );
                      setDocumentViewerVisible(false);
                    }}
                    style={[styles.modalButton, styles.verifyButton]}>
                    <Text style={styles.modalButtonText}>Verify Document</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            <TouchableOpacity
              onPress={() => setDocumentViewerVisible(false)}
              style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Main content with FlatList */}
      <FlatList
        data={filteredDrivers()}
        renderItem={renderDriverCard}
        keyExtractor={item => item._id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyComponent}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchDrivers} />
        }
      />

      {snackbarVisible && (
        <View style={styles.snackbar}>
          <Text style={styles.snackbarText}>{snackbarMessage}</Text>
          <TouchableOpacity onPress={() => setSnackbarVisible(false)}>
            <Text style={styles.snackbarAction}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

export default DriverManagement;
