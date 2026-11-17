package dev.cockpit.launcher

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.util.AttributeSet
import android.view.View
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/** A 270-degree arc gauge with a large digital readout. Draws nothing but primitives, so it is cheap. */
class SpeedDialView @JvmOverloads constructor(c: Context, a: AttributeSet? = null) : View(c, a) {
    private val track = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; color = 0x22FFFFFF
    }
    private val arc = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND }
    private val tick = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x55FFFFFF; strokeCap = Paint.Cap.ROUND }
    private val num = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER; color = 0xFFF2F5FA.toInt()
        typeface = Typeface.create("sans-serif-light", Typeface.NORMAL)
    }
    private val small = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER; color = 0xFF8A93A6.toInt() }
    private val box = RectF()

    private var target = 0f
    private var shown = 0f
    private var max = 200f
    private var unit = "km/h"
    private var valid = false
    private var warn = false
    private var caption = ""
    var accent = 0xFF35D0FF.toInt()
        set(v) { field = v; invalidate() }

    fun set(value: Float, max: Float, unit: String, valid: Boolean, warn: Boolean, caption: String) {
        target = value.coerceIn(0f, max)
        this.max = max; this.unit = unit; this.valid = valid; this.warn = warn; this.caption = caption
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        val w = width.toFloat()
        val h = height.toFloat()
        val stroke = min(w, h) * 0.055f
        // A 270-degree arc is ~1.707 radii tall, so size the radius from both dimensions.
        val r = min(w / 2f, h / 1.75f) - stroke
        if (r <= 0) return
        val cx = w / 2f
        val cy = (h - r * 1.707f) / 2f + r
        box.set(cx - r, cy - r, cx + r, cy + r)

        // Ease towards the target so 1 Hz GPS updates look smooth.
        val diff = target - shown
        if (abs(diff) > 0.05f) {
            shown += diff * 0.18f
            postInvalidateOnAnimation()
        } else shown = target

        track.strokeWidth = stroke
        arc.strokeWidth = stroke
        canvas.drawArc(box, 135f, 270f, false, track)

        tick.strokeWidth = stroke * 0.18f
        val steps = 10
        for (i in 0..steps) {
            val ang = Math.toRadians(135.0 + 270.0 * i / steps)
            val r1 = r - stroke * 1.1f
            val r2 = r - stroke * 1.7f
            canvas.drawLine(
                cx + (cos(ang) * r1).toFloat(), cy + (sin(ang) * r1).toFloat(),
                cx + (cos(ang) * r2).toFloat(), cy + (sin(ang) * r2).toFloat(), tick
            )
        }

        if (valid) {
            arc.color = if (warn) 0xFFFF5C6C.toInt() else accent
            val sweep = 270f * (shown / max)
            if (sweep > 0.5f) canvas.drawArc(box, 135f, sweep, false, arc)
        }

        num.textSize = r * 0.72f
        num.color = if (warn && valid) 0xFFFF5C6C.toInt() else 0xFFF2F5FA.toInt()
        val text = if (valid) Math.round(shown).toString() else "--"
        canvas.drawText(text, cx, cy + num.textSize * 0.30f, num)
        small.textSize = r * 0.15f
        canvas.drawText(unit, cx, cy + num.textSize * 0.30f + small.textSize * 1.5f, small)
        if (caption.isNotEmpty()) canvas.drawText(caption, cx, cy + r * 0.92f, small)
    }
}
