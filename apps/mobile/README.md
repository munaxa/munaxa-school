# Munaxa Mobile (Flutter)

One Flutter codebase, three flavors (build entry points):

| Flavor | Entry point | Audience |
|--------|-------------|----------|
| Parent | `lib/main_parent.dart` | Parents |
| Student | `lib/main_student.dart` | Students |
| Teacher | `lib/main_teacher.dart` | Teachers |

## Stack
Flutter · Riverpod · GoRouter · Dio · Drift (offline) · Firebase (Auth/FCM) · Sentry · intl (AR/EN, RTL/LTR).

## Run

```bash
flutter pub get
flutter run -t lib/main_parent.dart   --dart-define=API_URL=http://localhost:4000/api/v1
flutter run -t lib/main_student.dart
flutter run -t lib/main_teacher.dart
```

## Test & analyze

```bash
flutter analyze
flutter test
```

## Notes
- Platform folders (`android/`, `ios/`) are generated locally with `flutter create .` (kept out of
  this foundation commit since the Flutter SDK is not provisioned in the scaffold environment).
- Offline-first attendance (write-ahead queue + background sync) is implemented in **Phase 7**.
- Firebase config files and `firebase_options.dart` are gitignored (secrets via env / CI).
