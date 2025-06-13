import React, {useState} from 'react';
import {View, StyleSheet, Modal, TouchableOpacity} from 'react-native';
import {Text, Button, TextInput} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (rating: number, feedback: string) => void;
  driverName: string;
}

const RatingModal: React.FC<RatingModalProps> = ({
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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}>
      <View style={styles.modalBackground}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Rate your ride</Text>
            <Icon name="check-circle" size={24} color="#27ae60" />
          </View>

          <Text style={styles.subtitle}>
            How was your experience with {driverName}?
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

          <TextInput
            label="Additional feedback (optional)"
            value={feedback}
            onChangeText={setFeedback}
            style={styles.feedbackInput}
            multiline
            numberOfLines={3}
          />

          <View style={styles.buttonContainer}>
            <Button mode="outlined" onPress={onClose} style={styles.skipButton}>
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
  },
  subtitle: {
    fontSize: 16,
    color: '#555',
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 16,
  },
  starButton: {
    padding: 4,
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

export default RatingModal;
