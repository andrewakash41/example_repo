class_name Hud
extends CanvasLayer
## P1 HUD: descent progress, score, combo, a phase indicator that depletes and
## pulses before a flip, a fever bar, a flip flash, plus revive / game-over /
## level-clear overlays. Visual polish (real ring around the ball, tweens, safe
## area) is P3. Built in code so it diffs cleanly.

signal home_pressed
signal replay_pressed
signal revive_pressed
signal revive_declined

var _progress: ProgressBar
var _score_label: Label
var _combo_label: Label
var _hint_label: Label
var _phase_bar: ProgressBar
var _fever_bar: ProgressBar
var _flash: ColorRect
var _overlay: Control
var _revive_countdown_label: Label

func _ready() -> void:
	layer = 10

	_progress = _make_bar(Control.PRESET_TOP_WIDE, 40, 60, 22)
	_progress.offset_right = -40

	_score_label = Label.new()
	_score_label.text = "0"
	_score_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_score_label.add_theme_font_size_override("font_size", 44)
	_score_label.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_score_label.offset_left = -260
	_score_label.offset_right = -40
	_score_label.offset_top = 100
	add_child(_score_label)

	_combo_label = Label.new()
	_combo_label.text = ""
	_combo_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_combo_label.add_theme_font_size_override("font_size", 30)
	_combo_label.add_theme_color_override("font_color", Color(1, 0.85, 0.3))
	_combo_label.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_combo_label.offset_left = -260
	_combo_label.offset_right = -40
	_combo_label.offset_top = 150
	add_child(_combo_label)

	# Phase indicator: a depleting bar tinted by the current phase.
	_phase_bar = _make_bar(Control.PRESET_CENTER_BOTTOM, -220, -160, 26)
	_phase_bar.offset_right = 220
	_phase_bar.max_value = 1.0
	_phase_bar.value = 1.0
	_style_bar_color(_phase_bar, PSTypes.AMBER_COLOR)

	# Fever bar: thin strip down the left edge.
	_fever_bar = ProgressBar.new()
	_fever_bar.show_percentage = false
	_fever_bar.fill_mode = ProgressBar.FILL_BOTTOM_TO_TOP
	_fever_bar.max_value = 1.0
	_fever_bar.value = 0.0
	_fever_bar.set_anchors_preset(Control.PRESET_LEFT_WIDE)
	_fever_bar.offset_left = 16
	_fever_bar.offset_right = 32
	_fever_bar.offset_top = 200
	_fever_bar.offset_bottom = -200
	_style_bar_color(_fever_bar, Color(1, 0.4, 0.1))
	add_child(_fever_bar)

	_hint_label = Label.new()
	_hint_label.text = "HOLD to smash — release before the color flips"
	_hint_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hint_label.add_theme_font_size_override("font_size", 30)
	_hint_label.add_theme_color_override("font_color", Color(1, 1, 1, 0.7))
	_hint_label.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_hint_label.offset_left = -360
	_hint_label.offset_right = 360
	_hint_label.offset_top = -110
	add_child(_hint_label)

	# Full-screen flash for phase flips / fever start (alpha animated to 0).
	_flash = ColorRect.new()
	_flash.color = Color(1, 1, 1, 0)
	_flash.set_anchors_preset(Control.PRESET_FULL_RECT)
	_flash.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_flash)

func _make_bar(preset: int, top: int, _unused: int, height: int) -> ProgressBar:
	var bar := ProgressBar.new()
	bar.show_percentage = false
	bar.custom_minimum_size = Vector2(0, height)
	bar.set_anchors_preset(preset)
	bar.offset_left = 40
	bar.offset_top = top
	bar.offset_bottom = top + height
	add_child(bar)
	return bar

func _style_bar_color(bar: ProgressBar, color: Color) -> void:
	var fill := StyleBoxFlat.new()
	fill.bg_color = color
	fill.set_corner_radius_all(6)
	bar.add_theme_stylebox_override("fill", fill)
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0, 0, 0, 0.35)
	bg.set_corner_radius_all(6)
	bar.add_theme_stylebox_override("background", bg)

# --- Live updates -----------------------------------------------------------

func set_progress(v: float) -> void:
	_progress.value = clampf(v, 0.0, 1.0)

func set_score(v: int) -> void:
	_score_label.text = str(v)

func set_combo(mult: float) -> void:
	_combo_label.text = ("x%.1f" % mult) if mult > 1.01 else ""

func set_phase(color: Color) -> void:
	_style_bar_color(_phase_bar, color)

## ratio 1->0 as the phase depletes; `warning` pulses it near the flip.
func set_phase_ratio(ratio: float, warning: bool) -> void:
	_phase_bar.value = clampf(ratio, 0.0, 1.0)
	if warning:
		var pulse: float = 0.5 + 0.5 * sin(Time.get_ticks_msec() * 0.02)
		_phase_bar.modulate = Color(1, 1, 1, 0.55 + 0.45 * pulse)
	else:
		_phase_bar.modulate = Color(1, 1, 1, 1)

func set_fever(ratio: float, active: bool) -> void:
	_fever_bar.value = clampf(ratio, 0.0, 1.0)
	_style_bar_color(_fever_bar, Color(1, 0.85, 0.2) if active else Color(1, 0.4, 0.1))

func hide_hint() -> void:
	_hint_label.visible = false

func flash(color: Color, strength: float = 0.6) -> void:
	_flash.color = Color(color.r, color.g, color.b, strength)
	var tw := create_tween()
	tw.tween_property(_flash, "color:a", 0.0, 0.35)

# --- Overlays ---------------------------------------------------------------

func _new_overlay(dim_alpha: float) -> VBoxContainer:
	_clear_overlay()
	_overlay = Control.new()
	_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_overlay)
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, dim_alpha)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	_overlay.add_child(dim)
	var box := VBoxContainer.new()
	box.set_anchors_preset(Control.PRESET_CENTER)
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	box.add_theme_constant_override("separation", 26)
	_overlay.add_child(box)
	return box

func _clear_overlay() -> void:
	if _overlay and is_instance_valid(_overlay):
		_overlay.queue_free()
	_overlay = null
	_revive_countdown_label = null

func _title(box: VBoxContainer, text: String, size: int, color: Color = Color.WHITE) -> void:
	var l := Label.new()
	l.text = text
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	box.add_child(l)

func _button(box: VBoxContainer, text: String, cb: Callable, color: Color = Color(0.9, 0.9, 0.95)) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(300, 96)
	b.add_theme_font_size_override("font_size", 40)
	b.add_theme_color_override("font_color", color)
	b.pressed.connect(cb)
	box.add_child(b)
	return b

func show_level_clear(level: int, score: int, best: int) -> void:
	var box := _new_overlay(0.55)
	_title(box, "LEVEL %d CLEAR" % level, 60, Color(0.3, 1, 0.6))
	_title(box, "Score  %d" % score, 36)
	_title(box, "Best  %d" % best, 28, Color(1, 1, 1, 0.7))
	_button(box, "NEXT", func(): replay_pressed.emit())
	_button(box, "HOME", func(): home_pressed.emit())

## Revive offer with a live countdown. The caller ticks it via set_revive_countdown.
func show_revive(seconds: int) -> void:
	var box := _new_overlay(0.6)
	_title(box, "CONTINUE?", 60, Color(1, 0.8, 0.2))
	_revive_countdown_label = Label.new()
	_revive_countdown_label.text = str(seconds)
	_revive_countdown_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_revive_countdown_label.add_theme_font_size_override("font_size", 72)
	box.add_child(_revive_countdown_label)
	_button(box, "▶ WATCH AD — REVIVE", func(): revive_pressed.emit(), Color(0.3, 1, 0.6))
	_button(box, "No thanks", func(): revive_declined.emit(), Color(1, 1, 1, 0.6))

func set_revive_countdown(seconds: int) -> void:
	if _revive_countdown_label and is_instance_valid(_revive_countdown_label):
		_revive_countdown_label.text = str(seconds)

func show_game_over(score: int, best: int) -> void:
	var box := _new_overlay(0.65)
	_title(box, "GAME OVER", 60, Color(1, 0.4, 0.4))
	_title(box, "Score  %d" % score, 36)
	_title(box, "Best  %d" % best, 28, Color(1, 1, 1, 0.7))
	_button(box, "RETRY", func(): replay_pressed.emit())
	_button(box, "HOME", func(): home_pressed.emit())

## Simple modal shown while a (stubbed) rewarded ad "plays" in P1.
func show_fake_ad(on_done: Callable) -> void:
	var box := _new_overlay(0.9)
	_title(box, "[ AD ]", 56, Color(1, 1, 1, 0.85))
	_title(box, "rewarded ad playing…", 28, Color(1, 1, 1, 0.6))
	var tw := create_tween()
	tw.tween_interval(1.0)
	tw.tween_callback(on_done)

func clear_overlay() -> void:
	_clear_overlay()
