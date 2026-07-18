extends Node
## AdMob + UMP consent facade. P0: pure stub that always reports "no ad ready"
## so revive/crate UI can be wired now and correctly hide buttons that can't
## work (§3.6). Real plugin, test IDs, consent flow, and frequency caps: P5 (§9).

## Package identifier is the single source of truth for the app id (§2, §13).
## Kept here so nothing else hardcodes the name.
const APPLICATION_ID := "com.andrew.phasesmash"

func is_interstitial_ready() -> bool:
	return false

func is_rewarded_ready() -> bool:
	return false

## Returns false immediately when nothing is loaded; callers must treat a false
## return as "ad unavailable" and never block gameplay on it.
func show_interstitial() -> bool:
	return false

func show_rewarded(_on_reward: Callable) -> bool:
	return false
