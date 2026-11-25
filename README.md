# Learning Hub

https://github.com/hegdenihal9740-stack/learning-hub-741f1a74 run this

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ea02177b-886a-482a-8774-09f67aae60dc).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Build an Android APK

The Android app packages the current web build with Capacitor. Install Android Studio with its Android SDK and JDK, then from the project root run:

```sh
npm run android:apk
```

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. To open the generated Android project in Android Studio, run `npm run android:sync` first, then `npm run android:open`. A release APK needs a signing key and release signing configuration.
