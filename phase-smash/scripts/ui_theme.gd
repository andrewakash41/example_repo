class_name UITheme
extends RefCounted
## One Godot Theme for every screen (C4 / D1). Replaces the per-widget
## add_theme_*_override scatter with a single neon look — rounded StyleBoxFlat
## buttons with a phase-colored glow border, consistent font sizes and colors,
## 8-pt spacing. Applied at each screen's root Control in main._swap so the whole
## tree inherits it. Built in code (no .tres) so it diffs cleanly and can key off
## PSTypes colors. A custom OFL font can be dropped in via `FONT_PATH` later
## (D1 font embedding is the one asset still to source).

const ACCENT := Color(1.0, 0.54, 0.12)      # amber brand accent
const ACCENT_2 := Color(0.12, 0.78, 1.0)    # azure secondary
const INK := Color(0.93, 0.93, 0.98)
const INK_DIM := Color(1, 1, 1, 0.6)
const PANEL := Color(0.10, 0.08, 0.17)
const FONT_PATH := "res://assets/fonts/ui.ttf"  # optional; used if present

static func get_theme() -> Theme:
	var t := Theme.new()

	var font: Font = null
	if ResourceLoader.exists(FONT_PATH):
		font = load(FONT_PATH)
	if font:
		t.default_font = font
	t.default_font_size = 30

	_style_buttons(t)
	_style_labels(t)
	_style_checkbuttons(t)
	return t

static func _btn_box(bg: Color, border: Color, border_w: int) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.set_corner_radius_all(18)
	sb.set_border_width_all(border_w)
	sb.border_color = border
	sb.set_content_margin_all(10)
	# Soft neon glow around the button.
	sb.shadow_color = Color(border.r, border.g, border.b, 0.35)
	sb.shadow_size = 8
	return sb

static func _style_buttons(t: Theme) -> void:
	var normal := _btn_box(Color(0.16, 0.13, 0.26), ACCENT, 2)
	var hover := _btn_box(Color(0.22, 0.18, 0.34), ACCENT, 3)
	var pressed := _btn_box(Color(0.12, 0.10, 0.20), ACCENT_2, 3)
	var disabled := _btn_box(Color(0.12, 0.11, 0.16), Color(1, 1, 1, 0.12), 1)
	t.set_stylebox("normal", "Button", normal)
	t.set_stylebox("hover", "Button", hover)
	t.set_stylebox("pressed", "Button", pressed)
	t.set_stylebox("disabled", "Button", disabled)
	t.set_stylebox("focus", "Button", _btn_box(Color(0, 0, 0, 0), ACCENT, 2))
	t.set_color("font_color", "Button", INK)
	t.set_color("font_hover_color", "Button", Color.WHITE)
	t.set_color("font_pressed_color", "Button", ACCENT_2)
	t.set_color("font_disabled_color", "Button", Color(1, 1, 1, 0.35))
	t.set_font_size("font_size", "Button", 32)

static func _style_labels(t: Theme) -> void:
	t.set_color("font_color", "Label", INK)
	t.set_font_size("font_size", "Label", 30)

static func _style_checkbuttons(t: Theme) -> void:
	t.set_color("font_color", "CheckButton", INK)
	t.set_color("font_pressed_color", "CheckButton", ACCENT)
	t.set_font_size("font_size", "CheckButton", 28)
