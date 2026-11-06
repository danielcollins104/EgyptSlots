package com.dcenterprises.egyptslots;

import android.content.Context;
import android.content.res.AssetManager;
import java.io.IOException;
import java.io.InputStream;

/**
 * Default production implementation of {@link CasinoConfigRepository}.
 */
public class DefaultCasinoConfigRepository implements CasinoConfigRepository {
    private static final String PRODUCTION_ORIGIN = "https://oopsiwon.com";
    private final Context context;

    public DefaultCasinoConfigRepository(Context context) {
        this.context = context != null ? context.getApplicationContext() : null;
    }

    @Override
    public boolean hasWebBundleAsset(String relativeAssetPath) {
        if (context == null || relativeAssetPath == null || relativeAssetPath.isEmpty()) {
            return false;
        }
        AssetManager assetManager = context.getAssets();
        try (InputStream stream = assetManager.open(relativeAssetPath)) {
            return stream != null;
        } catch (IOException e) {
            return false;
        }
    }

    @Override
    public WindowWidthClass classifyWidthDp(int widthDp) {
        if (widthDp < 600) {
            return WindowWidthClass.COMPACT;
        } else if (widthDp < 840) {
            return WindowWidthClass.MEDIUM;
        } else {
            return WindowWidthClass.EXPANDED;
        }
    }

    @Override
    public WindowHeightClass classifyHeightDp(int heightDp) {
        if (heightDp < 480) {
            return WindowHeightClass.COMPACT;
        } else if (heightDp < 900) {
            return WindowHeightClass.MEDIUM;
        } else {
            return WindowHeightClass.EXPANDED;
        }
    }

    @Override
    public boolean isSupportedDeepLink(String url) {
        if (url == null || url.trim().isEmpty()) {
            return false;
        }
        String normalized = url.trim().toLowerCase();
        return normalized.startsWith("https://oopsiwon.com")
                || normalized.startsWith("https://www.oopsiwon.com")
                || normalized.startsWith("egyptslots://");
    }

    @Override
    public String getProductionOrigin() {
        return PRODUCTION_ORIGIN;
    }
}
