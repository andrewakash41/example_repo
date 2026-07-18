class_name SimParams
extends RefCounted
## Single source of truth for the physics/interaction constants shared by the
## live game (`game.gd`) and the headless harness bot (`harness_bot.gd`) (C1).
## Previously these ~15 values were duplicated "with a sync note", and that drift
## is exactly what produced B9/B13. Both sides now alias these, so the bot's
## fidelity — which is what makes difficulty tuning trustworthy — can't silently
## diverge from the game.

const PLATFORM_GAP := 0.9
const PLATFORM_THICKNESS := 0.25
const BALL_RADIUS := 0.35

const SMASH_ACCEL := 150.0
const SMASH_TERMINAL := 22.0
const GRAVITY_IDLE := 40.0
const IDLE_BOUNCE_HEIGHT := 1.0
const HARD_BOUNCE_GAPS := 1.5
const START_DROP_GAPS := 3.0

const INPUT_LOCK := 0.2
const FEVER_GRACE := 1.5
const BOSS_BAND_SIZE := 5
