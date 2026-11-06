package com.dcenterprises.egyptslots;

import java.util.HashSet;
import java.util.Set;

/**
 * In-memory Fake implementation of {@link CasinoConfigRepository} for unit and UI tests.
 * Allows simulating missing assets, custom origins, or offline states without hitting disk/network.
 */
public class FakeCasinoConfigRepository implements CasinoConfigRepository {
    private final Set<String> availableAssets = new HashSet<>();
    private String productionOrigin = "https://oopsiwon.com";

    public FakeCasinoConfigRepository() {
        availableAssets.add("public/index.html");
        availableAssets.add("capacitor.config.json");
        availableAssets.add("public/assets/background/background.webp");
        availableAssets.add("public/assets/characters/anubis.png");
    }

    public void addFakeAsset(String path) {
        availableAssets.add(path);
    }

    public void clearFakeAssets() {
        availableAssets.clear();
    }

    public void setProductionOrigin(String origin) {
        this.productionOrigin = origin;
    }

    @Override
    public boolean hasWebBundleAsset(String relativeAssetPath) {
        return availableAssets.contains(relativeAssetPath);
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
        return productionOrigin;
    }
}
