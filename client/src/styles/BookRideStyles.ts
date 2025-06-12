import {StyleSheet} from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  backButton: {
    position: 'absolute',
    top: 10, // adjust for safe area
    left: 10,
    zIndex: 999, // so it appears over the map
    backgroundColor: 'white',
    padding: 4,
    borderRadius: 20,
    elevation: 5, // for Android shadow
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  map: {
    flex: 1,
  },
  contentContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  locationCard: {
    marginBottom: 10,
    borderRadius: 10,
    elevation: 4,
  },
  locationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    backgroundColor: '#fff',
  },
  locationText: {
    marginLeft: 10,
    flex: 1,
  },
  savedAddressesCard: {
    marginBottom: 10,
    borderRadius: 10,
    elevation: 4,
  },
  savedAddressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  savedAddressLabel: {
    marginLeft: 10,
    fontWeight: 'bold',
  },
  savedAddressText: {
    marginLeft: 10,
    color: '#555',
    maxWidth: '90%',
  },
  button: {
    marginTop: 16,
  },
  confirmBookingCard: {
    borderRadius: 10,
    elevation: 4,
  },
  tripDetails: {
    marginTop: 10,
  },
  locationSummary: {
    marginVertical: 10,
  },
  locationSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  locationSummaryText: {
    marginLeft: 10,
    flex: 1,
  },
  verticalLine: {
    height: 20,
    width: 1,
    backgroundColor: '#ddd',
    marginLeft: 10,
  },
  tripInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 10,
  },
  tripInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  divider: {
    marginVertical: 10,
  },
  fareTitle: {
    fontSize: 18,
    marginBottom: 10,
  },
  fareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 5,
  },
  fareOptionDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fareOptionText: {
    fontWeight: 'bold',
  },
  fareOptionSubtext: {
    fontSize: 12,
    color: '#777',
  },
  farePrice: {
    fontWeight: 'bold',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    marginRight: 8,
  },
  confirmButton: {
    flex: 1,
    marginLeft: 8,
  },
  searchingCard: {
    borderRadius: 10,
    elevation: 4,
  },
  searchingContent: {
    alignItems: 'center',
    padding: 20,
  },
  searchingTitle: {
    marginTop: 16,
  },
  cancelSearchButton: {
    marginTop: 20,
  },
  rideInProgressCard: {
    borderRadius: 10,
    elevation: 4,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  driverDetails: {
    marginLeft: 16,
    flex: 1,
  },
  driverName: {
    fontSize: 18,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ratingText: {
    marginLeft: 4,
  },
  vehicleInfo: {
    marginTop: 4,
  },
  plateNumber: {
    fontWeight: 'bold',
  },
  rideStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  rideStatusText: {
    marginLeft: 16,
  },
  rideStatusTitle: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  callButton: {
    marginTop: 16,
  },
  fareDetailsCard: {
    marginTop: 10,
    borderRadius: 10,
    elevation: 4,
  },
  floatingLabel: {
    position: 'absolute',
    top: 0,
    left: 12,
    backgroundColor: '#fff', // matches Card background
    paddingHorizontal: 4,
    fontSize: 14,
    color: '#555',
    zIndex: 1,
  },
});
