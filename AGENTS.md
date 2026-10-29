# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.
For anything else, https://docs.expo.dev/llms.txt indexes all Expo docs. Never answer from memory.

# The Android project is committed, not generated

`android/` is a hand-maintained native project. **Never run `expo prebuild`** —
it regenerates the folder from `app.json` and destroys hand edits.

`app.json` therefore does not drive the native build any more. Native changes
(app name, package, permissions, icons, Gradle config) go directly into the
files under `android/`.

The app is built and installed over a USB cable: `npm run android` for a debug
build, `npm run apk` for a release APK. There is no EAS/cloud build and no
Expo Go — the `expo-*` packages are ordinary autolinked native dependencies.
Adding a package with native code means rebuilding with `npm run android`.

# Navigation

There is no Expo Router. `App.tsx` renders a small stack navigator from
`src/navigation.tsx` (`useNav`, `useRoute`, `useFocusEffect`); screens live in
`src/screens/`. Add a screen by adding a `Route` variant and a case in `App.tsx`.
Avoid libraries that pull in react-native-reanimated / worklets.

# Commands

```bash
npx expo install <package>  # ALWAYS use instead of npm add — resolves SDK-compatible versions
npm start                   # Metro on localhost (reached over USB via adb reverse)
npm run android             # Gradle debug build → install → Metro
npm run lint                # lint
npm run typecheck           # typecheck
```

Run lint and typecheck before declaring any task done.
