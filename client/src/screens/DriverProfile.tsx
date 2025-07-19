import React from 'react';
import {View, ScrollView, Alert, ActivityIndicator} from 'react-native';
import {Avatar, Text, Divider, List, IconButton} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/types';
import {TabsStyles} from '../styles/TabsStyles';
import {GlobalStyles} from '../styles/GlobalStyles';
import {useProfile, isDriverProfile} from '../context/ProfileContext';
import {useAuth} from '../context/AuthContext';
import {Colors} from 'react-native/Libraries/NewAppScreen';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const DriverProfileScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const {logout} = useAuth();
  const {profileData, loading, updateProfile} = useProfile();

  // Type guard to ensure we're working with driver profile
  const driverProfile = isDriverProfile(profileData) ? profileData : null;

  // Helper function to get full name
  const getFullName = () => {
    if (!profileData) return '';
    const {firstName, lastName, middleInitial} = profileData;
    return `${firstName} ${
      middleInitial ? middleInitial + '. ' : ''
    }${lastName}`.trim();
  };

  // Helper function to get initials
  const getInitials = () => {
    if (!profileData) return '';
    const {firstName, lastName} = profileData;
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`;
  };

  const handleLogout = async (
    message: string = 'You have been logged out.',
  ) => {
    try {
      await logout(message);
      navigation.navigate('Login');
    } catch (error) {
      console.error('Failed to clear AsyncStorage:', error);
      Alert.alert('Error', 'Failed to log out.');
    }
  };

  if (loading) {
    return (
      <View style={GlobalStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text>Loading profile...</Text>
      </View>
    );
  }

  if (!profileData || !driverProfile) {
    return (
      <View style={GlobalStyles.loadingContainer}>
        <Text>Profile not found or invalid user type</Text>
      </View>
    );
  }

  return (
    <>
      <View style={GlobalStyles.header}>
        <View style={GlobalStyles.headerLeft}>
          {/* Avatar section */}
          <View style={TabsStyles.avatarContainerModern}>
            {profileData.profileImage ? (
              <Avatar.Image
                size={100}
                source={{uri: profileData.profileImage}}
                style={TabsStyles.avatar}
              />
            ) : (
              <Avatar.Text
                size={50}
                label={getInitials()}
                style={TabsStyles.avatar}
                labelStyle={TabsStyles.avatarLabel}
              />
            )}
          </View>

          <View style={TabsStyles.profileInfo}>
            <Text style={TabsStyles.nameText}>{getFullName()}</Text>
            <Text style={TabsStyles.phoneTextModern}>{profileData.phone}</Text>
            {profileData.rating > 0 && (
              <View style={TabsStyles.ratingAndRides}>
                <Text style={TabsStyles.ratingText}>
                  {profileData.rating.toFixed(1)} ⭐
                </Text>
                <Text style={TabsStyles.rideCount}>
                  ({profileData.totalRides} rides)
                </Text>
              </View>
            )}
          </View>
        </View>

        <IconButton
          icon="cog"
          iconColor={Colors.gray}
          size={24}
          onPress={() => navigation.navigate('ProfileInfo' as never)}
        />
      </View>

      <View style={GlobalStyles.headerDivider} />

      <ScrollView style={GlobalStyles.container}>
        <List.Section style={TabsStyles.listSection}>
          <List.Item
            title="Account & Security"
            left={props => <List.Icon {...props} icon="shield-lock-outline" />}
            right={props => (
              <List.Icon {...props} icon="chevron-right" color={Colors.gray} />
            )}
            onPress={() => navigation.navigate('AccountSecurity' as never)}
            style={TabsStyles.listItem}
          />
          <Divider style={TabsStyles.divider} />
          <List.Item
            title="ID Documents"
            left={props => (
              <List.Icon {...props} icon="card-account-details-outline" />
            )}
            right={props => (
              <List.Icon {...props} icon="chevron-right" color={Colors.gray} />
            )}
            onPress={() => navigation.navigate('IDDocuments' as never)}
            style={TabsStyles.listItem}
          />
          <Divider style={TabsStyles.divider} />
          <List.Item
            title="Vehicle Information"
            left={props => <List.Icon {...props} icon="car" />}
            right={props => (
              <List.Icon {...props} icon="chevron-right" color={Colors.gray} />
            )}
            onPress={() =>
              navigation.navigate('DriverVehicleDocuments' as never)
            }
            style={TabsStyles.listItem}
          />
          <Divider style={TabsStyles.divider} />
          <List.Item
            title="Help & Support"
            left={props => <List.Icon {...props} icon="help-circle-outline" />}
            right={props => (
              <List.Icon {...props} icon="chevron-right" color={Colors.gray} />
            )}
            onPress={() => navigation.navigate('HelpSupport' as never)}
            style={TabsStyles.listItem}
          />
        </List.Section>
        <List.Item
          title="Logout"
          left={props => (
            <List.Icon
              {...props}
              icon="logout"
              color={TabsStyles.logoutText.color}
            />
          )}
          titleStyle={TabsStyles.logoutText}
          onPress={() => {
            Alert.alert('Logout', 'Are you sure you want to logout?', [
              {text: 'Cancel', style: 'cancel'},
              {
                text: 'Logout',
                onPress: handleLogout,
              },
            ]);
          }}
          style={[TabsStyles.listItem, TabsStyles.logoutListItem]}
        />
      </ScrollView>
    </>
  );
};

export default DriverProfileScreen;
