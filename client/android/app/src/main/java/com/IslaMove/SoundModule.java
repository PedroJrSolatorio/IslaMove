package com.IslaMove;

import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.content.Context;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

public class SoundModule extends ReactContextBaseJavaModule {
    private MediaPlayer mediaPlayer;
    private ReactApplicationContext reactContext;

    public SoundModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "SoundModule";
    }

    @ReactMethod
    public void playNotificationSound(Promise promise) {
        try {
            if (mediaPlayer != null) {
                mediaPlayer.release();
            }
            
            Uri notification = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            mediaPlayer = MediaPlayer.create(reactContext, notification);
            
            if (mediaPlayer != null) {
                mediaPlayer.start();
                promise.resolve("Sound played successfully");
            } else {
                promise.reject("SOUND_ERROR", "Could not create media player");
            }
        } catch (Exception e) {
            promise.reject("SOUND_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void playCustomSound(Promise promise) {
        try {
            if (mediaPlayer != null) {
                mediaPlayer.release();
            }
            
            int soundId = reactContext.getResources()
                .getIdentifier("ding", "raw", reactContext.getPackageName());
            
            if (soundId != 0) {
                mediaPlayer = MediaPlayer.create(reactContext, soundId);
                if (mediaPlayer != null) {
                    mediaPlayer.start();
                    promise.resolve("Custom sound played successfully");
                } else {
                    promise.reject("SOUND_ERROR", "Could not create media player for custom sound");
                }
            } else {
                promise.reject("SOUND_ERROR", "Sound file not found in raw resources");
            }
        } catch (Exception e) {
            promise.reject("SOUND_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void release() {
        if (mediaPlayer != null) {
            mediaPlayer.release();
            mediaPlayer = null;
        }
    }
}