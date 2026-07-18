class_name DailyStreak
extends RefCounted
## Daily streak reward (E2, §R5). The first level clear each calendar day grants
## crate progress that ramps +1/+2/+3 and caps at +3, so a returning player is
## rewarded without any server or exploitable clock (the benefit is capped, and
## setting the clock forward only ever advances the date once per real day of
## play). Pure/testable — operates on a SaveManager-shaped dict.

const MAX_BONUS := 3

## Local day number for an ISO "YYYY-MM-DD" date (days since epoch). "" => far past.
static func _day_number(date: String) -> int:
	if date == "":
		return -100000
	var unix := Time.get_unix_time_from_datetime_string(date + "T00:00:00")
	return int(unix / 86400.0)

## Record a clear on `today` (ISO date). Returns the crate bonus to grant: 0 if a
## clear was already counted today, else min(streak, MAX_BONUS). Mutates data["streak"].
static func on_first_clear_today(data: Dictionary, today: String) -> int:
	var s: Dictionary = data["streak"]
	if String(s.get("date", "")) == today:
		return 0
	var gap := _day_number(today) - _day_number(String(s.get("date", "")))
	if gap == 1:
		s["count"] = int(s.get("count", 0)) + 1
	else:
		s["count"] = 1  # first ever, or a missed day breaks the streak
	s["date"] = today
	return mini(int(s["count"]), MAX_BONUS)
