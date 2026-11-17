package dev.cockpit.launcher

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.provider.Settings
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class SettingsActivity : Activity() {
    private lateinit var list: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Prefs.init(this)
        list = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(12), dp(20), dp(24))
        }
        setContentView(ScrollView(this).apply {
            fitsSystemWindows = true
            addView(list)
        })
    }

    override fun onResume() {
        super.onResume()
        build()
    }

    private fun build() {
        list.removeAllViews()

        header("Launcher")
        row("Make this the home screen", "Choose Cockpit Launcher as the default Home app") {
            if (!Apps.start(this, Intent(Settings.ACTION_HOME_SETTINGS))) {
                Apps.toast(this, "Press the unit's Home button and pick Cockpit Launcher > Always")
            }
        }
        row("Accent colour", Prefs.ACCENT_NAMES[Prefs.accentIndex]) {
            AlertDialog.Builder(this).setTitle("Accent colour")
                .setSingleChoiceItems(Prefs.ACCENT_NAMES, Prefs.accentIndex) { d, i ->
                    Prefs.accentIndex = i; d.dismiss(); build()
                }.show()
        }
        row("Android Auto tile", appName(Prefs.autoPkg) ?: "Automatic (Headunit Revived when installed)") {
            Apps.pick(this, "App for the Android Auto tile") { Prefs.autoPkg = it; build() }
        }
        row("Navigate tile", appName(Prefs.navPkg) ?: "Google Maps") {
            Apps.pick(this, "App for the Navigate tile") { Prefs.navPkg = it; build() }
        }
        row("Music controls", "Grant notification access so the home screen can show what is playing") {
            if (!Apps.start(this, Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))) {
                Apps.toast(this, "This unit hides that screen. See README: grant it over ADB.")
            }
        }

        header("Speed")
        row("Speed unit", if (Prefs.mph) "mph" else "km/h") {
            Prefs.mph = !Prefs.mph; build()
        }
        row("Speed warning", if (Prefs.warnAt == 0) "Off" else "Dial turns red above ${Prefs.warnAt} ${SpeedTracker.unit}") {
            val labels = Prefs.WARN_STEPS.map { if (it == 0) "Off" else "$it ${SpeedTracker.unit}" }.toTypedArray()
            AlertDialog.Builder(this).setTitle("Speed warning")
                .setSingleChoiceItems(labels, Prefs.WARN_STEPS.indexOf(Prefs.warnAt)) { d, i ->
                    Prefs.warnAt = Prefs.WARN_STEPS[i]; d.dismiss(); build()
                }.show()
        }
        row("Reset trip", "Clears trip distance and max speed") {
            SpeedTracker.resetTrip(); Apps.toast(this, "Trip reset")
        }
        row("GPS status and repair", "Satellites, accuracy, and refreshing GPS assistance data") {
            startActivity(Intent(this, GpsActivity::class.java))
        }

        header("System screens")
        note("Shortcuts to Android settings that the stock Blaupunkt menu hides. A screen that this unit's firmware has removed will simply say so.")
        sys("Developer options", Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS)
        sys("About device (tap Build number 7 times)", Settings.ACTION_DEVICE_INFO_SETTINGS)
        sys("Install unknown apps", Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
        sys("All apps", Settings.ACTION_MANAGE_ALL_APPLICATIONS_SETTINGS)
        sys("Location", Settings.ACTION_LOCATION_SOURCE_SETTINGS)
        sys("Wi-Fi", Settings.ACTION_WIFI_SETTINGS)
        sys("Bluetooth", Settings.ACTION_BLUETOOTH_SETTINGS)
        sys("Display", Settings.ACTION_DISPLAY_SETTINGS)
        sys("Sound", Settings.ACTION_SOUND_SETTINGS)
        sys("Date and time", Settings.ACTION_DATE_SETTINGS)
        sys("Storage", Settings.ACTION_INTERNAL_STORAGE_SETTINGS)
        sys("Full Android settings", Settings.ACTION_SETTINGS)
        row("Hidden screens browser", "Open any screen of any installed app, including factory and car-settings menus") {
            startActivity(Intent(this, ScreensActivity::class.java))
        }

        header("Privacy")
        note(
            "This launcher has no internet permission, so Android blocks it from sending anything. " +
                "It contains no analytics, ads, accounts or third-party code. Location is used only to " +
                "draw speed and trip on this screen and is never stored. Version 1.0.0."
        )
    }

    private fun appName(pkg: String?): String? = try {
        if (pkg == null) null else packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString()
    } catch (e: Exception) {
        null
    }

    private fun sys(title: String, action: String) = row(title, null) {
        if (!Apps.start(this, Intent(action))) Apps.toast(this, "This unit's firmware does not include that screen")
    }

    private fun header(text: String) {
        list.addView(TextView(this).apply {
            this.text = text.uppercase()
            textSize = 13f
            letterSpacing = 0.12f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Prefs.accent)
            setPadding(dp(6), dp(22), 0, dp(8))
        })
    }

    private fun note(text: String) {
        list.addView(TextView(this).apply {
            this.text = text
            textSize = 15f
            setLineSpacing(0f, 1.15f)
            setTextColor(getColor(R.color.text_dim))
            setPadding(dp(6), 0, dp(6), dp(10))
        })
    }

    private fun row(title: String, sub: String?, click: () -> Unit) {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundResource(R.drawable.card)
            setPadding(dp(20), dp(14), dp(20), dp(14))
            minimumHeight = dp(64)
            gravity = android.view.Gravity.CENTER_VERTICAL
            setOnClickListener { click() }
        }
        box.addView(TextView(this).apply {
            text = title
            textSize = 18f
            setTextColor(getColor(R.color.text))
        })
        if (sub != null) box.addView(TextView(this).apply {
            text = sub
            textSize = 14f
            setTextColor(getColor(R.color.text_dim))
        })
        val lp = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        lp.bottomMargin = dp(8)
        list.addView(box, lp)
    }
}
