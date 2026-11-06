package com.dcenterprises.egyptslots;

/**
 * Repository interface for Casino configuration, window size classification,
 * deep-link validation, and WebView bundle verification.
 * Enables deterministic Fakes in local unit tests and Robolectric/Espresso UI tests.
 */
public interface CasinoConfigRepository {
    enum WindowWidthClass {
        COMPACT,
        MEDIUM,
        EXPANDED
    }

    enum WindowHeightClass {
        COMPACT,
        MEDIUM,
        EXPANDED
    }

    boolean hasWebBundleAsset(String relativeAssetPath);

    WindowWidthClass classifyWidthDp(int widthDp);

    WindowHeightClass classifyHeightDp(int heightDp);

    boolean isSupportedDeepLink(String url);

    String getProductionOrigin();
}
