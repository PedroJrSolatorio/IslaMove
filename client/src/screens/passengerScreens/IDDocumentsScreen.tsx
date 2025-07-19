import React from 'react';
import {View, ScrollView, ActivityIndicator, Image} from 'react-native';
import {Card, Text} from 'react-native-paper';
import {TabsStyles} from '../../styles/TabsStyles';
import {GlobalStyles} from '../../styles/GlobalStyles';
import {useProfile, isPassengerProfile} from '../../context/ProfileContext';
import {Colors} from '../../styles/Colors';

const IDDocumentsScreen = () => {
  const {profileData, loading} = useProfile();

  // Type guard to ensure we're working with passenger profile
  const passengerProfile = isPassengerProfile(profileData) ? profileData : null;

  // Helper function to format date
  const formatDate = (dateString: string | number | Date) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={GlobalStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text>Loading ID document information...</Text>
      </View>
    );
  }

  if (!profileData || !passengerProfile) {
    return (
      <View style={GlobalStyles.loadingContainer}>
        <Text>Profile not found or invalid user type</Text>
      </View>
    );
  }

  const idDocument = profileData.idDocument;

  return (
    <ScrollView style={GlobalStyles.container}>
      <Card style={[TabsStyles.sectionCard, {marginTop: 16}]}>
        <Card.Content>
          <View style={TabsStyles.infoRow}>
            <Text style={TabsStyles.infoLabel}>Document Type</Text>
            <Text style={[TabsStyles.infoValue, {color: '#666'}]}>
              {idDocument.type
                ?.replace('_', ' ')
                .replace(/\b\w/g, l => l.toUpperCase()) || 'Not specified'}
            </Text>
          </View>

          <View style={TabsStyles.infoRow}>
            <Text style={TabsStyles.infoLabel}>Verification Status</Text>
            <Text
              style={[
                TabsStyles.infoValue,
                {
                  color:
                    profileData.verificationStatus === 'approved'
                      ? Colors.success
                      : profileData.verificationStatus === 'rejected'
                      ? Colors.danger
                      : Colors.secondary,
                  fontWeight: 'bold',
                },
              ]}>
              {profileData.verificationStatus
                ?.replace('_', ' ')
                .replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}
            </Text>
          </View>

          {idDocument.uploadedAt && (
            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Uploaded On</Text>
              <Text style={[TabsStyles.infoValue, {color: '#666'}]}>
                {formatDate(idDocument.uploadedAt)}
              </Text>
            </View>
          )}

          {idDocument.verifiedAt &&
            profileData.verificationStatus === 'approved' && (
              <View style={TabsStyles.infoRow}>
                <Text style={TabsStyles.infoLabel}>Verified On</Text>
                <Text style={[TabsStyles.infoValue, {color: '#666'}]}>
                  {formatDate(idDocument.verifiedAt)}
                </Text>
              </View>
            )}

          {profileData.pendingProfileImage?.status === 'pending' && (
            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Pending Image</Text>
              <Text style={[TabsStyles.infoValue, {color: Colors.secondary}]}>
                Under Review (Profile Image)
              </Text>
            </View>
          )}

          {profileData.pendingProfileImage?.status === 'rejected' && (
            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Rejection Reason</Text>
              <Text style={[TabsStyles.infoValue, {color: Colors.danger}]}>
                {profileData.pendingProfileImage.rejectionReason ||
                  'No reason provided.'}
              </Text>
            </View>
          )}

          {idDocument.imageUrl ? (
            <View style={TabsStyles.imagePreviewContainer}>
              <Text style={TabsStyles.infoLabel}>Document Image</Text>
              <Image
                source={{uri: idDocument.imageUrl}}
                style={TabsStyles.idDocumentImage}
                resizeMode="contain"
              />
              <Text style={TabsStyles.imageDisclaimer}>
                This is a preview of your uploaded ID document. For security, it
                cannot be downloaded or changed here.
              </Text>
            </View>
          ) : (
            <View style={TabsStyles.infoRow}>
              <Text style={TabsStyles.infoLabel}>Document Image</Text>
              <Text style={[TabsStyles.infoValue, {color: '#888'}]}>
                No image uploaded.
              </Text>
            </View>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

export default IDDocumentsScreen;
