class_name Themes
extends RefCounted
## The 5 visual themes that cycle every 10 levels (§6.4). Themes recolor the
## *ambience* only — sky gradient, ambient light, finish pad — never the
## semantic segment hues (amber/azure/obsidian stay readable in every theme).
## Boss levels get a darker grade applied on top by the game.

class Theme:
	var name: String
	var sky_top: Color
	var sky_horizon: Color
	var ground: Color
	var ambient: Color
	var finish: Color

static func _t(name: String, sky_top: Color, sky_horizon: Color, ground: Color, ambient: Color, finish: Color) -> Theme:
	var th := Theme.new()
	th.name = name
	th.sky_top = sky_top
	th.sky_horizon = sky_horizon
	th.ground = ground
	th.ambient = ambient
	th.finish = finish
	return th

static func get_theme(theme_id: int) -> Theme:
	var themes := [
		_t("Dusk Neon",
			Color(0.10, 0.05, 0.20), Color(0.35, 0.12, 0.30),
			Color(0.04, 0.02, 0.08), Color(0.55, 0.5, 0.65), Color(0.2, 0.95, 0.55)),
		_t("Deep Ocean",
			Color(0.02, 0.08, 0.16), Color(0.05, 0.22, 0.34),
			Color(0.01, 0.03, 0.06), Color(0.45, 0.55, 0.7), Color(0.3, 0.95, 0.8)),
		_t("Magma Core",
			Color(0.14, 0.04, 0.03), Color(0.4, 0.12, 0.04),
			Color(0.06, 0.02, 0.01), Color(0.7, 0.5, 0.4), Color(1.0, 0.85, 0.3)),
		_t("Violet Void",
			Color(0.09, 0.03, 0.16), Color(0.22, 0.06, 0.34),
			Color(0.03, 0.01, 0.06), Color(0.6, 0.5, 0.72), Color(0.7, 0.5, 1.0)),
		_t("Arctic Glow",
			Color(0.08, 0.12, 0.18), Color(0.2, 0.32, 0.42),
			Color(0.03, 0.05, 0.08), Color(0.6, 0.68, 0.78), Color(0.5, 0.95, 1.0)),
	]
	return themes[posmod(theme_id, themes.size())]
