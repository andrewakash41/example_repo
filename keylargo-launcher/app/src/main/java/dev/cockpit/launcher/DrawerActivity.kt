package dev.cockpit.launcher

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.Editable
import android.text.TextUtils
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.BaseAdapter
import android.widget.EditText
import android.widget.GridView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

class DrawerActivity : Activity() {
    private var all: List<AppEntry> = emptyList()
    private var shown: List<AppEntry> = emptyList()
    private lateinit var search: EditText
    private val adapter = Grid()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Prefs.init(this)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            fitsSystemWindows = true
            setPadding(dp(16), dp(12), dp(16), 0)
        }
        search = EditText(this).apply {
            setHint(R.string.search_apps)
            setSingleLine()
            textSize = 18f
            setBackgroundResource(R.drawable.field)
            setPadding(dp(18), dp(12), dp(18), dp(12))
            setTextColor(getColor(R.color.text))
            setHintTextColor(getColor(R.color.text_dim))
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun afterTextChanged(s: Editable?) = filter()
            })
        }
        root.addView(search, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        val grid = GridView(this).apply {
            numColumns = GridView.AUTO_FIT
            columnWidth = dp(128)
            verticalSpacing = dp(6)
            stretchMode = GridView.STRETCH_COLUMN_WIDTH
            clipToPadding = false
            setPadding(0, dp(12), 0, dp(12))
            adapter = this@DrawerActivity.adapter
            setOnItemClickListener { _, _, i, _ ->
                Apps.launch(this@DrawerActivity, shown[i].component)
                finish()
            }
            setOnItemLongClickListener { _, _, i, _ -> menu(shown[i]); true }
        }
        root.addView(grid, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        setContentView(root)
    }

    override fun onResume() {
        super.onResume()
        // Icons are decoded off the UI thread so the drawer opens instantly.
        Thread {
            val list = Apps.load(this)
            Handler(Looper.getMainLooper()).post {
                if (!isDestroyed) {
                    all = list
                    filter()
                }
            }
        }.start()
    }

    private fun filter() {
        val q = search.text.toString().trim().lowercase()
        shown = if (q.isEmpty()) all else all.filter { it.label.lowercase().contains(q) }
        adapter.notifyDataSetChanged()
    }

    private fun menu(app: AppEntry) {
        val flat = app.component.flattenToString()
        val inDock = flat in Prefs.dock
        val pkgUri = Uri.fromParts("package", app.component.packageName, null)
        AlertDialog.Builder(this)
            .setTitle(app.label)
            .setItems(arrayOf(if (inDock) "Remove from dock" else "Add to dock", "App info", "Uninstall")) { _, which ->
                when (which) {
                    0 -> when {
                        inDock -> Prefs.dock = Prefs.dock - flat
                        Prefs.dock.size >= Prefs.MAX_DOCK -> Apps.toast(this, "The dock is full. Remove an app first.")
                        else -> Prefs.dock = Prefs.dock + flat
                    }
                    1 -> Apps.start(this, Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkgUri))
                    2 -> Apps.start(this, Intent(Intent.ACTION_DELETE, pkgUri))
                }
            }.show()
    }

    private inner class Grid : BaseAdapter() {
        override fun getCount() = shown.size
        override fun getItem(i: Int) = shown[i]
        override fun getItemId(i: Int) = i.toLong()
        override fun getView(i: Int, convert: View?, parent: ViewGroup): View {
            val cell = (convert as? LinearLayout) ?: LinearLayout(this@DrawerActivity).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER_HORIZONTAL
                setPadding(dp(6), dp(12), dp(6), dp(12))
                addView(ImageView(context), LinearLayout.LayoutParams(dp(60), dp(60)))
                addView(TextView(context).apply {
                    textSize = 14f
                    setTextColor(getColor(R.color.text))
                    maxLines = 2
                    ellipsize = TextUtils.TruncateAt.END
                    gravity = Gravity.CENTER
                    setPadding(0, dp(8), 0, 0)
                }, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            }
            (cell.getChildAt(0) as ImageView).setImageDrawable(shown[i].icon)
            (cell.getChildAt(1) as TextView).text = shown[i].label
            return cell
        }
    }
}
