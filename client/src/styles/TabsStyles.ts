import {StyleSheet} from 'react-native';
import {Colors} from './Colors';
import {Fonts} from './Fonts';
import {Spacing} from './Spacing';

export const TabsStyles = StyleSheet.create({
  profileCard: {
    marginHorizontal: Spacing.medium,
    marginTop: Spacing.medium,
    marginBottom: Spacing.medium,
    borderRadius: 12,
    elevation: 2, // Subtle shadow
    backgroundColor: Colors.lightText,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.medium,
    paddingHorizontal: Spacing.medium,
  },
  avatarContainerModern: {
    position: 'relative',
    marginRight: Spacing.medium,
    borderRadius: 55, // Slightly larger than avatar size to create a border (e.g., 100px avatar + 5px border on each side = 110px total diameter, so borderRadius 55)
    overflow: 'hidden', // Ensures the image is clipped to the circular shape
    borderWidth: 2, // Adjust border width for desired thickness
    // borderColor: Colors.primary, // A vibrant, appealing blue
    shadowColor: '#000', // For a subtle shadow
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3, // For Android shadow
  },
  avatar: {
    backgroundColor: '#e0e0e0', // Keep a neutral background for initials
    width: 100, // Make sure this matches the `size` prop of Avatar.Image/Text
    height: 100, // Make sure this matches the `size` prop of Avatar.Image/Text
    borderRadius: 50, // Half of width/height to make it circular
  },
  avatarLabel: {
    fontSize: 28,
    color: '#FFFFFF', // White text for initials for better contrast on a potentially darker initial background
  },
  editAvatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    left: 0,
    top: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Darker overlay for pending
    justifyContent: 'center',
    alignItems: 'center',
  },
  editAvatarIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.lightText,
    borderRadius: 15,
    padding: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editAvatarText: {
    color: 'white',
    fontSize: 12,
  },
  editAvatarIconButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.lightText,
    borderRadius: 20, // Make it circular (half of size + padding)
    padding: 0, // reset IconButton default padding
    margin: 0, // reset default margin
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 2, // Optional: add a subtle shadow
  },
  fullNameText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 5,
  },
  profileInfo: {
    flex: 1,
  },
  nameText: {
    fontSize: Fonts.size.large,
    fontWeight: 'bold',
    // color: '#34495E',
  },
  phoneTextModern: {
    fontSize: Fonts.size.medium,
    color: '#7F8C8D',
    marginTop: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  starIcon: {
    backgroundColor: 'transparent',
    marginRight: 4,
  },
  ratingAndRides: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingText: {
    fontSize: Fonts.size.small,
    color: Colors.text,
    marginRight: 4,
  },
  rideCount: {
    fontSize: Fonts.size.small,
    color: Colors.darkGray,
  },
  saveButton: {
    marginTop: 8,
  },
  bookButton: {
    marginBottom: 12,
    paddingVertical: 8,
    backgroundColor: '#3498db',
  },
  cancelButton: {
    paddingVertical: 8,
  },
  sectionCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 2,
    borderRadius: 8, // Added for modern look
  },
  divider: {
    marginVertical: 8,
    backgroundColor: '#eee', // Lighter divider
  },
  infoRow: {
    marginVertical: 8,
  },
  infoLabel: {
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
  },
  input: {
    marginTop: 4,
    backgroundColor: 'white',
    borderRadius: 8, // Added for modern look
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  addressInput: {
    marginTop: 8,
    backgroundColor: 'white',
  },
  addButton: {
    marginTop: 16,
  },
  defaultButton: {
    backgroundColor: '#007bff',
    borderRadius: 4,
    padding: 6,
  },
  defaultButtonText: {
    color: 'white',
    fontSize: 12,
  },
  defaultText: {
    color: '#007bff',
    fontWeight: 'bold',
  },
  noDocumentsText: {
    textAlign: 'center',
    marginTop: 20,
    color: Colors.gray,
  },
  buttonContainer: {
    margin: 16,
    marginTop: 0,
  },
  logoutButton: {
    backgroundColor: '#ff3b30',
  },
  helpButton: {
    marginBottom: 32,
  },
  rideCard: {
    margin: 16,
    elevation: 4,
  },
  rideCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultsCard: {
    marginTop: 8,
    elevation: 2,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  actionCard: {
    width: '48%',
    elevation: 2,
  },
  actionCardContent: {
    alignItems: 'center',
    padding: 10,
  },
  actionIcon: {
    backgroundColor: '#3498db',
  },
  actionText: {
    marginTop: 8,
    fontWeight: 'bold',
  },
  recentRidesCard: {
    margin: 16,
    marginTop: 0,
    elevation: 4,
  },
  recentRideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  recentRideIcon: {
    backgroundColor: '#2ecc71',
  },
  recentRideDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
    minWidth: 100,
  },
  recentRideDestination: {
    fontWeight: 'bold',
  },
  recentRideDate: {
    fontSize: 12,
    color: '#757575',
  },
  recentRidePrice: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 10,
  },
  statusText: {
    // color: "white",
    color: '#333',
    fontWeight: 'bold',
  },
  requestItem: {
    marginVertical: 8,
  },
  requestDetails: {
    marginBottom: 8,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  originIcon: {
    backgroundColor: '#3498db',
  },
  destinationIcon: {
    backgroundColor: '#e74c3c',
  },
  locationText: {
    marginLeft: 8,
  },
  priceText: {
    fontWeight: 'bold',
    fontSize: 16,
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  acceptButton: {
    flex: 1,
    marginRight: 8,
    backgroundColor: '#27ae60',
  },
  rejectButton: {
    flex: 1,
    marginLeft: 8,
    borderColor: '#e74c3c',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    color: '#757575',
  },
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalTitle: {
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 5,
  },
  noAddressText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginVertical: 16,
  },
  profileHeaderContainer: {
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: Colors.background,
  },
  addressButtonsContainer: {
    marginTop: 16,
    flexDirection: 'column',
    gap: 12, // use spacing between buttons; replace with `marginBottom` if using older React Native
  },
  addAddressButton: {
    marginBottom: 4,
    borderColor: '#3498db',
    borderWidth: 1,
  },
  noAddressesText: {
    textAlign: 'center',
    marginTop: 20,
    color: Colors.gray,
  },
  editButtonText: {
    color: '#3498db', // or use theme color
    fontSize: 16,
    fontWeight: 'bold',
  },
  googleInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  infoMessage: {
    fontSize: 12,
    color: 'gray',
    marginTop: -10, // Adjust spacing as needed
    marginBottom: 10,
    textAlign: 'center',
  },

  // List Item Styles for settings
  listSection: {
    marginHorizontal: Spacing.medium,
    marginTop: Spacing.medium,
    paddingVertical: 8,
    borderRadius: 12,
    elevation: 2,
    backgroundColor: Colors.background,
  },
  listItem: {
    paddingVertical: 0,
  },
  logoutListItem: {
    backgroundColor: Colors.lightText,
    marginHorizontal: Spacing.medium,
    marginTop: Spacing.small,
    paddingVertical: 8,
    borderRadius: 12,
    elevation: 2,
    marginBottom: Spacing.medium,
  },
  logoutText: {
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  imagePreviewContainer: {
    marginTop: 20,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  idDocumentImage: {
    width: '100%',
    height: 200,
    resizeMode: 'contain',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 10,
    marginBottom: 10,
  },
  imageDisclaimer: {
    fontSize: 12,
    color: Colors.gray,
    textAlign: 'center',
    marginTop: 5,
    paddingHorizontal: 10,
  },
});
