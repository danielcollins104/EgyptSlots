package com.dcenterprises.egyptslots;

import static org.junit.Assert.*;

import android.content.Context;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.ComponentName;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.UiDevice;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Instrumented UI, Adaptive Configuration, & End-to-End (UI Automator) Tests
 * for Egypt Slots: Pharaoh's Chakra Dynasty.
 */
@RunWith(AndroidJUnit4.class)
public class CasinoInstrumentedTest {

    @Test
    public void verifyAppPackageAndAdaptiveManifestFlags() throws PackageManager.NameNotFoundException {
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("com.dcenterprises.egyptslots", appContext.getPackageName());

        ComponentName componentName = new ComponentName(appContext, MainActivity.class);
        ActivityInfo activityInfo = appContext.getPackageManager().getActivityInfo(componentName, 0);
        assertEquals(
            "MainActivity must not lock screenOrientation",
            ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED,
            activityInfo.screenOrientation
        );
    }

    @Test
    public void verifyMainActivityLaunchesAndSurvivesRecreation() {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(activity -> {
                assertNotNull(activity);
                assertNotNull(activity.getConfigRepository());
                assertTrue(activity.getConfigRepository().hasWebBundleAsset("public/index.html"));
            });
            // Simulate foldable posture / orientation configuration recreation
            scenario.recreate();
            scenario.onActivity(activity -> {
                assertNotNull(activity);
                assertEquals("https://oopsiwon.com", activity.getConfigRepository().getProductionOrigin());
            });
        }
    }

    @Test
    public void verifyEndToEndDeviceWindowPresence() {
        UiDevice device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation());
        assertNotNull(device);
        assertTrue(device.getDisplayWidth() > 0);
        assertTrue(device.getDisplayHeight() > 0);
    }
}
