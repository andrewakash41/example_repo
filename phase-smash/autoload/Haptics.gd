extends Node
## Thin wrapper over Input.vibrate_handheld with per-shatter throttling and a
## global enable toggle (§6.3). Safe to call on desktop (no-ops there).

const LIGHT_MS := 12
const MEDIUM_MS := 25
const HEAVY_MS := 45
const MIN_INTERVAL_MS := 50  ## throttle rapid shatter ticks

var enabled: bool = true
var _last_ms: int = 0

func light() -> void:
	_buzz(LIGHT_MS, true)

func medium() -> void:
	_buzz(MEDIUM_MS, false)

func heavy() -> void:
	_buzz(HEAVY_MS, false)

func _buzz(duration_ms: int, throttled: bool) -> void:
	if not enabled:
		return
	var now := Time.get_ticks_msec()
	if throttled and now - _last_ms < MIN_INTERVAL_MS:
		return
	_last_ms = now
	Input.vibrate_handheld(duration_ms)
