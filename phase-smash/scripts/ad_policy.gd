class_name AdPolicy
extends RefCounted
## Pure frequency-cap decisions (§9.2) — no plugin, no scene, no clock of its
## own. The caller passes the current state and config; these functions say yes
## or no. Kept pure so the caps are provably enforced by unit tests.

## Can a post-level interstitial show right now? `state` keys:
##   level_number, now, last_interstitial_time, last_interstitial_level,
##   last_rewarded_time, rewarded_watched_this_level,
##   is_first_session, levels_completed_this_session, consent_ok
static func can_show_interstitial(state: Dictionary, cfg: AdConfig) -> bool:
	if not bool(state.get("consent_ok", true)):
		return false
	# Not before level 4 complete.
	if int(state["level_number"]) < cfg.interstitial_min_level:
		return false
	# First-session protection (§9.3): no interstitials in the first session's
	# first N levels regardless of timing.
	if bool(state.get("is_first_session", false)) \
			and int(state.get("levels_completed_this_session", 0)) <= cfg.first_session_free_levels:
		return false
	# Skipped if a rewarded ad was watched this level.
	if bool(state.get("rewarded_watched_this_level", false)):
		return false
	# >=90s since the last interstitial.
	if float(state["now"]) - float(state.get("last_interstitial_time", -1e9)) < cfg.interstitial_min_interval_s:
		return false
	# >=1 level since the last interstitial.
	if int(state["level_number"]) - int(state.get("last_interstitial_level", -9999)) < cfg.interstitial_min_level_gap:
		return false
	# Never within 30s after any rewarded ad.
	if float(state["now"]) - float(state.get("last_rewarded_time", -1e9)) < cfg.rewarded_cooldown_s:
		return false
	return true

## Can a rewarded ad show for this placement? Per-level caps (revive, 2x crate)
## are enforced by the caller via one-shot flags; here we enforce the shared
## daily cap for the daily-counted placements.
static func can_show_rewarded(placement: int, daily_count: int, cfg: AdConfig, consent_ok: bool = true) -> bool:
	if not consent_ok:
		# Consent decline still allows ads (non-personalized), so rewarded is
		# fine; only a hard "no ads" state would block. Kept as a hook.
		pass
	if AdConfig.counts_toward_daily(placement):
		return daily_count < cfg.daily_rewarded_cap
	return true

## Rolls the daily counter over at date change. Returns the (possibly reset)
## daily dict. `today` is any stable day key (e.g. "2026-07-18").
static func rolled_daily(daily: Dictionary, today: String) -> Dictionary:
	if String(daily.get("date", "")) != today:
		return {"date": today, "rewarded_count": 0}
	return daily
