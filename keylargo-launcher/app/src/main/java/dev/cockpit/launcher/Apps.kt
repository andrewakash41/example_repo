package dev.cockpit.launcher

import android.app.AlertDialog
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Drawable
import android.widget.Toast

class AppEntry(val label: String, val component: ComponentName, val icon: Drawable)

object Apps {
    fun load(c: Context): List<AppEntry> {
        val pm = c.packageManager
        val main = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        return pm.queryIntentActivities(main, 0)
            .filter { it.activityInfo.packageName != c.packageName }
            .map {
                AppEntry(
                    it.loadLabel(pm).toString(),
                    ComponentName(it.activityInfo.packageName, it.activityInfo.name),
                    it.loadIcon(pm)
                )
            }
            .sortedBy { it.label.lowercase() }
    }

    fun find(c: Context, flat: String): AppEntry? {
        val cn = ComponentName.unflattenFromString(flat) ?: return null
        return try {
            val pm = c.packageManager
            val info = pm.getActivityInfo(cn, 0)
            AppEntry(info.loadLabel(pm).toString(), cn, info.loadIcon(pm))
        } catch (e: Exception) {
            null
        }
    }

    fun launch(c: Context, cn: ComponentName): Boolean = start(
        c,
        Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).setComponent(cn)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
    )

    fun launchPackage(c: Context, pkg: String): Boolean {
        val i = c.packageManager.getLaunchIntentForPackage(pkg) ?: return false
        return start(c, i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    fun isInstalled(c: Context, pkg: String): Boolean =
        c.packageManager.getLaunchIntentForPackage(pkg) != null

    /** Starts an activity and reports failure instead of crashing (head-unit ROMs remove screens). */
    fun start(c: Context, i: Intent): Boolean = try {
        c.startActivity(i)
        true
    } catch (e: Exception) {
        false
    }

    fun toast(c: Context, msg: String) = Toast.makeText(c, msg, Toast.LENGTH_LONG).show()

    fun pick(c: Context, title: String, onPick: (AppEntry) -> Unit) {
        val apps = load(c)
        AlertDialog.Builder(c)
            .setTitle(title)
            .setItems(apps.map { it.label }.toTypedArray()) { _, i -> onPick(apps[i]) }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }
}

fun Context.dp(v: Int): Int = (v * resources.displayMetrics.density + 0.5f).toInt()
