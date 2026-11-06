# Egypt Slots: Pharaoh's Chakra Dynasty — Testing Strategy & Architecture (`/testing-setup`)

## 1. Current Testing Setup Analysis Report

| Dimension | Initial State (Before `/testing-setup`) | Upgraded State (After `/testing-setup`) |
| :--- | :--- | :--- |
| **Android Gradle Plugin (AGP)** | `8.13.0` (`compileSdk = 36`, `targetSdk = 36`, `minSdk = 24`) | `8.13.0` (`compileSdk = 36`, `targetSdk = 36`, `minSdk = 24`) |
| **UI Architecture** | Hybrid Capacitor 7 (`BridgeActivity` + Android CoordinatorLayout / WebView + React 19 UI) | Hybrid Capacitor 7 (`BridgeActivity` + `CasinoConfigRepository` DI seam + React 19 UI) |
| **Dependency Injection / Fakes** | None (`MainActivity` directly extended `BridgeActivity`) | Constructor/Setter-injectable [`CasinoConfigRepository`](../android/app/src/main/java/com/dcenterprises/egyptslots/CasinoConfigRepository.java) with [`DefaultCasinoConfigRepository`](../android/app/src/main/java/com/dcenterprises/egyptslots/DefaultCasinoConfigRepository.java) & [`FakeCasinoConfigRepository`](../android/app/src/test/java/com/dcenterprises/egyptslots/FakeCasinoConfigRepository.java) |
| **Local Unit Testing Framework** | JUnit 4 (`junit:junit:4.13.2`) + Node multi-aspect harnesses (`scripts/test-all-aspects.js`, `scripts/test-bonuses.js`) | JUnit 4 (`4.13.2`) + Mockito (`5.14.2`) + 218-test Node Core Suite + 185-test Bonus Suite |
| **Robolectric (Local JVM Android UI)** | Not installed | Installed (`org.robolectric:robolectric:4.14.1`, `androidx.test:core:1.6.1`, `includeAndroidResources = true`) |
| **Behavior UI Tests** | Espresso Core (`3.7.0`) with broken `com.getcapacitor.app` template test | Espresso (`3.7.0`), `androidx.test:runner:1.6.2`, `androidx.test:rules:1.6.1`, `ActivityScenario` recreation tests in [`CasinoInstrumentedTest`](../android/app/src/androidTest/java/com/dcenterprises/egyptslots/CasinoInstrumentedTest.java) |
| **Window Size Matrix & Font Scale Tests** | Manual CSS breakpoints only | Automated 9-Window Size Class Matrix (`400dp`, `610dp`, `900dp` widths × `400dp`, `500dp`, `1000dp` heights) + `1.5f` fontScale verification in [`CasinoUnitTest`](../android/app/src/test/java/com/dcenterprises/egyptslots/CasinoUnitTest.java) |
| **End-to-End (E2E) Tests** | None on Android | UI Automator (`androidx.test.uiautomator:uiautomator:2.3.0`) in [`CasinoInstrumentedTest`](../android/app/src/androidTest/java/com/dcenterprises/egyptslots/CasinoInstrumentedTest.java) |
| **Code Coverage** | Not configured on Android | **JaCoCo (`0.8.12`)** enabled (`enableUnitTestCoverage true`, `enableAndroidTestCoverage true`, custom `jacocoTestReport` task) |

> **Note on Compose Preview Screenshot Testing:** Because this project uses AGP `8.13.0` and a Hybrid Views/WebView (`BridgeActivity`) architecture rather than Jetpack Compose `@Preview` composables, window-size matrix verification (`400/610/900dp` × `400/500/1000dp` and `1.5f` font scale) is executed via Robolectric (`CasinoUnitTest`) and instrumented `ActivityScenario` / `UiDevice` (`CasinoInstrumentedTest`). Note that AGP `9.5.0-alpha03+` introduces built-in `testOptions { screenshotTests.create(...) }` test suites if you choose to upgrade AGP in the future.

---

## 2. Test Commands & Execution Guide

### A. Cross-Platform Game Engine, Math, Bonus, Adaptive & Ad Conversion Tests (Node.js)
Run these commands from the project root before every deployment:

```bash
# Run all 218 Core Multi-Aspect Unit & Integration Tests (Assets, Math, Paylines, Store, Audio, Auth, Ad Architect, Adaptive Android, On-Chain Crypto)
npm run test:all

# Run all 185 Hands-Free Bonus Suite Tests (Hold & Win, Heart Chakra Relic Vault, Crown Chakra Wheel, Ascension of Ra, Celestial Free Spins)
npm run test:bonuses
```

### B. Android Local Unit, Robolectric & JaCoCo Coverage Tests (Gradle)
Run from the `android/` directory:

```bash
# Run local JUnit4 + Robolectric tests (Window Size Matrix, DeepLinks, Fakes, Packaged Web Assets)
cd android && ./gradlew testDebugUnitTest

# Generate JaCoCo HTML & XML Code Coverage Report
cd android && ./gradlew jacocoTestReport
# Coverage HTML report output: android/app/build/reports/jacoco/jacocoTestReport/html/index.html
```

### C. Android Instrumented UI (Espresso) & End-to-End (UI Automator) Tests
Requires a connected Android device or running AVD emulator:

```bash
cd android && ./gradlew connectedDebugAndroidTest
```

---

## 3. Test File Architecture

- [`scripts/test-all-aspects.js`](../scripts/test-all-aspects.js): 218 assertions across 12 domains (Asset Integrity, 15 Paylines, Symbol Paytable, Smart Bet Adjuster, Free Spins, Bonus Vault, Sweepstakes Store, Sound Engine, Auth Service, Casino Ad Architect 4-Pillar Conversion Flows, Adaptive Android/Foldable Compliance, and Live On-Chain Crypto Verifier).
- [`scripts/test-bonuses.js`](../scripts/test-bonuses.js): 185 assertions verifying all 5 bonus rounds, 10,000-trial Monte Carlo EV/RTP bounds, and audio SFX mappings.
- [`android/app/src/main/java/com/dcenterprises/egyptslots/CasinoConfigRepository.java`](../android/app/src/main/java/com/dcenterprises/egyptslots/CasinoConfigRepository.java): Testable repository interface for window size classes (`COMPACT`, `MEDIUM`, `EXPANDED`), deep-link validation, and WebView asset checks.
- [`android/app/src/main/java/com/dcenterprises/egyptslots/DefaultCasinoConfigRepository.java`](../android/app/src/main/java/com/dcenterprises/egyptslots/DefaultCasinoConfigRepository.java): Production Android implementation.
- [`android/app/src/test/java/com/dcenterprises/egyptslots/FakeCasinoConfigRepository.java`](../android/app/src/test/java/com/dcenterprises/egyptslots/FakeCasinoConfigRepository.java): Deterministic in-memory fake for local unit & Robolectric tests.
- [`android/app/src/test/java/com/dcenterprises/egyptslots/CasinoUnitTest.java`](../android/app/src/test/java/com/dcenterprises/egyptslots/CasinoUnitTest.java): JUnit4 + Robolectric test suite testing the 9 window size classes (`400, 610, 900 dp` × `400, 500, 1000 dp`), `1.5f` font scale, deep-link security, fake asset states, and `cap sync` bundle presence.
- [`android/app/src/androidTest/java/com/dcenterprises/egyptslots/CasinoInstrumentedTest.java`](../android/app/src/androidTest/java/com/dcenterprises/egyptslots/CasinoInstrumentedTest.java): Instrumented `AndroidJUnit4` + `ActivityScenario` + `UiDevice` (UI Automator) test suite verifying adaptive orientation freedom, foldable configuration recreation, and E2E display bounds.
