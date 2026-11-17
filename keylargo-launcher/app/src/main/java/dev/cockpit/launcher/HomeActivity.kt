package dev.cockpit.launcher

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.drawable.Drawable
import android.media.MediaMetadata
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

class HomeActivity : Activity(), SpeedTracker.Listener {
    private lateinit var dial: SpeedDialView
    private lateinit var trip: TextView
    private lateinit var gps: TextView
    private lateinit var max: TextView
    private lateinit var art: ImageView
    private lateinit var track: TextView
    private lateinit var artist: TextView
    private lateinit var play: ImageButton
    private lateinit var dock: LinearLayout
    private lateinit var music: MusicHub
    private var userAsked = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Prefs.init(this)
        setContentView(R.layout.home)
        dial = findViewById(R.id.dial)
        trip = findViewById(R.id.trip)
        gps = findViewById(R.id.gps)
        max = findViewById(R.id.max)
        art = findViewById(R.id.art)
        track = findViewById(R.id.title)
        artist = findViewById(R.id.artist)
        play = findViewById(R.id.play)
        dock = findViewById(R.id.dock)
        music = MusicHub(this) { renderMusic() }

        findViewById<View>(R.id.speedCard).apply {
            setOnClickListener {
                if (SpeedTracker.hasPermission(this@HomeActivity)) startActivity(Intent(this@HomeActivity, GpsActivity::class.java))
                else {
                    userAsked = true
                    askLocation()
                }
            }
            setOnLongClickListener {
                SpeedTracker.resetTrip()
                Apps.toast(this@HomeActivity, "Trip reset")
                true
            }
        }
        findViewById<View>(R.id.clockCard).setOnClickListener {
            Apps.start(this, Intent(Settings.ACTION_DATE_SETTINGS))
        }
        findViewById<View>(R.id.musicCard).setOnClickListener { openPlayer() }
        play.setOnClickListener { music.toggle() }
        findViewById<View>(R.id.next).setOnClickListener { music.next() }
        findViewById<View>(R.id.prev).setOnClickListener { music.prev() }

        if (!SpeedTracker.hasPermission(this) && !Prefs.askedLocation) {
            Prefs.askedLocation = true
            askLocation()
        }
    }

    override fun onStart() {
        super.onStart()
        dial.accent = Prefs.accent
        val tint = ColorStateList.valueOf(Prefs.accent)
        play.imageTintList = tint
        buildDock()
        SpeedTracker.add(this, this)
        onSpeedUpdate()
        music.start()
    }

    override fun onStop() {
        super.onStop()
        SpeedTracker.remove(this)
        music.stop()
    }

    /** Home is the bottom of the stack; Back must not close it. */
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
    }

    private fun askLocation() = requestPermissions(
        arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION), 1
    )

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        // After "Don't ask again" Android stops showing the prompt; send the user to the app's page.
        if (userAsked && grantResults.isNotEmpty() && !SpeedTracker.hasPermission(this) &&
            !shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_FINE_LOCATION)
        ) {
            Apps.toast(this, "Open Permissions and allow Location")
            Apps.start(this, Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", packageName, null)))
        }
        userAsked = false
        SpeedTracker.add(this, this)
        onSpeedUpdate()
    }

    // ---- speed ----------------------------------------------------------------------------

    override fun onSpeedUpdate() {
        val t = SpeedTracker
        val allowed = t.hasPermission(this)
        val v = t.toUnit(t.speedMps)
        val warnAt = Prefs.warnAt
        val caption = when {
            !allowed -> "Tap to allow location"
            !t.providerEnabled -> "GPS is switched off"
            !t.hasFix -> "Searching for satellites"
            else -> t.compass()
        }
        dial.set(v, if (Prefs.mph) 140f else 220f, t.unit, allowed && t.hasFix, warnAt > 0 && v > warnAt, caption)
        trip.text = "Trip  " + t.distance(t.tripMeters)
        max.text = "Max  " + Math.round(t.toUnit(t.maxMps)) + " " + t.unit
        gps.text = if (allowed) "GPS ${t.satsUsed}/${t.satsVisible}" +
            (if (t.hasFix && t.accuracyM >= 0) "  ±${Math.round(t.accuracyM)} m" else "") else ""
    }

    // ---- music ----------------------------------------------------------------------------

    private fun renderMusic() {
        val c = music.controller
        val md = c?.metadata
        when {
            !music.granted -> {
                track.setText(R.string.music_access_title)
                artist.setText(R.string.music_access_sub)
            }
            md == null -> {
                track.setText(R.string.nothing_playing)
                artist.setText(R.string.tap_play)
            }
            else -> {
                track.text = md.getString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE)
                    ?: md.getString(MediaMetadata.METADATA_KEY_TITLE) ?: getString(R.string.nothing_playing)
                artist.text = md.getString(MediaMetadata.METADATA_KEY_ARTIST)
                    ?: md.getString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE)
                    ?: md.getString(MediaMetadata.METADATA_KEY_ALBUM) ?: ""
            }
        }
        val bmp = md?.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART)
            ?: md?.getBitmap(MediaMetadata.METADATA_KEY_ART)
            ?: md?.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON)
        if (bmp != null) {
            art.imageTintList = null
            art.scaleType = ImageView.ScaleType.CENTER_CROP
            art.setImageBitmap(bmp)
        } else {
            art.scaleType = ImageView.ScaleType.CENTER_INSIDE
            art.setImageResource(R.drawable.ic_music)
            art.imageTintList = ColorStateList.valueOf(0x66FFFFFF)
        }
        play.setImageResource(if (music.playing) R.drawable.ic_pause else R.drawable.ic_play)
    }

    private fun openPlayer() {
        if (!music.granted) {
            if (!Apps.start(this, Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))) {
                Apps.toast(this, "This unit hides that screen. See README: grant it over ADB.")
            }
            return
        }
        val pkg = music.controller?.packageName
        if (pkg == null || !Apps.launchPackage(this, pkg)) {
            Apps.start(this, Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_APP_MUSIC).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }

    // ---- dock -----------------------------------------------------------------------------

    private fun buildDock() {
        dock.removeAllViews()
        val accent = Prefs.accent
        addTile(getDrawable(R.drawable.ic_car)!!, "Android Auto", accent, { openAuto() }, { chooseAuto() })
        addTile(getDrawable(R.drawable.ic_nav)!!, "Navigate", accent, { openNav() }, { chooseNav() })
        val saved = Prefs.dock
        val alive = ArrayList<String>()
        for (flat in saved) {
            val app = Apps.find(this, flat) ?: continue // uninstalled apps drop out
            alive.add(flat)
            addTile(app.icon, app.label, null, { Apps.launch(this, app.component) }, {
                AlertDialog.Builder(this)
                    .setTitle(app.label)
                    .setItems(arrayOf("Remove from dock")) { _, _ ->
                        Prefs.dock = Prefs.dock - flat
                        buildDock()
                    }.show()
            })
        }
        if (alive.size != saved.size) Prefs.dock = alive
        addTile(getDrawable(R.drawable.ic_apps)!!, "All apps", accent, { startActivity(Intent(this, DrawerActivity::class.java)) }, null)
        addTile(getDrawable(R.drawable.ic_tune)!!, "Settings", accent, { startActivity(Intent(this, SettingsActivity::class.java)) }, null)
    }

    private fun addTile(icon: Drawable, label: String, tint: Int?, click: () -> Unit, long: (() -> Unit)?) {
        val tile = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundResource(R.drawable.card)
            setOnClickListener { click() }
            if (long != null) setOnLongClickListener { long(); true }
        }
        val iv = ImageView(this).apply {
            setImageDrawable(icon.mutate())
            if (tint != null) imageTintList = ColorStateList.valueOf(tint)
        }
        tile.addView(iv, LinearLayout.LayoutParams(dp(44), dp(44)))
        val tv = TextView(this).apply {
            text = label
            textSize = 13f
            setTextColor(getColor(R.color.text_dim))
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
            gravity = Gravity.CENTER
            setPadding(dp(6), dp(4), dp(6), 0)
        }
        tile.addView(tv, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        val lp = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f)
        if (dock.childCount > 0) lp.marginStart = dp(12)
        dock.addView(tile, lp)
    }

    private fun openAuto() {
        val pkg = Prefs.autoPkg ?: AUTO_RECEIVERS.firstOrNull { Apps.isInstalled(this, it) }
        if (pkg != null && Apps.launchPackage(this, pkg)) return
        AlertDialog.Builder(this)
            .setTitle("Android Auto")
            .setMessage(
                "No Android Auto receiver app is installed yet.\n\n" +
                    "Install the open-source \"Headunit Revived\" APK (steps are in the README), " +
                    "or choose any app you already have, such as the built-in PhoneLINK."
            )
            .setPositiveButton("Choose app") { _, _ -> chooseAuto() }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    private fun chooseAuto() = Apps.pick(this, "App for the Android Auto tile") { Prefs.autoPkg = it }

    private fun openNav() {
        val pkg = Prefs.navPkg ?: "com.google.android.apps.maps"
        if (!Apps.launchPackage(this, pkg)) chooseNav()
    }

    private fun chooseNav() = Apps.pick(this, "App for the Navigate tile") { Prefs.navPkg = it }

    companion object {
        /** Known package names of the open-source Android Auto receiver. */
        val AUTO_RECEIVERS = listOf("com.andrerinas.headunitrevived")
    }
}
