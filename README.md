# Mewtwo Planner — Expo (iOS + Android + Web)
Quick start:
1) `npm i`
2) `npx expo start`

Cloud persistence (optional):
- Copy `.env.example` to `.env` and fill Supabase URL & anon key.
- Run the SQL schema shown in the canvas message inside Supabase SQL editor.

Build signed binaries:
- `npx eas build:configure`
- iOS TestFlight: `npx eas build -p ios --profile preview`
- Android APK:   `npx eas build -p android --profile apk`
