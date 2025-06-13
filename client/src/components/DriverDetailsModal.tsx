import React from 'react';
import {View, StyleSheet, Modal, ScrollView, Image} from 'react-native';
import {Text, Button, Avatar, Card, Divider} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface Driver {
  _id: string;
  fullName: string;
  profileImage: string;
  rating: number;
  totalRides: number;
  vehicle: {
    make: string;
    model: string;
    color: string;
    plateNumber: string;
  };
}

interface DriverDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  driver: Driver | null;
  onCallDriver: () => void;
  onMessageDriver: () => void;
}

const DriverDetailsModal: React.FC<DriverDetailsModalProps> = ({
  visible,
  onClose,
  driver,
  onCallDriver,
  onMessageDriver,
}) => {
  if (!driver) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}>
      <View style={styles.modalBackground}>
        <View style={styles.modalContainer}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.closeButtonContainer}>
              <Button
                icon="close"
                mode="text"
                onPress={onClose}
                style={styles.closeButton}>
                Close
              </Button>
            </View>

            <View style={styles.driverHeader}>
              <Avatar.Image
                size={80}
                source={
                  driver.profileImage
                    ? {uri: driver.profileImage}
                    : require('../assets/default-avatar.png')
                }
              />
              <Text style={styles.driverName}>{driver.fullName}</Text>
              <View style={styles.ratingContainer}>
                <Icon name="star" size={20} color="#f39c12" />
                <Text style={styles.ratingText}>
                  {driver.rating.toFixed(1)} • {driver.totalRides} rides
                </Text>
              </View>
            </View>

            <Card style={styles.vehicleCard}>
              <Card.Content>
                <Text style={styles.sectionTitle}>Vehicle Information</Text>
                <View style={styles.vehicleInfo}>
                  <Text style={styles.vehicleDetail}>
                    <Text style={styles.detailLabel}>Vehicle: </Text>
                    {driver.vehicle.color} {driver.vehicle.make}{' '}
                    {driver.vehicle.model}
                  </Text>
                  <Text style={styles.vehicleDetail}>
                    <Text style={styles.detailLabel}>Plate Number: </Text>
                    {driver.vehicle.plateNumber}
                  </Text>
                </View>
              </Card.Content>
            </Card>

            <View style={styles.contactActions}>
              <Button
                mode="contained"
                icon="phone"
                style={styles.contactButton}
                onPress={onCallDriver}>
                Call
              </Button>
              <Button
                mode="outlined"
                icon="message-text"
                style={styles.contactButton}
                onPress={onMessageDriver}>
                Message
              </Button>
            </View>

            <Text style={styles.infoText}>
              You can contact your driver directly if you need to provide
              additional information about your pickup location or if you have
              any questions.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  closeButtonContainer: {
    alignItems: 'flex-end',
  },
  closeButton: {
    marginBottom: 10,
  },
  driverHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  driverName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 10,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  ratingText: {
    marginLeft: 5,
    fontSize: 16,
  },
  vehicleCard: {
    marginVertical: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  vehicleInfo: {
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 8,
  },
  vehicleDetail: {
    fontSize: 16,
    marginVertical: 5,
  },
  detailLabel: {
    fontWeight: 'bold',
  },
  contactActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20,
  },
  contactButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  infoText: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    marginVertical: 10,
  },
});

export default DriverDetailsModal;
