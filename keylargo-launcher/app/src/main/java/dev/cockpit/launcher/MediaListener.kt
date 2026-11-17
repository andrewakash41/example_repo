package dev.cockpit.launcher

import android.service.notification.NotificationListenerService

/**
 * Intentionally empty. Android only exposes "what is playing" (MediaSessionManager) to apps
 * the user has granted notification access to. This class exists purely to hold that grant;
 * it never reads, stores or forwards any notification.
 */
class MediaListener : NotificationListenerService()
