import {NativeModules, Platform} from 'react-native';

const {SoundModule} = NativeModules;

class SoundUtils {
  private static initialized = false;

  static async initializeSounds(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      if (Platform.OS === 'android' && SoundModule) {
        this.initialized = true;
        console.log('Sound initialized successfully');
      } else {
        // Fallback for iOS or if native module not available
        this.initialized = true;
        console.log('Sound initialized (fallback mode)');
      }
    } catch (error) {
      console.error('Failed to initialize sound:', error);
      throw error;
    }
  }

  static async playDing(): Promise<void> {
    if (!this.initialized) {
      console.warn('Sound not initialized. Call initializeSounds() first.');
      return;
    }

    try {
      if (Platform.OS === 'android' && SoundModule) {
        // Try to play custom sound first, fallback to notification sound
        try {
          await SoundModule.playCustomSound();
          console.log('Successfully played custom ding sound');
        } catch (customError) {
          console.log(
            'Custom sound failed, trying notification sound:',
            customError,
          );
          await SoundModule.playNotificationSound();
          console.log('Successfully played notification sound');
        }
      } else {
        // Fallback for iOS or if native module not available
        console.log('Playing sound (fallback mode)');
      }
    } catch (error) {
      console.error('Failed to play sound:', error);
    }
  }

  static async releaseSounds(): Promise<void> {
    if (this.initialized && Platform.OS === 'android' && SoundModule) {
      try {
        SoundModule.release();
      } catch (error) {
        console.error('Error releasing sound:', error);
      }
    }
    this.initialized = false;
    console.log('Sound resources released');
  }

  // Test method to check if native module is available
  static isNativeModuleAvailable(): boolean {
    return Platform.OS === 'android' && SoundModule !== undefined;
  }
}

export default SoundUtils;
