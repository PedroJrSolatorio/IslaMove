import {GOOGLE_WEB_CLIENT_ID} from '@env';

export const GOOGLE_CONFIG = {
  webClientId: GOOGLE_WEB_CLIENT_ID,
  scopes: ['openid', 'email', 'profile'],
  offlineAccess: true,
  hostedDomain: '', // Optional: specify domain if needed
  forceCodeForRefreshToken: true,
};

// Alternative: Use different configs for dev/prod
export const GOOGLE_CONFIG_DEV = {
  webClientId: GOOGLE_WEB_CLIENT_ID,
  scopes: ['openid', 'email', 'profile'],
  offlineAccess: true,
  forceCodeForRefreshToken: true,
};

export const GOOGLE_CONFIG_PROD = {
  webClientId: '123456789-prod-client-id.apps.googleusercontent.com', //test only
  scopes: ['openid', 'email', 'profile'],
  offlineAccess: true,
  forceCodeForRefreshToken: true,
};

// Use based on environment
export const getGoogleConfig = () => {
  return __DEV__ ? GOOGLE_CONFIG_DEV : GOOGLE_CONFIG_PROD;
};
