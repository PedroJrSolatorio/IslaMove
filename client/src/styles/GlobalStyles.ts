import {Dimensions, StyleSheet} from 'react-native';
import {Colors} from './Colors';
import {Fonts} from './Fonts';
import {Spacing} from './Spacing';

const {width, height} = Dimensions.get('window'); //to get the screen size of the current device

export const GlobalStyles = StyleSheet.create({
  text: {
    fontSize: Fonts.size.medium,
    color: Colors.text,
  },
  buttonText: {
    color: Colors.lightText,
    fontSize: Fonts.size.medium,
  },

  // custom styles
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: '#007bff',
    paddingVertical: Spacing.small,
    paddingHorizontal: Spacing.medium,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffcccc',
  },
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContainer: {
    width: '80%',
  },
  primaryButton: {
    marginVertical: 10,
    backgroundColor: Colors.primary, // the default color for the button is violet  since i use react-native-paper which have default colors unless creating a custom theme or setting a custom color like this
  },
  secondaryButton: {
    // backgroundColor: Colors.secondary,
    borderWidth: 0,
  },
  resumeText: {
    // color: Colors.lightText,
  },

  input: {
    marginBottom: 15,
  },
  title: {
    fontSize: Fonts.size.xlarge,
    fontWeight: 'bold',
    color: Colors.lightText,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: Fonts.size.medium,
    color: 'white',
    marginBottom: 30,
  },
  noAccountContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  noAccountText: {
    fontSize: Fonts.size.medium,
    color: Colors.lightText,
    marginBottom: 5,
  },
  registerButtonText: {
    fontSize: Fonts.size.medium,
    color: Colors.lightBlue,
    textDecorationLine: 'underline',
  },
});
