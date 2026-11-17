package dev.cockpit.launcher

import android.app.Application

/** Makes settings available before any screen starts, whichever screen Android restores first. */
class CockpitApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Prefs.init(this)
    }
}
