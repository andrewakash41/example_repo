extends Node
## Music + SFX routing (§6.5). Streams are loaded lazily from res://assets/ if
## present and no-op gracefully when missing — so the code path is complete now
## and simply comes alive once CC0/CC-BY audio is dropped in. Respects the mute
## toggles persisted in SaveManager settings.

const SFX_DIR := "res://assets/sfx/"
const MUSIC_DIR := "res://assets/music/"
const SFX_POOL := 6

## Known SFX ids (§6.5). Files are <id>.ogg under assets/sfx/.
const SFX_IDS := [
	&"shatter", &"phase_flip", &"hard_bounce", &"death",
	&"fever", &"level_clear", &"ui_tap", &"crate_open",
]

## SFX that get a small random pitch spread so repeats don't sound machine-gunned
## (§6.5): shatter especially fires in fast Fever chains.
const PITCH_VARIED := {
	&"shatter": Vector2(0.92, 1.12),
	&"hard_bounce": Vector2(0.96, 1.05),
}

var _sfx_players: Array[AudioStreamPlayer] = []
var _sfx_next := 0
var _music: AudioStreamPlayer
var _fever_layer: AudioStreamPlayer   # additive Fever stem, mixed over _music (§6.5)
var _cache: Dictionary = {}

func _ready() -> void:
	for i in SFX_POOL:
		var p := AudioStreamPlayer.new()
		p.bus = "Master"
		add_child(p)
		_sfx_players.append(p)
	_music = AudioStreamPlayer.new()
	_music.bus = "Master"
	add_child(_music)
	_fever_layer = AudioStreamPlayer.new()
	_fever_layer.bus = "Master"
	_fever_layer.volume_db = -60.0  # silent until Fever fades it in
	add_child(_fever_layer)

func _sfx_enabled() -> bool:
	return bool(SaveManager.data["settings"].get("sfx", true))

func _music_enabled() -> bool:
	return bool(SaveManager.data["settings"].get("music", true))

func _load(path: String) -> AudioStream:
	if _cache.has(path):
		return _cache[path]
	var stream: AudioStream = null
	if ResourceLoader.exists(path):
		stream = load(path)
	_cache[path] = stream
	return stream

func play_sfx(id: StringName) -> void:
	if not _sfx_enabled():
		return
	var stream := _load(SFX_DIR + str(id) + ".ogg")
	if stream == null:
		return
	var p := _sfx_players[_sfx_next]
	_sfx_next = (_sfx_next + 1) % _sfx_players.size()
	p.stream = stream
	if PITCH_VARIED.has(id):
		var r: Vector2 = PITCH_VARIED[id]
		p.pitch_scale = randf_range(r.x, r.y)
	else:
		p.pitch_scale = 1.0
	p.play()

func play_music(id: StringName) -> void:
	var stream := _load(MUSIC_DIR + str(id) + ".ogg")
	if stream == null:
		return
	_music.stream = stream
	_music.play()
	_music.stream_paused = not _music_enabled()
	# Start the fever stem in lock-step (silent) so it's phase-aligned with the
	# base loop; Fever just rides its volume up (§6.5).
	var fever_stream := _load(MUSIC_DIR + "fever.ogg")
	if fever_stream:
		_fever_layer.stream = fever_stream
		_fever_layer.volume_db = -60.0
		_fever_layer.play()
		_fever_layer.stream_paused = not _music_enabled()

func stop_music() -> void:
	_music.stop()
	_fever_layer.stop()

## Fade the additive Fever stem in/out (§6.5). No-ops cleanly when no fever.ogg
## was sourced — the base music simply keeps playing.
func set_fever_layer(active: bool) -> void:
	if _fever_layer.stream == null:
		return
	var target := -6.0 if active else -60.0
	var tw := create_tween()
	tw.tween_property(_fever_layer, "volume_db", target, 0.35)

func set_music_enabled(on: bool) -> void:
	SaveManager.data["settings"]["music"] = on
	if _music.playing:
		_music.stream_paused = not on
	if _fever_layer.playing:
		_fever_layer.stream_paused = not on

func set_sfx_enabled(on: bool) -> void:
	SaveManager.data["settings"]["sfx"] = on
