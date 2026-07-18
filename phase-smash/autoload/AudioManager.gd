extends Node
## Music + SFX routing. P0: no-op skeleton so gameplay can call play_sfx()
## without caring whether audio exists yet. Real buses, loops, and the Fever
## intensity stem arrive in P3 (§6.5).

func play_sfx(_id: StringName) -> void:
	pass

func play_music(_id: StringName) -> void:
	pass

func set_music_enabled(_on: bool) -> void:
	pass

func set_sfx_enabled(_on: bool) -> void:
	pass
