# Egypt Slots: Crowns of Kemet - Agent Rules & Workflow Invariants

## 1. Mandatory Cross-Platform Synchronization
Whenever changes are made to the game codebase (UI, math, audio, graphics, or configuration):
1. **Always Synchronize All 3 Target Platforms**:
   - **Android**: Sync assets to `android/app/src/main/assets/public/`
   - **Apple iPhone / iOS**: Sync assets to `ios/App/App/public/`
   - **Desktop (Electron)**: Built directly into `dist/index.html` and consumed by `electron/main.cjs`
2. **Automated via Postbuild**:
   - `npm run build` automatically triggers `"postbuild": "cap sync"`, which copies the updated bundle to both Android and iOS projects in a single step.
   - Always run `npm run build` after editing application files.

## 2. Platform-Specific Guidelines
- **Apple iPhone / iOS**:
  - Maintain `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` for Dynamic Island, notch, and home indicator bar.
  - Preserve Web Audio unlock on initial user gesture (Enter Casino button in `SplashScreen.jsx`).
  - Maintain touch target ergonomics and disable bounce scrolling via Capacitor config.
- **Android**:
  - Keep adaptive CSS media queries intact for Foldables (unfolded 4:3 / 1:1 and folded 21:9), Tablets, and Android Auto (16:9 / 8:3 center consoles).
  - Minimum 48dp (52px) touch targets for interactive controls.
- **Desktop (Electron)**:
  - Preserve 16:9 / 2000:1350 aspect ratio container bounds and spacebar spin trigger.

## 3. Quality & Regression Verification
- Run `npm run test:all` (all 218 unit & integration tests must pass) and `npm run test:bonuses` (all 185 bonus suite tests must pass).
- For Android native/hybrid changes, run `cd android && ./gradlew testDebugUnitTest jacocoTestReport` (see [`docs/testing.md`](docs/testing.md) for the complete testing strategy and commands).
- Verify clean build with zero bundling errors.
