// components/MapTypeSelector.tsx
import React from 'react';
import {View, Text, TouchableOpacity, Modal} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {MapType} from 'react-native-maps';
import {styles} from '../styles/BookRideStyles';

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

export default MapTypeSelector;
