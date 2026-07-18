extends Node
## AdMob + UMP consent facade (§9). Owns consent, preload/backoff, the frequency
## caps (via AdPolicy), and the placement flows. The real poing-studios AdMob
## plugin is integrated behind `_has_plugin()`; when it's absent (desktop/editor,
## or this build environment) every call degrades to a silent stub so gameplay is
## never blocked and offline play is fully functional. Google TEST ad units are
## used until real IDs are injected via data/ad_config.tres (§12).

signal consent_updated
## Emitted whenever rewarded/interstitial readiness may have changed, so UI can
## hide/show ad-gated buttons live instead of showing a button that can't work
## (§3.6 applied everywhere, B14).
signal ad_availability_changed

## Package identifier — the single source of truth for the app id (§2, §13).
const APPLICATION_ID := "com.andrew.phasesmash"
const CONFIG_PATH := "res://data/ad_config.tres"

var config: AdConfig

# Session (in-memory) state
var _rewarded_this_level := false
var _levels_completed_session := 0
var _is_first_session := false

# Load state (a real plugin updates these on load/close/fail).
var _interstitial_ready := true
var _rewarded_ready := true
var _interstitial_backoff := 0.0
var _rewarded_backoff := 0.0

func _ready() -> void:
	config = load(CONFIG_PATH) if ResourceLoader.exists(CONFIG_PATH) else AdConfig.new()
	_init_session()
	_init_plugin()

func _init_session() -> void:
	var ads: Dictionary = SaveManager.data["ads"]
	ads["sessions_started"] = int(ads.get("sessions_started", 0)) + 1
	_is_first_session = int(ads["sessions_started"]) == 1
	SaveManager.save_game()

# --- Consent (UMP) ----------------------------------------------------------

func consent_ok() -> bool:
	# Both "obtained" and "declined" allow ads; declined => non-personalized.
	# Only an unset status before the flow completes withholds ads.
	return String(SaveManager.data["ads"].get("consent_status", "")) != ""

## Requests consent on first launch (EEA/UK via UMP). Stub obtains it directly
## when the plugin is absent. Safe to call every launch — it no-ops once set.
func request_consent(on_done := Callable()) -> void:
	if consent_ok():
		if on_done.is_valid():
			on_done.call()
		return
	if _has_plugin():
		_plugin_request_consent(on_done)   # real UMP form
		return
	_set_consent("obtained")
	if on_done.is_valid():
		on_done.call()

## Re-opens the privacy options form (Settings entry, §9.1).
func show_privacy_options() -> void:
	if _has_plugin():
		_plugin_show_privacy_options()

func _set_consent(status: String) -> void:
	SaveManager.data["ads"]["consent_status"] = status
	SaveManager.save_game()
	consent_updated.emit()
	# Consent gates every placement, so readiness effectively just changed (B14).
	ad_availability_changed.emit()

# --- Per-run notifications --------------------------------------------------

func notify_level_started() -> void:
	_rewarded_this_level = false

func notify_level_completed() -> void:
	_levels_completed_session += 1

# --- Readiness --------------------------------------------------------------

func is_interstitial_ready() -> bool:
	return _interstitial_ready and consent_ok()

func is_rewarded_ready() -> bool:
	return _rewarded_ready and consent_ok()

# --- Interstitial (post-level) ---------------------------------------------

## Shows a post-level interstitial if every §9.2 cap allows it, then calls
## `on_done`. Always calls `on_done` exactly once (fail-silent).
func maybe_show_interstitial(level_number: int, on_done: Callable) -> void:
	var ads: Dictionary = SaveManager.data["ads"]
	var state := {
		"level_number": level_number,
		"now": Time.get_unix_time_from_system(),
		"last_interstitial_time": float(ads["last_interstitial_time"]),
		"last_interstitial_level": int(ads["last_interstitial_level"]),
		"last_rewarded_time": float(ads["last_rewarded_time"]),
		"rewarded_watched_this_level": _rewarded_this_level,
		"is_first_session": _is_first_session,
		"levels_completed_this_session": _levels_completed_session,
		"consent_ok": consent_ok(),
	}
	if not is_interstitial_ready() or not AdPolicy.can_show_interstitial(state, config):
		on_done.call()
		return
	_present_interstitial(_finish_interstitial.bind(level_number, float(state["now"]), on_done))

func _finish_interstitial(level_number: int, now: float, on_done: Callable) -> void:
	var ads: Dictionary = SaveManager.data["ads"]
	ads["last_interstitial_time"] = now
	ads["last_interstitial_level"] = level_number
	SaveManager.save_game()
	_reload_interstitial()
	on_done.call()

# --- Rewarded ---------------------------------------------------------------

## Shows a rewarded ad for `placement`. Calls `on_reward` only if the reward is
## earned; `on_fail` (optional) if it can't show (capped/unavailable/offline).
## Per-level caps (revive, 2x crate) are enforced by the caller's own one-shot
## flags; the shared daily cap is enforced here (§9.2).
func show_rewarded(placement: int, on_reward: Callable, on_fail := Callable()) -> void:
	var daily := _rolled_daily()
	if not is_rewarded_ready() or not AdPolicy.can_show_rewarded(placement, int(daily["rewarded_count"]), config):
		if on_fail.is_valid():
			on_fail.call()
		return
	_present_rewarded(_finish_rewarded.bind(placement, on_reward))

func _finish_rewarded(placement: int, on_reward: Callable) -> void:
	var ads: Dictionary = SaveManager.data["ads"]
	ads["last_rewarded_time"] = Time.get_unix_time_from_system()
	_rewarded_this_level = true
	if AdConfig.counts_toward_daily(placement):
		var daily := _rolled_daily()
		daily["rewarded_count"] = int(daily["rewarded_count"]) + 1
		SaveManager.data["daily"] = daily
	SaveManager.save_game()
	_reload_rewarded()
	on_reward.call()

func _rolled_daily() -> Dictionary:
	var d := AdPolicy.rolled_daily(SaveManager.data["daily"], Time.get_date_string_from_system())
	SaveManager.data["daily"] = d
	return d

# --- Presentation (stub vs plugin) -----------------------------------------

func _present_interstitial(after: Callable) -> void:
	if _has_plugin():
		_plugin_show_interstitial(after)
		return
	# Stub: a brief beat, no real full-screen (nothing to block gameplay).
	get_tree().create_timer(0.4).timeout.connect(after)

func _present_rewarded(after: Callable) -> void:
	if _has_plugin():
		_plugin_show_rewarded(after)
		return
	# Stub: grant the reward after a short "watch" beat.
	get_tree().create_timer(0.8).timeout.connect(after)

# --- Preload + exponential backoff (§9) ------------------------------------

func _reload_interstitial() -> void:
	if _has_plugin():
		_set_interstitial_ready(false)
		_plugin_load_interstitial()
	# Stub keeps it "ready".

func _reload_rewarded() -> void:
	if _has_plugin():
		_set_rewarded_ready(false)
		_plugin_load_rewarded()

## Readiness setters emit ad_availability_changed only on a real transition (B14).
func _set_rewarded_ready(v: bool) -> void:
	if v == _rewarded_ready:
		return
	_rewarded_ready = v
	ad_availability_changed.emit()

func _set_interstitial_ready(v: bool) -> void:
	if v == _interstitial_ready:
		return
	_interstitial_ready = v
	ad_availability_changed.emit()

func next_backoff(current: float) -> float:
	# 5s -> 60s exponential (pure, testable).
	if current <= 0.0:
		return config.reload_backoff_min_s
	return minf(current * 2.0, config.reload_backoff_max_s)

# --- Plugin integration hooks (poing-studios AdMob) -------------------------
# These are the only spots that touch the plugin. They are inert until the
# plugin ships in the Android build; wire them to its API at that point (§9.1).

func _has_plugin() -> bool:
	return false  # becomes: Engine.has_singleton("AdMob") on Android

func _init_plugin() -> void:
	if not _has_plugin():
		return
	# _plugin.initialize(config.app_id(), use test device ids in dev)
	# then load interstitial + one rewarded, request consent.
	pass

func _plugin_request_consent(_on_done: Callable) -> void: pass
func _plugin_show_privacy_options() -> void: pass
func _plugin_show_interstitial(_after: Callable) -> void: pass
func _plugin_show_rewarded(_after: Callable) -> void: pass
func _plugin_load_interstitial() -> void: pass
func _plugin_load_rewarded() -> void: pass
