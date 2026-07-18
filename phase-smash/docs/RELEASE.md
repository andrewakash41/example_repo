# Release guide (P7)

Everything needed to ship a signed AAB to Google Play. Steps marked **[Andrew]**
are the manual, account/keystore tasks only you can do (§12); the rest is
prepared in this repo.

## 1. One-time setup

- Install Godot **4.3** and, in the editor, install the **Android build
  template** and set the Android SDK path (Editor Settings → Export → Android).
- Copy `docs/export_presets.cfg.example` → project root `export_presets.cfg`,
  open Project → Export, confirm the Android preset validates.
- Add the **poing-studios AdMob** plugin to the Android build and wire the
  `_plugin_*` hooks in `autoload/AdManager.gd` (currently inert; `_has_plugin()`
  returns false). Put your real AdMob App ID + unit IDs into
  `data/ad_config.tres` and set `use_test_ids=false`. **[Andrew provides IDs]**

## 2. Keystore  **[Andrew]**

Generate the upload keystore once and store the passwords in your password
manager — **loss is unrecoverable** (§12 #4):

```sh
keytool -genkey -v \
  -keystore phase-smash-upload.keystore \
  -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

Point the release preset's keystore fields at this file (path + alias in the
editor; passwords via the editor or the `GODOT_ANDROID_KEYSTORE_RELEASE_*`
environment variables). Never commit the keystore or passwords.

## 3. Versioning

- `version/name` (marketing) = `config/version` in `project.godot` (currently
  `0.6.0`).
- `version/code` (integer) **must increase on every upload**. Convention: bump
  it by 1 per Play upload. Keep name and code in step at each release.

## 4. Build the AAB

```sh
# Headless CLI export (§2). Output: builds/phase-smash.aab
godot --headless --export-release "Android AAB (release)" builds/phase-smash.aab
```

Verify it installs and runs from a **release** build on a physical device
(§ P7 accept). Also run the checks in `docs/store/screenshots.md` to capture
store media.

## 5. Pre-flight checks

```sh
godot --headless -s tools/run_tests.gd   # generator + save + crate + ad caps
godot --headless -s tools/soak.gd        # 50-level stability soak
```

## 6. Play Console  **[Andrew]**

Upload to internal testing first, then fill the store listing and forms from the
prepared sheets:

- Listing copy → `docs/store/listing.md`
- Data Safety answers → `docs/store/data_safety.md`
- Content rating answers → `docs/store/content_rating.md`
- Privacy policy → host `docs/store/privacy_policy.html` (GitHub Pages is fine)
  and paste its URL
- Graphics → `assets/store/icon_512.svg` (export 512×512 PNG),
  `assets/store/feature_graphic.svg` (export 1024×500 PNG), screenshots per
  `docs/store/screenshots.md`

New personal developer accounts must run a **closed test with the minimum
tester count for the required duration** before production — start recruiting
testers early (§12 #1).
