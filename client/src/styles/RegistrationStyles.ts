import {StyleSheet} from 'react-native';

export const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
    marginBottom: 8,
  },
  progressText: {
    textAlign: 'center',
    color: '#666',
  },
  stepContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  stepInstructions: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    marginBottom: 16,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
  },
  dropdown: {
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
  },
  button: {
    height: 48,
    justifyContent: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  halfButton: {
    flex: 0.48,
    height: 48,
    justifyContent: 'center',
  },
  // Profile image styles
  profileImageContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  profilePreviewContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  profilePreview: {
    width: 150,
    height: 150,
    borderRadius: 75,
    marginBottom: 8,
  },
  emptyProfileContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyProfileText: {
    color: '#999',
  },
  // Document styles
  documentLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  documentPreviewContainer: {
    marginBottom: 4,
  },
  documentPreview: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
    marginBottom: 8,
    borderRadius: 4,
  },
  documentButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    gap: 8,
  },
  documentButtonRow2: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  documentButton: {
    flex: 0.45,
  },
  tipsText: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 5,
    marginVertical: 15,
    fontSize: 14,
    lineHeight: 20,
  },
  infoContainer: {
    backgroundColor: '#e7f3fe',
    padding: 15,
    borderRadius: 5,
    marginVertical: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  infoTitle: {
    fontWeight: 'bold',
    marginBottom: 10,
    fontSize: 16,
  },
  infoText: {
    lineHeight: 22,
    marginBottom: 10,
  },
  infoText2: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
    marginLeft: 4,
  },
  infoNote: {
    fontStyle: 'italic',
    color: '#666',
  },
  datePickerButton: {
    justifyContent: 'center',
    paddingHorizontal: 12,
    height: 50,
  },
  categoryInfo: {
    marginTop: 10,
    marginBottom: 20,
    paddingHorizontal: 15,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  paperInput: {
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  paperInputOutline: {
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  paperInputContent: {
    paddingHorizontal: 15,
  },
  uploadedNote: {
    fontSize: 12,
    color: 'green',
    marginVertical: 4,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#ccc',
    marginVertical: 20,
    opacity: 0.6,
  },
});
