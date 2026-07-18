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

var _sfx_players: Array[AudioStreamPlayer] = []
var _sfx_next := 0
var _music: AudioStreamPlayer
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
	p.play()

func play_music(id: StringName) -> void:
	var stream := _load(MUSIC_DIR + str(id) + ".ogg")
	if stream == null:
		return
	_music.stream = stream
	_music.play()
	_music.stream_paused = not _music_enabled()

func set_music_enabled(on: bool) -> void:
	SaveManager.data["settings"]["music"] = on
	if _music.playing:
		_music.stream_paused = not on

func set_sfx_enabled(on: bool) -> void:
	SaveManager.data["settings"]["sfx"] = on
