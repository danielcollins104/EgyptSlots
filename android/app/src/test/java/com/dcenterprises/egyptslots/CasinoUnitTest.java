package com.dcenterprises.egyptslots;

import static org.junit.Assert.*;

import android.content.Context;
import android.content.res.Configuration;
import androidx.test.core.app.ApplicationProvider;
import com.dcenterprises.egyptslots.CasinoConfigRepository.WindowHeightClass;
import com.dcenterprises.egyptslots.CasinoConfigRepository.WindowWidthClass;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

/**
 * Comprehensive Local Unit & Robolectric Behavior Test Suite for Egypt Slots: Pharaoh's Chakra Dynasty.
 * Covers:
 * - Step 4 & 5: Business logic unit tests with FakeCasinoConfigRepository & DefaultCasinoConfigRepository
 * - Step 8 & 11: 9-size Window Size Class Matrix (400, 610, 900 dp widths × 400, 500, 1000 dp heights) + 1.5f fontScale
 * - Step 10: Deep-link & Navigation URI validation
 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34)
public class CasinoUnitTest {
    private FakeCasinoConfigRepository fakeRepo;
    private DefaultCasinoConfigRepository defaultRepo;
    private Context context;

    @Before
    public void setUp() {
        context = ApplicationProvider.getApplicationContext();
        fakeRepo = new FakeCasinoConfigRepository();
        defaultRepo = new DefaultCasinoConfigRepository(context);
    }

    @Test
    public void verifyApplicationPackageIdentity() {
        assertEquals("com.dcenterprises.egyptslots", context.getPackageName());
    }

    @Test
    public void verifyNineWindowSizeMatrixClassification() {
        int[] widths = new int[] {400, 610, 900};
        int[] heights = new int[] {400, 500, 1000};

        WindowWidthClass[] expectedWidths = new WindowWidthClass[] {
            WindowWidthClass.COMPACT,
            WindowWidthClass.MEDIUM,
            WindowWidthClass.EXPANDED
        };
        WindowHeightClass[] expectedHeights = new WindowHeightClass[] {
            WindowHeightClass.COMPACT,
            WindowHeightClass.MEDIUM,
            WindowHeightClass.EXPANDED
        };

        for (int w = 0; w < widths.length; w++) {
            for (int h = 0; h < heights.length; h++) {
                assertEquals(
                    "Width " + widths[w] + "dp classification",
                    expectedWidths[w],
                    defaultRepo.classifyWidthDp(widths[w])
                );
                assertEquals(
                    "Height " + heights[h] + "dp classification",
                    expectedHeights[h],
                    defaultRepo.classifyHeightDp(heights[h])
                );
            }
        }
    }

    @Test
    public void verifyLargeFontScaleSimulation() {
        Configuration config = new Configuration(context.getResources().getConfiguration());
        config.fontScale = 1.5f;
        Context scaledContext = context.createConfigurationContext(config);
        assertEquals(1.5f, scaledContext.getResources().getConfiguration().fontScale, 0.01f);
    }

    @Test
    public void verifyDeepLinkNavigationRouting() {
        assertTrue(defaultRepo.isSupportedDeepLink("https://oopsiwon.com"));
        assertTrue(defaultRepo.isSupportedDeepLink("https://www.oopsiwon.com/?promo=vip50"));
        assertTrue(defaultRepo.isSupportedDeepLink("egyptslots://store/vip"));
        assertFalse(defaultRepo.isSupportedDeepLink("https://malicious-phishing-site.example.com"));
        assertFalse(defaultRepo.isSupportedDeepLink("javascript:alert(1)"));
        assertFalse(defaultRepo.isSupportedDeepLink(""));
        assertFalse(defaultRepo.isSupportedDeepLink(null));
    }

    @Test
    public void verifyFakeRepositoryAssetSimulation() {
        assertTrue(fakeRepo.hasWebBundleAsset("public/index.html"));
        assertTrue(fakeRepo.hasWebBundleAsset("public/assets/characters/anubis.png"));
        fakeRepo.clearFakeAssets();
        assertFalse(fakeRepo.hasWebBundleAsset("public/index.html"));
    }

    @Test
    public void verifyPackagedWebAssetsPresentInAndroidBundle() {
        assertTrue(
            "public/index.html must be synced via cap sync",
            defaultRepo.hasWebBundleAsset("public/index.html")
        );
        assertTrue(
            "capacitor.config.json must be present in Android assets",
            defaultRepo.hasWebBundleAsset("capacitor.config.json")
        );
    }
}
