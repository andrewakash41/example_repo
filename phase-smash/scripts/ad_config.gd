class_name AdConfig
extends Resource
## Ad placement policy + unit IDs as data (§9.2). Defaults use Google's public
## test ad units for the whole dev cycle; real IDs are injected via
## data/ad_config.tres at release (Andrew provides them, §12). Nothing else
## hardcodes ad IDs.

enum Placement {
	POST_LEVEL_INTERSTITIAL,  # 1
	REVIVE,                    # 2 rewarded, max 1/level
	CRATE_2X,                  # 3 rewarded, max 1/level
	BOOSTER_REFILL,            # 4 rewarded, daily-capped
	CRATE_BOOST,               # 5 rewarded, daily-capped
	BANNER,                    # off at launch
}

# --- Unit IDs (Google test defaults) ---------------------------------------
@export var use_test_ids: bool = true
@export var test_app_id: String = "ca-app-pub-3940256099942544~3347511713"
@export var test_interstitial_id: String = "ca-app-pub-3940256099942544/1033173712"
@export var test_rewarded_id: String = "ca-app-pub-3940256099942544/5224354917"
@export var test_banner_id: String = "ca-app-pub-3940256099942544/6300978111"
# Real IDs injected at release (leave blank until then).
@export var real_app_id: String = ""
@export var real_interstitial_id: String = ""
@export var real_rewarded_id: String = ""
@export var real_banner_id: String = ""

# --- Interstitial caps (§9.2) ----------------------------------------------
@export var interstitial_min_level: int = 4        # not before level 4 complete
@export var interstitial_min_interval_s: float = 90.0
@export var interstitial_min_level_gap: int = 1    # >=1 level since last
@export var rewarded_cooldown_s: float = 30.0      # no interstitial within 30s of a rewarded
@export var first_session_free_levels: int = 4     # §9.3

# --- Rewarded caps ----------------------------------------------------------
@export var daily_rewarded_cap: int = 6            # across placements 4-5

# --- Banner -----------------------------------------------------------------
@export var banner_enabled: bool = false           # code path exists, off (§9.2)

# --- Backoff (§9) -----------------------------------------------------------
@export var reload_backoff_min_s: float = 5.0
@export var reload_backoff_max_s: float = 60.0

func interstitial_id() -> String:
	return test_interstitial_id if use_test_ids else real_interstitial_id

func rewarded_id() -> String:
	return test_rewarded_id if use_test_ids else real_rewarded_id

func banner_id() -> String:
	return test_banner_id if use_test_ids else real_banner_id

func app_id() -> String:
	return test_app_id if use_test_ids else real_app_id

## Rewarded placements that draw down the shared daily cap (§9.2, rows 4-5).
static func counts_toward_daily(placement: int) -> bool:
	return placement == Placement.BOOSTER_REFILL or placement == Placement.CRATE_BOOST
