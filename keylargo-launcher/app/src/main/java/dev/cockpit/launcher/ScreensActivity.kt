package dev.cockpit.launcher

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ListView
import android.widget.TextView

/**
 * Lists every installed package and its exported screens (activities) so that menus the stock
 * launcher hides - factory settings, car settings, radio region, steering-wheel learning - can be
 * opened. It only starts screens that Android already allows any app to start; nothing is bypassed.
 */
class ScreensActivity : Activity() {
    private class Item(val title: String, val sub: String, val pkg: String, val cls: String?) {
        override fun toString() = "$title\n$sub"
    }

    private lateinit var adapter: ArrayAdapter<Item>
    private lateinit var search: EditText
    private lateinit var crumb: TextView
    private var packages: List<Item> = emptyList()
    private var current: List<Item> = emptyList()
    private var inPackage = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            fitsSystemWindows = true
            setPadding(dp(16), dp(12), dp(16), 0)
        }
        crumb = TextView(this).apply {
            textSize = 15f
            setTextColor(getColor(R.color.text_dim))
            setPadding(dp(4), 0, 0, dp(8))
        }
        search = EditText(this).apply {
            hint = "Filter (try: factory, car, setting, radio, test)"
            setSingleLine()
            textSize = 17f
            setBackgroundResource(R.drawable.field)
            setPadding(dp(18), dp(12), dp(18), dp(12))
            setTextColor(getColor(R.color.text))
            setHintTextColor(getColor(R.color.text_dim))
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun afterTextChanged(s: Editable?) = render()
            })
        }
        adapter = ArrayAdapter(this, android.R.layout.simple_list_item_1)
        val lv = ListView(this).apply {
            adapter = this@ScreensActivity.adapter
            setOnItemClickListener { _, _, i, _ -> open(this@ScreensActivity.adapter.getItem(i)!!) }
        }
        root.addView(crumb)
        root.addView(search, LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
        root.addView(lv, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        setContentView(root)

        val pm = packageManager
        packages = pm.getInstalledApplications(0)
            .map { Item(pm.getApplicationLabel(it).toString(), it.packageName, it.packageName, null) }
            .sortedBy { it.title.lowercase() }
        showPackages()
    }

    private fun showPackages() {
        inPackage = false
        current = packages
        crumb.text = "Installed packages (${packages.size}). Tap one to see its screens."
        search.setText("")
        render()
    }

    private fun open(item: Item) {
        if (item.cls == null) {
            val acts = try {
                packageManager.getPackageInfo(item.pkg, PackageManager.GET_ACTIVITIES).activities
            } catch (e: Exception) {
                null
            }
            val list = acts.orEmpty().filter { it.exported && it.isEnabled }
                .map { Item(it.name.substringAfterLast('.'), it.name, item.pkg, it.name) }
                .sortedBy { it.title.lowercase() }
            if (list.isEmpty()) {
                Apps.toast(this, "${item.title} has no screens that other apps may open")
                return
            }
            inPackage = true
            current = list
            crumb.text = "${item.title}: ${list.size} screens. Back returns to the package list."
            search.setText("")
            render()
        } else {
            val i = Intent().setComponent(ComponentName(item.pkg, item.cls)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            if (!Apps.start(this, i)) Apps.toast(this, "Android does not allow this screen to be opened directly")
        }
    }

    private fun render() {
        val q = search.text.toString().trim().lowercase()
        adapter.clear()
        adapter.addAll(if (q.isEmpty()) current else current.filter { it.title.lowercase().contains(q) || it.sub.lowercase().contains(q) })
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (inPackage) showPackages() else finish()
    }
}
