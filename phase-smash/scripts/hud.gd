class_name Hud
extends CanvasLayer
## P0 HUD: descent progress bar, score, a one-line control hint, and a simple
## level-clear panel. The real juiced HUD (fever bar, combo, safe-area, tweens)
## is a P3 job (§6.3, §10). Built in code so it diffs cleanly.

signal home_pressed
signal replay_pressed

var _progress: ProgressBar
var _score_label: Label
var _hint_label: Label
var _clear_panel: Control

func _ready() -> void:
	layer = 10

	_progress = ProgressBar.new()
	_progress.min_value = 0.0
	_progress.max_value = 1.0
	_progress.show_percentage = false
	_progress.custom_minimum_size = Vector2(0, 22)
	_progress.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_progress.offset_left = 40
	_progress.offset_right = -40
	_progress.offset_top = 60
	_progress.offset_bottom = 82
	add_child(_progress)

	_score_label = Label.new()
	_score_label.text = "0"
	_score_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_score_label.add_theme_font_size_override("font_size", 44)
	_score_label.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_score_label.offset_left = -260
	_score_label.offset_right = -40
	_score_label.offset_top = 100
	add_child(_score_label)

	_hint_label = Label.new()
	_hint_label.text = "HOLD to smash"
	_hint_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_hint_label.add_theme_font_size_override("font_size", 34)
	_hint_label.add_theme_color_override("font_color", Color(1, 1, 1, 0.7))
	_hint_label.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_hint_label.offset_left = -300
	_hint_label.offset_right = 300
	_hint_label.offset_top = -180
	add_child(_hint_label)

func set_progress(v: float) -> void:
	_progress.value = clampf(v, 0.0, 1.0)

func set_score(v: int) -> void:
	_score_label.text = str(v)

func hide_hint() -> void:
	_hint_label.visible = false

## Shows a minimal end panel. `title` is e.g. "LEVEL CLEAR" or "GAME OVER".
func show_end_panel(title: String, score: int) -> void:
	if _clear_panel:
		return
	_clear_panel = Control.new()
	_clear_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_clear_panel)

	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.55)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	_clear_panel.add_child(dim)

	var box := VBoxContainer.new()
	box.set_anchors_preset(Control.PRESET_CENTER)
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	box.add_theme_constant_override("separation", 28)
	_clear_panel.add_child(box)

	var title_label := Label.new()
	title_label.text = title
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title_label.add_theme_font_size_override("font_size", 64)
	box.add_child(title_label)

	var score_line := Label.new()
	score_line.text = "Score  %d" % score
	score_line.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	score_line.add_theme_font_size_override("font_size", 36)
	box.add_child(score_line)

	var replay := Button.new()
	replay.text = "REPLAY"
	replay.custom_minimum_size = Vector2(280, 96)
	replay.add_theme_font_size_override("font_size", 40)
	replay.pressed.connect(func(): replay_pressed.emit())
	box.add_child(replay)

	var home := Button.new()
	home.text = "HOME"
	home.custom_minimum_size = Vector2(280, 96)
	home.add_theme_font_size_override("font_size", 40)
	home.pressed.connect(func(): home_pressed.emit())
	box.add_child(home)
