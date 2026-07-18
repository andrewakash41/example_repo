extends Node
## AdMob + UMP consent facade (§9). Owns consent, preload/backoff, the frequency
## caps (via AdPolicy), and the placement flows. The real poing-studios AdMob
## plugin is integrated behind `_has_plugin()`; when it's absent (desktop/editor,
## or this build environment) every call degrades to a silent stub so gameplay is
## never blocked and offline play is fully functional. Google TEST ad units are
## used until real IDs are injected via data/ad_config.tres (§12).

signal consent_updated
## Emitted when an entitlement changes (Remove Ads purchased/restored, E1).
signal purchases_updated
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
	# Remove Ads IAP (E1): entitled players never see interstitials. Rewarded ads
	# stay available — players opt into those for boosters/revives.
	if has_remove_ads():
		on_done.call()
		return
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

# --- Load-result callbacks + backoff retry (R4) ----------------------------
# The real plugin connects its load-success / load-failure signals to these in
# _init_plugin. On failure we retry after an exponential backoff (next_backoff,
# previously dead code, B18) so a flaky/offline network self-heals; on success
# the backoff resets. All time-based, so it's inert under the desktop stub.

func _on_interstitial_loaded() -> void:
	_interstitial_backoff = 0.0
	_set_interstitial_ready(true)

func _on_interstitial_failed() -> void:
	_set_interstitial_ready(false)
	_interstitial_backoff = next_backoff(_interstitial_backoff)
	get_tree().create_timer(_interstitial_backoff).timeout.connect(_reload_interstitial)

func _on_rewarded_loaded() -> void:
	_rewarded_backoff = 0.0
	_set_rewarded_ready(true)

func _on_rewarded_failed() -> void:
	_set_rewarded_ready(false)
	_rewarded_backoff = next_backoff(_rewarded_backoff)
	get_tree().create_timer(_rewarded_backoff).timeout.connect(_reload_rewarded)

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

# --- Remove Ads IAP (E1) ----------------------------------------------------
# One-time non-consumable that removes interstitials only. Entitlement is stored
# in the save file and re-verified on restore. Google Play Billing is behind a
# _has_billing() seam exactly like the ad plugin; on desktop/editor the stub
# grants immediately so the flow is testable without a store.

const REMOVE_ADS_SKU := "remove_ads"
const REMOVE_ADS_PRICE := "$2.99"  # display-only default; the store is source of truth

func has_remove_ads() -> bool:
	return bool(SaveManager.data["entitlements"].get("remove_ads", false))

func purchase_remove_ads(on_done := Callable()) -> void:
	if has_remove_ads():
		if on_done.is_valid():
			on_done.call()
		return
	if _has_billing():
		_billing_purchase(REMOVE_ADS_SKU, on_done)
		return
	# Desktop/editor stub: grant so the UI can be exercised (no real charge exists).
	_grant_remove_ads()
	if on_done.is_valid():
		on_done.call()

func restore_purchases() -> void:
	if _has_billing():
		_billing_restore()

func _grant_remove_ads() -> void:
	SaveManager.data["entitlements"]["remove_ads"] = true
	SaveManager.save_game()
	purchases_updated.emit()

func _has_billing() -> bool:
	return Engine.has_singleton("GodotGooglePlayBilling")

func _billing() -> Object:
	return Engine.get_singleton("GodotGooglePlayBilling") if _has_billing() else null

func _billing_purchase(sku: String, _on_done: Callable) -> void:
	var b := _billing()
	if b:
		b.call("purchase", sku)   # entitlement is granted in the purchase callback

func _billing_restore() -> void:
	var b := _billing()
	if b:
		b.call("queryPurchases", "inapp")

## Wire in _init_plugin on Android: on a validated purchase / restored entitlement
## for REMOVE_ADS_SKU, call this to persist and broadcast it.
func _on_billing_purchase_confirmed(sku: String) -> void:
	if sku == REMOVE_ADS_SKU:
		_grant_remove_ads()

# --- Plugin integration hooks (poing-studios AdMob) -------------------------
# These are the only spots that touch the plugin. They are inert until the
# plugin ships in the Android build; wire them to its API at that point (§9.1).

## The poing-studios AdMob plugin registers an "AdMob" singleton on Android. Its
## exact signal/method names must be confirmed against the plugin version that
## supports Godot 4.3 at integration time (handoff §2 fallback rule); the shape
## below mirrors that plugin's documented API. Everything is guarded by this
## check, so desktop/editor/CI never touch it.
func _has_plugin() -> bool:
	return Engine.has_singleton("AdMob")

func _plugin() -> Object:
	return Engine.get_singleton("AdMob") if _has_plugin() else null

func _init_plugin() -> void:
	var p := _plugin()
	if p == null:
		return
	# Connect load-result signals to the backoff/retry state machine, then bring
	# up the SDK with test device ids in dev and preload one of each format.
	if p.has_signal("interstitial_loaded"):
		p.connect("interstitial_loaded", _on_interstitial_loaded)
	if p.has_signal("interstitial_failed_to_load"):
		p.connect("interstitial_failed_to_load", _on_interstitial_failed)
	if p.has_signal("rewarded_ad_loaded"):
		p.connect("rewarded_ad_loaded", _on_rewarded_loaded)
	if p.has_signal("rewarded_ad_failed_to_load"):
		p.connect("rewarded_ad_failed_to_load", _on_rewarded_failed)
	p.call("initialize")
	_set_interstitial_ready(false)
	_set_rewarded_ready(false)
	_plugin_load_interstitial()
	_plugin_load_rewarded()

func _plugin_request_consent(on_done: Callable) -> void:
	var p := _plugin()
	if p == null:
		if on_done.is_valid():
			on_done.call()
		return
	# UMP form; on completion mark consent and continue. The plugin reports the
	# obtained/declined status via a signal — treat any completion as consent-set.
	if p.has_signal("consent_form_dismissed") and not p.is_connected("consent_form_dismissed", _on_consent_done):
		p.connect("consent_form_dismissed", _on_consent_done.bind(on_done))
	p.call("request_consent_info_update")

func _on_consent_done(on_done: Callable) -> void:
	_set_consent("obtained")
	if on_done.is_valid():
		on_done.call()

func _plugin_show_privacy_options() -> void:
	var p := _plugin()
	if p:
		p.call("show_privacy_options_form")

func _plugin_show_interstitial(after: Callable) -> void:
	var p := _plugin()
	if p == null:
		after.call()
		return
	if p.has_signal("interstitial_closed") and not p.is_connected("interstitial_closed", after):
		p.connect("interstitial_closed", after, CONNECT_ONE_SHOT)
	p.call("show_interstitial_ad")

func _plugin_show_rewarded(after: Callable) -> void:
	var p := _plugin()
	if p == null:
		after.call()
		return
	# Only fire `after` (the reward grant) on the user-earned-reward signal, never
	# on a plain close, so a skipped ad doesn't pay out.
	if p.has_signal("rewarded_ad_user_earned_reward") and not p.is_connected("rewarded_ad_user_earned_reward", after):
		p.connect("rewarded_ad_user_earned_reward", after, CONNECT_ONE_SHOT)
	p.call("show_rewarded_ad")

func _plugin_load_interstitial() -> void:
	var p := _plugin()
	if p:
		p.call("load_interstitial_ad", config.interstitial_id())

func _plugin_load_rewarded() -> void:
	var p := _plugin()
	if p:
		p.call("load_rewarded_ad", config.rewarded_id())
