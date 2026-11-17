package dev.cockpit.launcher

import android.content.ComponentName
import android.content.Context
import android.media.AudioManager
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.SystemClock
import android.view.KeyEvent

/** Follows whichever app is currently playing, through Android's standard media-session API. */
class MusicHub(private val c: Context, private val onChange: () -> Unit) {
    private val msm = c.getSystemService(Context.MEDIA_SESSION_SERVICE) as MediaSessionManager
    private val audio = c.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val me = ComponentName(c, MediaListener::class.java)
    private var registered = false

    var controller: MediaController? = null; private set
    var granted = false; private set

    private val cb = object : MediaController.Callback() {
        override fun onPlaybackStateChanged(state: PlaybackState?) = onChange()
        override fun onMetadataChanged(metadata: MediaMetadata?) = onChange()
        override fun onSessionDestroyed() = refresh()
    }
    private val sessions = MediaSessionManager.OnActiveSessionsChangedListener { pick(it) }

    fun start() {
        try {
            if (!registered) msm.addOnActiveSessionsChangedListener(sessions, me)
            registered = true
            granted = true
            refresh()
        } catch (e: SecurityException) {
            granted = false
            onChange()
        }
    }

    fun stop() {
        if (registered) msm.removeOnActiveSessionsChangedListener(sessions)
        registered = false
        controller?.unregisterCallback(cb)
        controller = null
    }

    private fun refresh() {
        try {
            pick(msm.getActiveSessions(me))
        } catch (e: SecurityException) {
            granted = false
            onChange()
        }
    }

    private fun pick(list: List<MediaController>?) {
        val best = list?.firstOrNull { it.playbackState?.state == PlaybackState.STATE_PLAYING } ?: list?.firstOrNull()
        if (best?.sessionToken != controller?.sessionToken) {
            controller?.unregisterCallback(cb)
            controller = best
            best?.registerCallback(cb)
        }
        onChange()
    }

    val playing: Boolean get() = controller?.playbackState?.state == PlaybackState.STATE_PLAYING

    fun toggle() {
        val t = controller?.transportControls
        when {
            t == null -> key(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE)
            playing -> t.pause()
            else -> t.play()
        }
    }

    fun next() = controller?.transportControls?.skipToNext() ?: key(KeyEvent.KEYCODE_MEDIA_NEXT)
    fun prev() = controller?.transportControls?.skipToPrevious() ?: key(KeyEvent.KEYCODE_MEDIA_PREVIOUS)

    /** Fallback for players without a media session (e.g. some stock radio / Bluetooth apps). */
    private fun key(code: Int) {
        val t = SystemClock.uptimeMillis()
        audio.dispatchMediaKeyEvent(KeyEvent(t, t, KeyEvent.ACTION_DOWN, code, 0))
        audio.dispatchMediaKeyEvent(KeyEvent(t, t, KeyEvent.ACTION_UP, code, 0))
    }
}
