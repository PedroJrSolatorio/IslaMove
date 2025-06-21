import React from 'react';
import {View, Text, TouchableOpacity, Modal, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {MapType} from 'react-native-maps';

interface MapTypeOption {
  value: MapType;
  label: string;
  icon: string;
}

interface MapTypeSelectorProps {
  visible: boolean;
  currentMapType: MapType;
  onClose: () => void;
  onMapTypeSelect: (mapType: MapType) => void;
}

const MapTypeSelector: React.FC<MapTypeSelectorProps> = ({
  visible,
  currentMapType,
  onClose,
  onMapTypeSelect,
}) => {
  const mapTypeOptions: MapTypeOption[] = [
    {value: 'standard', label: 'Standard', icon: 'map'},
    {value: 'satellite', label: 'Satellite', icon: 'satellite-variant'},
    {value: 'hybrid', label: 'Hybrid', icon: 'map-marker-radius'},
    {value: 'terrain', label: 'Terrain', icon: 'terrain'},
  ];

  const handleMapTypeSelect = (mapType: MapType) => {
    onMapTypeSelect(mapType);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.mapTypeSelectorContainer}>
          <View style={styles.mapTypeSelectorHeader}>
            <Text style={styles.mapTypeSelectorTitle}>Select Map Type</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.mapTypeOptions}>
            {mapTypeOptions.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.mapTypeOption,
                  currentMapType === option.value &&
                    styles.selectedMapTypeOption,
                ]}
                onPress={() => handleMapTypeSelect(option.value)}>
                <Icon
                  name={option.icon}
                  size={24}
                  color={currentMapType === option.value ? '#3498db' : '#666'}
                />
                <Text
                  style={[
                    styles.mapTypeOptionText,
                    currentMapType === option.value &&
                      styles.selectedMapTypeOptionText,
                  ]}>
                  {option.label}
                </Text>
                {currentMapType === option.value && (
                  <Icon name="check" size={20} color="#3498db" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  mapTypeSelectorContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
  },
  mapTypeSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  mapTypeSelectorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  mapTypeOptions: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  mapTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    marginVertical: 5,
    borderRadius: 10,
    backgroundColor: '#f8f9fa',
  },
  selectedMapTypeOption: {
    backgroundColor: '#e3f2fd',
    borderWidth: 2,
    borderColor: '#3498db',
  },
  mapTypeOptionText: {
    fontSize: 16,
    marginLeft: 15,
    flex: 1,
    color: '#333',
  },
  selectedMapTypeOptionText: {
    color: '#3498db',
    fontWeight: '600',
  },
});

export default MapTypeSelector;
