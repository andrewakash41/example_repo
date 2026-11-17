package dev.cockpit.launcher

import android.app.Activity
import android.graphics.Typeface
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/** Live GPS health, to find out why navigation drifts or keeps rerouting. */
class GpsActivity : Activity(), SpeedTracker.Listener {
    private lateinit var verdict: TextView
    private lateinit var details: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Prefs.init(this)
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(16), dp(24), dp(24))
        }
        verdict = TextView(this).apply {
            textSize = 26f
            setTextColor(getColor(R.color.text))
        }
        details = TextView(this).apply {
            textSize = 18f
            typeface = Typeface.MONOSPACE
            setLineSpacing(0f, 1.3f)
            setTextColor(getColor(R.color.text_dim))
            setPadding(0, dp(12), 0, dp(16))
        }
        col.addView(verdict)
        col.addView(details)
        col.addView(Button(this).apply {
            text = "Refresh assistance data (quick)"
            setOnClickListener { done(SpeedTracker.refreshAssistData(this@GpsActivity, false)) }
        })
        col.addView(Button(this).apply {
            text = "Full GPS reset (cold start, takes a few minutes outdoors)"
            setOnClickListener { done(SpeedTracker.refreshAssistData(this@GpsActivity, true)) }
        })
        col.addView(TextView(this).apply {
            text = "Healthy reception: 8 or more satellites in use, signal above 30 dB-Hz and accuracy " +
                "better than 10 m with a clear view of the sky. Fewer than 5 satellites or a weak " +
                "signal while outdoors almost always means the GPS antenna is unplugged, damaged, " +
                "or buried behind metal in the dashboard."
            textSize = 15f
            setLineSpacing(0f, 1.2f)
            setTextColor(getColor(R.color.text_dim))
            setPadding(0, dp(16), 0, 0)
        })
        setContentView(ScrollView(this).apply {
            fitsSystemWindows = true
            addView(col)
        })
    }

    private fun done(ok: Boolean) = Apps.toast(
        this, if (ok) "Sent. Keep the car outdoors for a few minutes." else "This unit's GPS chip rejected the command"
    )

    override fun onStart() {
        super.onStart()
        SpeedTracker.add(this, this)
        onSpeedUpdate()
    }

    override fun onStop() {
        super.onStop()
        SpeedTracker.remove(this)
    }

    override fun onSpeedUpdate() {
        val t = SpeedTracker
        val (text, color) = when {
            !t.hasPermission(this) -> "Location permission not granted" to R.color.warn
            !t.providerEnabled -> "GPS is switched off in Location settings" to R.color.warn
            !t.hasFix -> "No fix: searching for satellites" to R.color.warn
            t.satsUsed < 5 || t.accuracyM > 20f || t.avgSignal < 22f -> "Weak fix: navigation will drift and reroute" to R.color.warn
            t.satsUsed < 8 || t.accuracyM > 10f -> "Usable fix" to R.color.text
            else -> "Strong fix" to R.color.accent
        }
        verdict.text = text
        verdict.setTextColor(getColor(color))
        details.text = buildString {
            append("Satellites in use   ${t.satsUsed}\n")
            append("Satellites visible  ${t.satsVisible}\n")
            append("Average signal      ${if (t.avgSignal > 0) String.format("%.0f dB-Hz", t.avgSignal) else "-"}\n")
            append("Accuracy            ${if (t.hasFix && t.accuracyM >= 0) String.format("±%.0f m", t.accuracyM) else "-"}\n")
            append("Speed               ${Math.round(t.toUnit(t.speedMps))} ${t.unit}\n")
            append("Altitude            ${if (t.altitudeM.isNaN()) "-" else String.format("%.0f m", t.altitudeM)}\n")
            append("Last fix            ${if (t.fixAgeSec < 0) "never" else "${t.fixAgeSec} s ago"}")
        }
    }
}
