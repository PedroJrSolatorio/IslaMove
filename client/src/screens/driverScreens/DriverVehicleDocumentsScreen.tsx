import React, {useState, useEffect} from 'react';
import {
  View,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import {
  Card,
  Title,
  Button,
  TextInput,
  Text,
  Divider,
  List,
  Chip,
  IconButton,
} from 'react-native-paper';
import {TabsStyles} from '../../styles/TabsStyles';
import {GlobalStyles} from '../../styles/GlobalStyles';
import {useProfile, isDriverProfile} from '../../context/ProfileContext';
import {Colors} from '../../styles/Colors';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const DriverVehicleDocumentsScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const {profileData, loading, updateProfile} = useProfile();

  // Type guard to ensure we're working with driver profile
  const driverProfile = isDriverProfile(profileData) ? profileData : null;

  const [editingVehicle, setEditingVehicle] = useState(false);

  // Vehicle form state
  const [vehicleData, setVehicleData] = useState({
    make: driverProfile?.vehicle?.make || '',
    series: driverProfile?.vehicle?.series || '',
    yearModel: driverProfile?.vehicle?.yearModel?.toString() || '',
    color: driverProfile?.vehicle?.color || '',
    plateNumber: driverProfile?.vehicle?.plateNumber || '',
    bodyNumber: driverProfile?.vehicle?.bodyNumber || '',
  });

  // Update vehicleData when driverProfile changes (e.g., after initial load or profile refresh)
  useEffect(() => {
    if (driverProfile?.vehicle) {
      setVehicleData({
        make: driverProfile.vehicle.make || '',
        series: driverProfile.vehicle.series || '',
        yearModel: driverProfile.vehicle.yearModel?.toString() || '',
        color: driverProfile.vehicle.color || '',
        plateNumber: driverProfile.vehicle.plateNumber || '',
        bodyNumber: driverProfile.vehicle.bodyNumber || '',
      });
    }
  }, [driverProfile]);

  // Helper function to format date
  const formatDate = (dateString: string | number | Date) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Toggle vehicle editing
  const toggleVehicleEdit = () => {
    if (editingVehicle) {
      // Reset vehicle form if canceling edit
      setVehicleData({
        make: driverProfile?.vehicle?.make || '',
        series: driverProfile?.vehicle?.series || '',
        yearModel: driverProfile?.vehicle?.yearModel?.toString() || '',
        color: driverProfile?.vehicle?.color || '',
        plateNumber: driverProfile?.vehicle?.plateNumber || '',
        bodyNumber: driverProfile?.vehicle?.bodyNumber || '',
      });
    }
    setEditingVehicle(!editingVehicle);
  };

  const handleSaveVehicle = async () => {
    try {
      const vehicleInfo = {
        vehicle: {
          make: vehicleData.make,
          series: vehicleData.series,
          yearModel: parseInt(vehicleData.yearModel) || 0,
          color: vehicleData.color,
          type: 'bao-bao' as const,
          plateNumber: vehicleData.plateNumber,
          bodyNumber: vehicleData.bodyNumber,
        },
      };

      await updateProfile(vehicleInfo);
      setEditingVehicle(false);
      Alert.alert('Success', 'Vehicle information updated successfully!');
    } catch (error) {
      console.error('Error updating vehicle:', error);
    }
  };

  if (loading) {
    return (
      <View style={GlobalStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text>Loading vehicle and document information...</Text>
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
      <View
        style={{
          height: 60,
          backgroundColor: '#f8f8f8',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          position: 'relative',
        }}>
        <IconButton
          icon="arrow-left"
          iconColor="#000"
          size={24}
          onPress={() => navigation.goBack()}
        />
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            alignItems: 'center',
          }}>
          <Text style={{fontSize: 20, fontWeight: 'bold'}}>
            Vehicle Info & Docs
          </Text>
        </View>
        <IconButton
          icon={editingVehicle ? 'close' : 'pencil'}
          iconColor="#000"
          size={24}
          onPress={toggleVehicleEdit}
        />
      </View>
      <ScrollView style={GlobalStyles.container}>
        {/* Vehicle Information Section */}
        <Card style={[TabsStyles.sectionCard, {marginTop: 16}]}>
          <Card.Content>
            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Make</Text>
              {editingVehicle ? (
                <TextInput
                  value={vehicleData.make}
                  onChangeText={text =>
                    setVehicleData({...vehicleData, make: text})
                  }
                  style={TabsStyles.input}
                  mode="outlined"
                />
              ) : (
                <Text style={TabsStyles.infoValue}>
                  {driverProfile.vehicle?.make || 'Not set'}
                </Text>
              )}
            </View>

            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Series</Text>
              {editingVehicle ? (
                <TextInput
                  value={vehicleData.series}
                  onChangeText={text =>
                    setVehicleData({...vehicleData, series: text})
                  }
                  style={TabsStyles.input}
                  mode="outlined"
                />
              ) : (
                <Text style={TabsStyles.infoValue}>
                  {driverProfile.vehicle?.series || 'Not set'}
                </Text>
              )}
            </View>

            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Year Model</Text>
              {editingVehicle ? (
                <TextInput
                  value={vehicleData.yearModel}
                  onChangeText={text =>
                    setVehicleData({...vehicleData, yearModel: text})
                  }
                  style={TabsStyles.input}
                  mode="outlined"
                  keyboardType="numeric"
                />
              ) : (
                <Text style={TabsStyles.infoValue}>
                  {driverProfile.vehicle?.yearModel || 'Not set'}
                </Text>
              )}
            </View>

            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Color</Text>
              {editingVehicle ? (
                <TextInput
                  value={vehicleData.color}
                  onChangeText={text =>
                    setVehicleData({...vehicleData, color: text})
                  }
                  style={TabsStyles.input}
                  mode="outlined"
                />
              ) : (
                <Text style={TabsStyles.infoValue}>
                  {driverProfile.vehicle?.color || 'Not set'}
                </Text>
              )}
            </View>

            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Type</Text>
              <Text style={[TabsStyles.infoValue, {color: '#666'}]}>
                Bao-Bao
              </Text>
            </View>

            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Plate Number</Text>
              {editingVehicle ? (
                <TextInput
                  value={vehicleData.plateNumber}
                  onChangeText={text =>
                    setVehicleData({...vehicleData, plateNumber: text})
                  }
                  style={TabsStyles.input}
                  mode="outlined"
                />
              ) : (
                <Text style={TabsStyles.infoValue}>
                  {driverProfile.vehicle?.plateNumber || 'Not set'}
                </Text>
              )}
            </View>

            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Body Number</Text>
              {editingVehicle ? (
                <TextInput
                  value={vehicleData.bodyNumber}
                  onChangeText={text =>
                    setVehicleData({...vehicleData, bodyNumber: text})
                  }
                  style={TabsStyles.input}
                  mode="outlined"
                />
              ) : (
                <Text style={TabsStyles.infoValue}>
                  {driverProfile.vehicle?.bodyNumber || 'Not set'}
                </Text>
              )}
            </View>

            {editingVehicle && (
              <View style={TabsStyles.buttonContainer}>
                <Button
                  mode="contained"
                  onPress={handleSaveVehicle}
                  style={TabsStyles.saveButton}>
                  Save Vehicle Info
                </Button>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Documents Section */}
        <Card style={TabsStyles.sectionCard}>
          <Card.Content>
            <Title>Documents</Title>
            <Divider style={TabsStyles.divider} />

            {driverProfile.documents?.length === 0 ||
            !driverProfile.documents ? (
              <Text style={TabsStyles.noDocumentsText}>
                No documents uploaded
              </Text>
            ) : (
              driverProfile.documents?.map((doc, index) => (
                <List.Item
                  key={index}
                  title={doc.documentType}
                  description={`Uploaded: ${formatDate(doc.uploadDate)}`}
                  left={props => (
                    <List.Icon
                      {...props}
                      icon={
                        doc.documentType === 'License'
                          ? 'card-account-details'
                          : doc.documentType === 'Registration'
                          ? 'file-document'
                          : doc.documentType === 'MODA Certificate'
                          ? 'certificate'
                          : 'camera' // Default icon if type doesn't match
                      }
                    />
                  )}
                  right={props => (
                    <Chip
                      mode="flat"
                      style={{
                        backgroundColor: doc.verified
                          ? Colors.success
                          : Colors.secondary,
                        alignSelf: 'center',
                      }}
                      textStyle={{color: Colors.lightText, fontSize: 12}}>
                      {doc.verified ? 'Verified' : 'Pending'}
                    </Chip>
                  )}
                  style={TabsStyles.listItem}
                />
              ))
            )}
          </Card.Content>
        </Card>
        <View style={{height: 50}} />
      </ScrollView>
    </>
  );
};

export default DriverVehicleDocumentsScreen;
