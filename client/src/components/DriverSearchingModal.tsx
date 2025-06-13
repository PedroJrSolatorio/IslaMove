import React, {useState, useEffect} from 'react';
import {View, StyleSheet, Modal, ActivityIndicator} from 'react-native';
import {Text, Button, Avatar} from 'react-native-paper';
// import LottieView from 'lottie-react-native'; //npm install lottie-react-native
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface DriverSearchingModalProps {
  visible: boolean;
  onCancel: () => void;
  searchTime?: number; // Search timeout in seconds
}

const DriverSearchingModal: React.FC<DriverSearchingModalProps> = ({
  visible,
  onCancel,
  searchTime = 60,
}) => {
  const [timeLeft, setTimeLeft] = useState(searchTime);

  // Countdown timer
  useEffect(() => {
    if (!visible) {
      setTimeLeft(searchTime);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft(prevTime => {
        if (prevTime <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [visible, searchTime]);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}>
      <View style={styles.modalBackground}>
        <View style={styles.modalContainer}>
          <View style={styles.searchAnimation}>
            {/* If you have a Lottie animation file, use it here */}
            {/* <LottieView
              source={require('../assets/animations/searching-car.json')}
              autoPlay
              loop
              style={styles.lottie}
            /> */}

            {/* Fallback if no Lottie animation */}
            <View style={styles.animationFallback}>
              <ActivityIndicator size="large" color="#3498db" />
              <Icon
                name="car-search"
                size={60}
                color="#3498db"
                style={styles.carIcon}
              />
            </View>
          </View>

          <Text style={styles.title}>Finding your driver</Text>
          <Text style={styles.subtitle}>
            Looking for drivers in your area...
          </Text>

          <View style={styles.timeContainer}>
            <Icon name="clock-outline" size={20} color="#7f8c8d" />
            <Text style={styles.timeText}>
              {timeLeft > 0
                ? `Searching for ${timeLeft} more seconds`
                : 'Continuing search...'}
            </Text>
          </View>

          <Text style={styles.infoText}>
            We are matching you with the best available driver nearby. This
            usually takes less than a minute.
          </Text>

          <Button
            mode="outlined"
            onPress={onCancel}
            style={styles.cancelButton}>
            Cancel Request
          </Button>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    elevation: 5,
  },
  searchAnimation: {
    height: 120,
    width: 120,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lottie: {
    height: '100%',
    width: '100%',
  },
  animationFallback: {
    height: '100%',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  carIcon: {
    position: 'absolute',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 20,
    textAlign: 'center',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 20,
  },
  timeText: {
    marginLeft: 8,
    color: '#7f8c8d',
  },
  infoText: {
    textAlign: 'center',
    color: '#7f8c8d',
    marginBottom: 24,
    fontSize: 14,
  },
  cancelButton: {
    minWidth: 180,
  },
});

export default DriverSearchingModal;
