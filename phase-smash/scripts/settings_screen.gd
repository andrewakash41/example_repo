extends Control
## Settings (§10): music / SFX / haptics / Lite FX toggles, credits + version.
## Writes straight to SaveManager and persists on each change.

var _router: Node

func set_router(router: Node) -> void:
	_router = router

func _ready() -> void:
	UIKit.fill_bg(self, Color(0.06, 0.04, 0.12))
	var box := UIKit.center_box(self, 18)
	box.add_child(UIKit.label("SETTINGS", 52, Color(0.9, 0.9, 1)))

	_toggle(box, "Music", "music")
	_toggle(box, "SFX", "sfx")
	_toggle(box, "Haptics", "haptics")
	_toggle(box, "Lite FX", "lite_fx")

	box.add_child(UIKit.label("Phase Smash — v0.4 (P4)", 22, Color(1, 1, 1, 0.5)))
	box.add_child(UIKit.label("Audio: CC0/CC-BY — see credits", 20, Color(1, 1, 1, 0.4)))
	box.add_child(UIKit.button("Back", 28, _on_back, Vector2(200, 72)))

func _toggle(box: VBoxContainer, label: String, key: String) -> void:
	var b := CheckButton.new()
	b.text = label
	b.button_pressed = bool(SaveManager.data["settings"].get(key, true))
	b.add_theme_font_size_override("font_size", 30)
	b.toggled.connect(_on_toggled.bind(key))
	box.add_child(b)

func _on_toggled(pressed: bool, key: String) -> void:
	SaveManager.data["settings"][key] = pressed
	match key:
		"music": AudioManager.set_music_enabled(pressed)
		"sfx": AudioManager.set_sfx_enabled(pressed)
		"haptics": Haptics.enabled = pressed
	SaveManager.save_game()
	if key != "music":
		AudioManager.play_sfx(&"ui_tap")

func _on_back() -> void:
	AudioManager.play_sfx(&"ui_tap")
	_router.go_to_home()
