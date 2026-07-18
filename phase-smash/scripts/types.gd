class_name PSTypes
extends RefCounted
## Shared enums + a few pure helpers used across gameplay. Kept dependency-free
## so tests and the harness bot can reason about segments without a scene tree.

## The ball is always in exactly one phase (§3.4).
enum Phase { A, B }

## Segment kinds on a platform (§3.3). GAP is empty space.
enum Seg { GAP, AMBER, AZURE, OBSIDIAN }

## The phase a colored segment belongs to. Obsidian/gap have no phase.
static func seg_phase(seg: int) -> int:
	match seg:
		Seg.AMBER: return Phase.A
		Seg.AZURE: return Phase.B
		_: return -1

static func other_phase(phase: int) -> int:
	return Phase.B if phase == Phase.A else Phase.A

## True if the ball in `phase` shatters `seg` when smashing (ignoring fever).
## Matching color only; gaps aren't "smashed", obsidian is death not a shatter.
static func is_matching(seg: int, phase: int) -> bool:
	return seg_phase(seg) == phase and seg != Seg.GAP

## True if smashing this segment in this phase is a hard bounce (opposite color).
static func is_opposite(seg: int, phase: int) -> bool:
	var sp := seg_phase(seg)
	return sp != -1 and sp != phase

## Phase-relative colors (semantic hues, §6.4 keeps these stable across themes).
const AMBER_COLOR := Color(1.0, 0.54, 0.12)
const AZURE_COLOR := Color(0.12, 0.78, 1.0)
const OBSIDIAN_COLOR := Color(0.06, 0.06, 0.09)
const OBSIDIAN_RIM := Color(1.0, 0.15, 0.2)

static func phase_color(phase: int) -> Color:
	return AMBER_COLOR if phase == Phase.A else AZURE_COLOR

static func seg_color(seg: int) -> Color:
	match seg:
		Seg.AMBER: return AMBER_COLOR
		Seg.AZURE: return AZURE_COLOR
		Seg.OBSIDIAN: return OBSIDIAN_COLOR
		_: return Color(0, 0, 0, 0)
