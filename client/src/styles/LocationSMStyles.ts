import {StyleSheet} from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 16,
  },
  searchbar: {
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 3,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  currentLocationText: {
    marginLeft: 16,
    fontSize: 16,
  },
  sectionTitle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f9f9f9',
    fontWeight: 'bold',
    color: '#7f8c8d',
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  locationItemContent: {
    marginLeft: 16,
    flex: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '500',
  },
  locationAddress: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
});
