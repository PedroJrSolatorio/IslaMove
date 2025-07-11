import {StyleSheet} from 'react-native';
import {Colors} from './Colors';
import {Fonts} from './Fonts';
import {Spacing} from './Spacing';

export const TabsStyles = StyleSheet.create({
  profileCard: {
    margin: 16,
    elevation: 4,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    backgroundColor: '#e0e0e0',
  },
  editAvatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#f39c12',
    borderRadius: 15,
    padding: 5,
  },
  editAvatarText: {
    color: 'white',
    fontSize: 12,
  },
  profileInfo: {
    flex: 1,
  },
  nameText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
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
  ratingText: {
    fontWeight: 'bold',
    marginRight: 4,
  },
  rideCount: {
    color: '#666',
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
  },
  divider: {
    marginVertical: 8,
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
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
  saveAddressesButton: {
    backgroundColor: '#3498db',
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
});
