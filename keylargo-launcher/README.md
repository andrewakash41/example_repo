# Cockpit Launcher

A light, fully offline home screen for Android car head units, written for the
Blaupunkt Key Largo 980 (9 inch, Android 9/10, quad-core, 2 GB RAM). It should run on
any Android 8.0+ head unit.

> Status: the code compiles in CI but has **not yet been run on a real Key Largo 980**.
> Expect a round of tuning after your first install. See "What to report back".

## What you get

| Area | What it does |
| --- | --- |
| Speed | Large arc speedometer from GPS, compass heading, trip distance, max speed, optional over-speed colour warning. Tap for GPS status, long-press to reset the trip. |
| Music | Album art, title, artist and previous / play / next for whatever is playing (Spotify, YouTube Music, VLC, most players). Tap the card to open the player. |
| Clock | Large clock and date. Follows the unit's 12/24-hour setting. Tap to set the time. |
| Dock | Android Auto tile, Navigate tile, up to 5 of your own apps, All apps, Settings. Long-press a tile to change or remove it. |
| App drawer | Searchable grid of every app. Long-press for Add to dock / App info / Uninstall. |
| GPS status and repair | Satellites in use, signal strength, accuracy, and buttons to refresh the GPS chip's assistance data. |
| System screens | One-tap shortcuts to Android screens the stock menu hides (Developer options, Install unknown apps, full Settings, and more). |
| Hidden screens browser | Lists every installed package and lets you open any of its screens, which is how you reach factory / car-settings menus. |
| Customisation | Accent colour (6), km/h or mph, speed warning threshold, which apps the Android Auto and Navigate tiles open, dock contents. |

## Privacy and safety

- **No internet permission.** The manifest does not request `android.permission.INTERNET`,
  so Android itself blocks the app from opening any network connection. You can verify
  this in Settings > Apps > Cockpit Launcher > Permissions.
- No analytics, ads, accounts, crash reporting or third-party libraries. The only code in
  the APK is this repository plus the Kotlin standard library.
- No log output. Location is used in memory to draw speed and trip; only the trip distance
  number is saved. Backups of app data are disabled.
- "Notification access" is needed because that is the only way Android tells an app what
  is playing. The listener class is empty and never reads notifications
  (`MediaListener.kt`).
- The Hidden screens browser only opens screens that Android already lets any app open.
  It does not bypass passwords or permissions.
- The launcher never reads data sent to it by other apps, and its only component other
  apps can reach is the home screen itself.
- Every CI build fails if the APK requests any permission outside the list below, and
  prints the APK's SHA-256 in the run summary so you can check your download
  (`sha256sum app-release.apk`, or `certutil -hashfile app-release.apk SHA256` on
  Windows). The build actions are pinned to exact commits.

Permissions used: precise location (speed), location extra commands (GPS refresh), query
all packages (it is a launcher), request delete packages (Uninstall menu item).

## 1. Get the APK

You do not need Android Studio.

1. Open the repository on GitHub, go to **Actions > Build Cockpit Launcher APK**.
2. Open the latest green run for this branch and download the **cockpit-launcher-apk**
   artifact (a zip). Unzip it to get `app-release.apk`.
3. Copy the APK to a USB stick formatted FAT32.

To build yourself instead: install JDK 17 and the Android SDK, then run
`./gradlew assembleRelease` inside `keylargo-launcher/`.

Note on updates: CI signs each build with a throwaway key, so to install a newer build
you must uninstall the old one first (your settings reset). To avoid that, create your own
keystore and build with the `COCKPIT_KEYSTORE`, `COCKPIT_KEYSTORE_PASSWORD`,
`COCKPIT_KEY_ALIAS` and `COCKPIT_KEY_PASSWORD` environment variables set.

## 2. Install on the Key Largo 980

1. Plug the USB stick into either rear USB port.
2. Open the unit's **File Manager** (or "ES File Explorer" / "APK Installer", whichever it
   ships with), browse to the USB stick and tap `app-release.apk`.
3. If Android says the source is not allowed, tap **Settings** in that prompt and enable
   **Allow from this source**, then go back and tap Install.
4. Press the physical or on-screen **Home** button. Android asks which launcher to use:
   choose **Cockpit Launcher** and **Always**.
5. Allow the location prompt (needed for speed).
6. Tap the music card and switch on **Cockpit Launcher music controls** in the
   notification-access list.

To go back to the stock screen at any time: Settings (in the dock) > Make this the home
screen > pick the original launcher. Nothing in the stock system is modified or removed.

### If something is blocked

| Problem | Fix |
| --- | --- |
| No file manager, or APK installs are refused | Enable Developer options (Settings > About > tap Build number 7 times), turn on USB debugging, connect a laptop (Wi-Fi ADB or a USB A-to-A cable) and run `adb install app-release.apk`. |
| The Home button never offers a choice | Dock > Settings > Make this the home screen. If that screen is missing: `adb shell cmd package set-home-activity dev.cockpit.launcher/.HomeActivity`. |
| No notification-access screen | `adb shell cmd notification allow_listener dev.cockpit.launcher/dev.cockpit.launcher.MediaListener` |
| Stock launcher keeps coming back after reboot | Some firmwares hard-code their launcher. Tell me the firmware/MCU version from Settings > About and I will add a boot hand-over. |

## 3. Reaching locked settings

Try these in order; stop at the first that works.

1. **Dock > Settings > System screens.** These jump straight to standard Android pages
   that the Blaupunkt menu leaves out.
2. **Hidden screens browser.** Type `factory`, `car`, `setting`, `radio` or `test` in the
   filter, open the matching package and tap its screens. Write down which ones are
   useful.
3. **Factory-settings password.** Units of this family ask for a code under
   Settings > Factory / Car settings. Codes commonly used by the manufacturers of these
   boards: `8888`, `1234`, `0000`, `3368`, `126`, `1617`, `7890`, `123456`, `168`,
   `5678`. If none work, Blaupunkt India support can give the code for your serial number.

Be careful inside factory settings: changing the **CAN bus / car model, screen
resolution, or touch calibration** entries can leave the unit unusable until it is
reflashed. Photograph every page before you change anything. Options that are safe to
explore: boot logo, steering-wheel key learning, radio region, reverse-camera options,
button light colour, default volume.

## 4. Android Auto

The Key Largo 980 is not a Google-certified Android Auto unit, so the launcher's
**Android Auto** tile opens a receiver app. The recommended one is the open-source
**Headunit Revived** (also published as "Open Headunit"):
<https://github.com/andreknieriem/headunit-revived>

On the phone you get the real Android Auto interface (Maps, calls, messages, music,
Assistant) because the phone renders it; the app on the head unit only displays it.

Setup:

1. On a computer, open the project's **Releases** page and download the latest APK. Only
   use GitHub Releases or Google Play, never an APK mirror site.
2. Install it on the head unit from USB, the same way as the launcher.
3. On the phone: make sure Android Auto is installed and up to date.
4. **Wired (most reliable):** connect the phone to a rear USB port with a good data
   cable, open the Android Auto tile, and accept the USB prompt on both devices.
5. **Wireless:** follow the project's Wireless wiki page. Since Android Auto 17.4 the
   phone must run the project's Wireless Helper / Headunit Server; older "self mode"
   instructions no longer work. Phone and head unit must be on the same Wi-Fi (the
   phone's hotspot is the usual choice).

Honest limits: it is a community project that reimplements Google's protocol, so a phone
update can break it until the author patches it; wireless on a 2 GB quad-core unit may
stutter, in which case use the cable. I have not audited its source line by line. If it
turns out unstable on your unit, long-press the tile and point it at the built-in
PhoneLINK instead, and tell me what failed.

## 5. GPS that drifts or keeps rerouting

Rerouting means Maps is receiving a poor position. Check the cause before changing apps.

1. Park outdoors with open sky, open **Settings > GPS status and repair**, wait 2 minutes.
2. Read the verdict:
   - **Fewer than 5 satellites or signal under about 22 dB-Hz:** a hardware problem. The
     GPS antenna (small black square on a wire, blue Fakra or SMA plug on the back of the
     unit) is loose, damaged, or tucked behind metal. Reseat the plug and move the
     antenna to the top of the dashboard near the windscreen, flat, label side up, away
     from the unit and from any dash-cam. This is the fix in the large majority of cases.
     A replacement active GPS antenna is inexpensive.
   - **Good satellite count but accuracy worse than 15 m:** tap **Full GPS reset**, leave
     the car outdoors for 5 to 10 minutes, then retest. Also check the next items.
3. Settings > System screens > **Location**: mode must be **High accuracy**, and Google
   Location Accuracy on.
4. Settings > System screens > **Date and time**: enable automatic time and set the
   correct time zone. A wrong clock makes the first fix slow and unstable.
5. Give Google Maps location permission "Allow all the time", and exclude it from any
   battery optimisation / background cleaner in the unit's settings.
6. Metallic (infrared-blocking) window tint and windscreen-mounted electronics weaken
   GPS; keep the antenna clear of them.

When you use Android Auto, navigation uses the **phone's** GPS instead, which sidesteps
the head unit's receiver entirely.

## 6. YouTube "do not watch while driving" warning

This project contains no bypass for it, and the launcher could not provide one anyway.
The popup is drawn by the unit's own firmware when its parking-brake input says the car
is moving. An ordinary app is not allowed to remove another component's overlay; doing so
would need root or a patched system image, which is exactly the kind of bypass this
launcher promises not to contain, and it would put the unit at risk of not booting.

Where the behaviour is actually controlled:

- **The unit's own setting.** Firmware of this family has a brake-detection /
  "video while driving" option in the stock or factory settings (section 3 shows how to
  reach those menus). That is the manufacturer's switch for this popup.
- **The parking-brake wire** on the unit's harness. If video is blocked even when
  parked, that wire is not connected correctly, which an installer can correct.

Video on a screen in the driver's view while the car is moving is unsafe and is an
offence in most places, including under India's Motor Vehicles rules. For audio while
driving, YouTube Music works and the home-screen music card controls it.

## What to report back

After the first install, tell me:

1. Does the home screen fit the display, and is anything cut off or too small?
2. Does the speed read correctly against the car's speedometer?
3. Which sources show in the music card? The stock Radio and Bluetooth-music apps on
   these units often do not publish playback information; if so I can add support once I
   know their package names (Hidden screens browser shows them).
4. Android version and firmware/MCU version from Settings > About.
5. Which hidden screens were useful, and which stock functions are still missing.

## Project layout

```
keylargo-launcher/
  app/src/main/AndroidManifest.xml        permissions (no INTERNET) and activities
  app/src/main/java/dev/cockpit/launcher/
    HomeActivity.kt      home screen: speed, clock, music, dock
    SpeedDialView.kt     the gauge
    SpeedTracker.kt      GPS speed, trip, satellite status
    MusicHub.kt          media-session playback info and controls
    MediaListener.kt     empty notification listener (holds the access grant)
    DrawerActivity.kt    all apps
    SettingsActivity.kt  customisation and system shortcuts
    GpsActivity.kt       GPS status and repair
    ScreensActivity.kt   hidden screens browser
    Apps.kt, Prefs.kt    helpers and stored settings
.github/workflows/build-launcher.yml      builds the APK on every push
```
