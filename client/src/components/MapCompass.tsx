import React from 'react';
import {View, TouchableOpacity, StyleSheet, Animated} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface MapCompassProps {
  bearing: number; // Current map bearing in degrees
  onPress: () => void; // Callback to reset bearing to 0 (north)
  visible?: boolean; // Only show when bearing is not 0
}

const MapCompass: React.FC<MapCompassProps> = ({
  bearing,
  onPress,
  visible = true,
}) => {
  if (!visible) {
    return null;
  }

  return (
    <TouchableOpacity
      style={styles.compassContainer}
      onPress={onPress}
      activeOpacity={0.8}>
      <View style={styles.compassCircle}>
        {/* Compass Rose Background */}
        <View style={styles.compassRose}>
          {/* North Arrow - always points north regardless of map rotation */}
          <View
            style={[
              styles.northArrow,
              {
                transform: [{rotate: `${-bearing}deg`}],
              },
            ]}>
            <Icon name="navigation" size={20} color="#e74c3c" />
          </View>

          {/* Compass Tick Marks */}
          {[0, 90, 180, 270].map(angle => (
            <View
              key={angle}
              style={[
                styles.compassTick,
                {
                  transform: [
                    {rotate: `${angle - bearing}deg`},
                    {translateY: -12},
                  ],
                },
              ]}
            />
          ))}

          {/* Cardinal Direction Labels */}
          <View
            style={[
              styles.cardinalLabel,
              styles.northLabel,
              {
                transform: [{rotate: `${-bearing}deg`}],
              },
            ]}>
            <Icon name="alpha-n" size={12} color="#2c3e50" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  compassContainer: {
    position: 'absolute',
    top: 60, // Position below map type button
    right: 16,
    backgroundColor: 'white',
    borderRadius: 25,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 9999,
  },
  compassCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  compassRose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  northArrow: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  compassTick: {
    position: 'absolute',
    width: 1,
    height: 4,
    backgroundColor: '#6c757d',
  },
  cardinalLabel: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  northLabel: {
    top: -2,
  },
});

export default MapCompass;
