# Rei Macros

A personal macro tracker for Android. Snap a photo of a meal (or describe it), Gemini estimates the macros, you adjust the portions and log it. Everything is stored on the phone in SQLite.

This is a plain native Android project (Expo SDK 57 / React Native 0.86) — you build it yourself and install it over a USB cable. There is no Expo Go and no cloud build.

## Requirements

- **Node.js** and `npm install`.
- **JDK 17 or 21** as `JAVA_HOME`.
- **Android SDK**, with `ANDROID_HOME` set (Android Studio installs it to `%LOCALAPPDATA%\Android\Sdk`).
- **CMake 3.31.6** from the SDK Manager, and Windows long paths enabled. React Native's native build creates file paths over 260 characters, which the SDK's default CMake 3.22.1 can't handle. Point Gradle at the newer one in `android/local.properties` (git-ignored, per machine):
  ```
  cmake.dir=C\:/Users/<you>/AppData/Local/Android/Sdk/cmake/3.31.6
  ```
- A Gemini API key: copy `.env.example` to `.env` and fill in `EXPO_PUBLIC_GEMINI_API_KEY` (free at https://aistudio.google.com/apikey).

Don't build from Android Studio and the terminal at the same time — they fight over the same native build folders.

## Day-to-day

```
adb devices          # should list your phone as "device", not "unauthorized"
npm run android      # Gradle build → installs via adb → starts Metro
```

Run `npm run android` again only when native dependencies or anything under `android/` changes. For JavaScript changes, just keep Metro running:

```
npm start            # Metro on localhost, reached over the cable via adb reverse
```

If the app can't reach Metro, run `adb reverse tcp:8081 tcp:8081`. Use `npm run start:lan` to connect over Wi-Fi instead.

After editing `.env`, restart Metro and reload the app (press `r`).

## Release APK

```
npm run apk
# → android/app/build/outputs/apk/release/app-release.apk
```

Install it with `adb install -r <path>`, or use `npm run android:release`. The API key is baked in at build time, so rebuild after changing `.env`.

## The android/ folder

`android/` is committed and is edited by hand. **Do not run `expo prebuild`**; it regenerates the folder from `app.json` and wipes those edits.

| What | Where |
|---|---|
| App name | `android/app/src/main/res/values/strings.xml` |
| Package / version | `android/app/build.gradle` |
| Permissions | `android/app/src/main/AndroidManifest.xml` |
| Gradle memory / workers | `android/gradle.properties` (`org.gradle.workers.max=6` keeps builds from running this PC out of memory) |

## Switching to Claude

Set `EXPO_PUBLIC_AI_PROVIDER=claude` and `EXPO_PUBLIC_ANTHROPIC_API_KEY` in `.env` (see `.env.example`). Claude's API is pay-as-you-go.

## Project layout

- `App.tsx` — root: fonts, database, navigator
- `src/navigation.tsx` — small stack navigator (no Expo Router)
- `src/screens/` — Today / History tabs, camera, analyze & review, settings
- `src/components/` — shared UI
- `src/lib/ai/` — the AI call: `shared.ts` (prompt and response schema), `gemini.ts`, `claude.ts`, `index.ts` (picks one)
- `src/lib/db.ts` — SQLite schema, migrations and queries
- `src/lib/photos.ts` — photo resizing and storage
- `metro.config.js` — loads the Anthropic SDK's CommonJS build (its ES-module build crashes Metro)
