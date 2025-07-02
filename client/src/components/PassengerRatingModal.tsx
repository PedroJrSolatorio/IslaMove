import React, {useState} from 'react';
import {View, StyleSheet, Modal, TouchableOpacity} from 'react-native';
import {Text, Button, TextInput} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface PassengerRatingModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (rating: number, feedback: string) => void;
  driverName: string; // Passenger is rating the driver
}

const PassengerRatingModal: React.FC<PassengerRatingModalProps> = ({
  visible,
  onClose,
  onSubmit,
  driverName,
}) => {
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');

  const handleSubmit = () => {
    onSubmit(rating, feedback);
    setRating(5);
    setFeedback('');
  };

  const handleClose = () => {
    setRating(5);
    setFeedback('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}>
      <View style={styles.modalBackground}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Rate Your Driver</Text>
            <Icon name="car-key" size={24} color="#27ae60" />
          </View>

          <Text style={styles.subtitle}>
            How was your ride with {driverName}?
          </Text>

          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity
                key={star}
                onPress={() => setRating(star)}
                style={styles.starButton}>
                <Icon
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={36}
                  color={star <= rating ? '#f39c12' : '#ccc'}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.ratingText}>
            {rating === 1 && 'Poor'}
            {rating === 2 && 'Fair'}
            {rating === 3 && 'Good'}
            {rating === 4 && 'Very Good'}
            {rating === 5 && 'Excellent'}
          </Text>

          <TextInput
            label="Additional feedback (optional)"
            value={feedback}
            onChangeText={setFeedback}
            style={styles.feedbackInput}
            multiline
            numberOfLines={3}
            placeholder="How was the driver's service, driving, punctuality, etc.?"
          />

          <View style={styles.buttonContainer}>
            <Button
              mode="outlined"
              onPress={handleClose}
              style={styles.skipButton}>
              Skip
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmit}
              style={styles.submitButton}>
              Submit
            </Button>
          </View>
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
    width: '90%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 20,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 16,
  },
  starButton: {
    padding: 8,
  },
  ratingText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#f39c12',
    marginBottom: 16,
  },
  feedbackInput: {
    marginVertical: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  skipButton: {
    flex: 1,
    marginRight: 8,
  },
  submitButton: {
    flex: 1,
    marginLeft: 8,
  },
});

export default PassengerRatingModal;
