package dev.cockpit.launcher

import android.content.Context
import android.content.SharedPreferences

/** All settings live in the app's private storage on the head unit. Nothing is synced. */
object Prefs {
    val ACCENTS = intArrayOf(
        0xFF35D0FF.toInt(), 0xFF3DDC97.toInt(), 0xFFFFB547.toInt(),
        0xFFFF5C6C.toInt(), 0xFF9B8CFF.toInt(), 0xFFF2F5FA.toInt()
    )
    val ACCENT_NAMES = arrayOf("Ice blue", "Green", "Amber", "Red", "Violet", "White")
    val WARN_STEPS = intArrayOf(0, 40, 50, 60, 80, 100, 120)
    const val MAX_DOCK = 5

    private lateinit var sp: SharedPreferences

    fun init(c: Context) {
        if (!::sp.isInitialized) sp = c.applicationContext.getSharedPreferences("cockpit", Context.MODE_PRIVATE)
    }

    var mph: Boolean
        get() = sp.getBoolean("mph", false)
        set(v) = sp.edit().putBoolean("mph", v).apply()

    var accentIndex: Int
        get() = sp.getInt("accent", 0).coerceIn(0, ACCENTS.size - 1)
        set(v) = sp.edit().putInt("accent", v).apply()

    val accent: Int get() = ACCENTS[accentIndex]

    /** Speed warning threshold in the selected unit; 0 = off. */
    var warnAt: Int
        get() = sp.getInt("warn", 0)
        set(v) = sp.edit().putInt("warn", v).apply()

    var autoPkg: String?
        get() = sp.getString("auto", null)
        set(v) = sp.edit().putString("auto", v).apply()

    var navPkg: String?
        get() = sp.getString("nav", null)
        set(v) = sp.edit().putString("nav", v).apply()

    var tripMeters: Float
        get() = sp.getFloat("trip", 0f)
        set(v) = sp.edit().putFloat("trip", v).apply()

    var askedLocation: Boolean
        get() = sp.getBoolean("askedLoc", false)
        set(v) = sp.edit().putBoolean("askedLoc", v).apply()

    /** Flattened component names of the user's dock apps, in order. */
    var dock: List<String>
        get() = sp.getString("dock", "")!!.split('|').filter { it.isNotEmpty() }
        set(v) = sp.edit().putString("dock", v.joinToString("|")).apply()
}
