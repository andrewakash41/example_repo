class_name UIKit
extends RefCounted
## Tiny helpers so the code-built screens stay short and consistent. Real visual
## theming (fonts, nine-patches) is a later polish pass; these keep P4 functional.

static func fill_bg(parent: Control, color: Color) -> void:
	var bg := ColorRect.new()
	bg.color = color
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(bg)

## Vertical dark gradient background (D1). `top` fades to `bottom` down the screen,
## for depth instead of a flat fill. Cheap (one GradientTexture2D).
static func fill_gradient(parent: Control, top: Color, bottom: Color) -> void:
	var grad := Gradient.new()
	grad.set_color(0, top)
	grad.set_color(1, bottom)
	var tex := GradientTexture2D.new()
	tex.gradient = grad
	tex.fill_from = Vector2(0, 0)
	tex.fill_to = Vector2(0, 1)
	var tr := TextureRect.new()
	tr.texture = tex
	tr.stretch_mode = TextureRect.STRETCH_SCALE
	tr.set_anchors_preset(Control.PRESET_FULL_RECT)
	tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(tr)

static func center_box(parent: Control, separation: int = 24) -> VBoxContainer:
	var box := VBoxContainer.new()
	box.set_anchors_preset(Control.PRESET_CENTER)
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	box.add_theme_constant_override("separation", separation)
	parent.add_child(box)
	return box

static func label(text: String, size: int, color: Color = Color.WHITE) -> Label:
	var l := Label.new()
	l.text = text
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	return l

static func button(text: String, size: int, cb: Callable, min_size := Vector2(300, 92)) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = min_size
	b.add_theme_font_size_override("font_size", size)
	b.pressed.connect(cb)
	return b
