import {DefaultTheme} from 'react-native-paper';
import {Colors} from './Colors';

const customTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.primary,
    underlineColor: Colors.primary,
    text: Colors.primary,
  },
};

export default customTheme;
