extends Control
## Settings (§10): music / SFX / haptics / Lite FX toggles, credits + version.
## Writes straight to SaveManager and persists on each change.

var _router: Node

func set_router(router: Node) -> void:
	_router = router

func on_back_requested() -> void:
	_router.go_to_home()

func _ready() -> void:
	UIKit.fill_gradient(self, Color(0.10, 0.06, 0.20), Color(0.03, 0.02, 0.07))
	var box := UIKit.center_box(self, 18)
	box.add_child(UIKit.label(Strings.t("settings_title"), 52, Color(0.9, 0.9, 1)))

	_toggle(box, Strings.t("settings_music"), "music")
	_toggle(box, Strings.t("settings_sfx"), "sfx")
	_toggle(box, Strings.t("settings_haptics"), "haptics")
	_toggle(box, Strings.t("settings_lite_fx"), "lite_fx")

	# Remove Ads IAP (E1): show the purchase button until owned, then a status line.
	if AdManager.has_remove_ads():
		box.add_child(UIKit.label("✓ Ads removed — thank you!", 24, Color(0.4, 1, 0.6)))
	else:
		box.add_child(UIKit.button("Remove Ads  %s" % AdManager.REMOVE_ADS_PRICE, 26, _on_remove_ads, Vector2(340, 70)))
		box.add_child(UIKit.button("Restore purchases", 22, _on_restore, Vector2(300, 60)))

	# Privacy options — re-open the UMP consent form (§9.1).
	box.add_child(UIKit.button(Strings.t("settings_privacy"), 26, _on_privacy, Vector2(300, 70)))

	var version := str(ProjectSettings.get_setting("application/config/version", "0.0"))
	box.add_child(UIKit.label(Strings.f("settings_version", [version]), 22, Color(1, 1, 1, 0.5)))
	box.add_child(UIKit.label(Strings.t("settings_audio_credit"), 20, Color(1, 1, 1, 0.4)))
	box.add_child(UIKit.button(Strings.t("btn_back"), 28, _on_back, Vector2(200, 72)))

func _on_privacy() -> void:
	AudioManager.play_sfx(&"ui_tap")
	AdManager.show_privacy_options()

func _on_remove_ads() -> void:
	AudioManager.play_sfx(&"ui_tap")
	AdManager.purchase_remove_ads(_rebuild)

func _on_restore() -> void:
	AudioManager.play_sfx(&"ui_tap")
	AdManager.restore_purchases()

## Rebuild the screen so the Remove Ads control reflects the new entitlement.
func _rebuild() -> void:
	_router.go_to_settings()

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
