package dev.cockpit.launcher

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.GnssStatus
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock

/**
 * GPS speed, trip distance and satellite status. Everything stays in memory on the device
 * (only the trip distance is saved, to the app's private preferences). No location is logged.
 */
object SpeedTracker {
    interface Listener {
        fun onSpeedUpdate()
    }

    var speedMps = 0f; private set
    var maxMps = 0f; private set
    var tripMeters = 0f; private set
    var accuracyM = -1f; private set
    var bearing = -1f; private set
    var altitudeM = Double.NaN; private set
    var satsUsed = 0; private set
    var satsVisible = 0; private set
    var avgSignal = 0f; private set
    var providerEnabled = true; private set
    private var lastFixAt = 0L
    private var last: Location? = null

    private val listeners = LinkedHashSet<Listener>()
    private val main = Handler(Looper.getMainLooper())
    private var lm: LocationManager? = null
    private var running = false

    /** True when a position fix arrived in the last 5 seconds. */
    val hasFix: Boolean get() = lastFixAt != 0L && SystemClock.elapsedRealtime() - lastFixAt < 5000
    val fixAgeSec: Long get() = if (lastFixAt == 0L) -1 else (SystemClock.elapsedRealtime() - lastFixAt) / 1000

    fun hasPermission(c: Context) =
        c.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

    private val locListener = object : LocationListener {
        override fun onLocationChanged(loc: Location) {
            val prev = last
            var v = if (loc.hasSpeed()) loc.speed else 0f
            if (!loc.hasSpeed() && prev != null) {
                val dt = (loc.elapsedRealtimeNanos - prev.elapsedRealtimeNanos) / 1e9f
                if (dt > 0.2f) v = prev.distanceTo(loc) / dt
            }
            // Receivers report 0.2-0.8 m/s of jitter while parked; treat that as standing still.
            if (v < 0.7f) v = 0f
            speedMps = v
            accuracyM = if (loc.hasAccuracy()) loc.accuracy else -1f
            bearing = if (loc.hasBearing() && v > 1.5f) loc.bearing else bearing
            altitudeM = if (loc.hasAltitude()) loc.altitude else Double.NaN
            val good = loc.hasAccuracy() && loc.accuracy <= 25f
            if (good) {
                if (prev != null && v > 0f) {
                    val d = prev.distanceTo(loc)
                    if (d < 150f) tripMeters += d
                }
                if (v > maxMps) maxMps = v
                last = loc
            }
            lastFixAt = SystemClock.elapsedRealtime()
            notifyAll0()
        }

        // These three must be overridden: they are abstract on Android 10 and older.
        @Deprecated("Deprecated in Java")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {
        }

        override fun onProviderEnabled(provider: String) {
            providerEnabled = true
            notifyAll0()
        }

        override fun onProviderDisabled(provider: String) {
            providerEnabled = false
            notifyAll0()
        }
    }

    private val gnss = object : GnssStatus.Callback() {
        override fun onSatelliteStatusChanged(status: GnssStatus) {
            var used = 0
            var sum = 0f
            var heard = 0
            for (i in 0 until status.satelliteCount) {
                val cn0 = status.getCn0DbHz(i)
                if (cn0 > 0f) {
                    heard++
                    sum += cn0
                }
                if (status.usedInFix(i)) used++
            }
            satsUsed = used
            satsVisible = status.satelliteCount
            avgSignal = if (heard > 0) sum / heard else 0f
            notifyAll0()
        }
    }

    // Once a second, so the UI notices when fixes stop arriving.
    private val heartbeat = object : Runnable {
        override fun run() {
            if (!hasFix) speedMps = 0f
            notifyAll0()
            main.postDelayed(this, 1000)
        }
    }

    private fun notifyAll0() {
        for (l in listeners.toList()) l.onSpeedUpdate()
    }

    @SuppressLint("MissingPermission")
    fun add(c: Context, l: Listener) {
        listeners.add(l)
        if (running || !hasPermission(c)) return
        val m = c.applicationContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        try {
            m.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, locListener, Looper.getMainLooper())
            m.registerGnssStatusCallback(gnss, main)
            providerEnabled = m.isProviderEnabled(LocationManager.GPS_PROVIDER)
        } catch (e: Exception) {
            providerEnabled = false
            return
        }
        lm = m
        if (tripMeters == 0f) tripMeters = Prefs.tripMeters
        running = true
        main.postDelayed(heartbeat, 1000)
    }

    fun remove(l: Listener) {
        listeners.remove(l)
        if (listeners.isNotEmpty() || !running) return
        main.removeCallbacks(heartbeat)
        try {
            lm?.removeUpdates(locListener)
            lm?.unregisterGnssStatusCallback(gnss)
        } catch (e: Exception) {
        }
        running = false
        last = null
        Prefs.tripMeters = tripMeters
    }

    fun resetTrip() {
        tripMeters = 0f
        maxMps = 0f
        last = null
        Prefs.tripMeters = 0f
        notifyAll0()
    }

    /** Asks the GPS chip to drop/refresh its assistance data (fixes stale almanac after long parking). */
    fun refreshAssistData(c: Context, cold: Boolean): Boolean = try {
        val m = c.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        if (cold) m.sendExtraCommand(LocationManager.GPS_PROVIDER, "delete_aiding_data", null)
        m.sendExtraCommand(LocationManager.GPS_PROVIDER, "force_time_injection", null)
        m.sendExtraCommand(LocationManager.GPS_PROVIDER, "force_xtra_injection", Bundle())
        true
    } catch (e: Exception) {
        false
    }

    fun toUnit(mps: Float): Float = mps * if (Prefs.mph) 2.23694f else 3.6f
    val unit: String get() = if (Prefs.mph) "mph" else "km/h"
    fun distance(m: Float): String =
        if (Prefs.mph) String.format("%.1f mi", m / 1609.344f) else String.format("%.1f km", m / 1000f)

    fun compass(): String {
        if (bearing < 0) return ""
        val names = arrayOf("N", "NE", "E", "SE", "S", "SW", "W", "NW")
        return names[(((bearing + 22.5f) % 360f) / 45f).toInt().coerceIn(0, 7)]
    }
}
