class_name Skins
extends RefCounted
## The 12 launch ball skins (§7.3), cosmetic only. Each defines a base look; the
## ball's phase color always tints it so readability survives. Skins are unlocked
## via crate shards (5 shards = a skin) or a jackpot.

class Skin:
	var id: String
	var name: String
	var base: Color        # albedo base, tinted by phase at runtime
	var metallic: float
	var emission_energy: float

static func _s(id: String, name: String, base: Color, metallic: float, emission: float) -> Skin:
	var sk := Skin.new()
	sk.id = id
	sk.name = name
	sk.base = base
	sk.metallic = metallic
	sk.emission_energy = emission
	return sk

static func all() -> Array:
	return [
		_s("default", "Comet", Color(1, 0.95, 0.9), 0.0, 0.9),
		_s("disco", "Disco", Color(0.9, 0.6, 1.0), 0.4, 1.1),
		_s("lava", "Lava Core", Color(1.0, 0.4, 0.1), 0.2, 1.4),
		_s("plasma", "Plasma", Color(0.5, 0.9, 1.0), 0.1, 1.3),
		_s("eyeball", "Eyeball", Color(0.95, 0.95, 0.95), 0.0, 0.4),
		_s("bubble", "Bubble", Color(0.7, 0.9, 1.0), 0.6, 0.8),
		_s("gold", "Gold Rush", Color(1.0, 0.84, 0.3), 0.9, 1.0),
		_s("void", "Void", Color(0.2, 0.1, 0.35), 0.5, 0.6),
		_s("mint", "Mint", Color(0.6, 1.0, 0.8), 0.1, 0.9),
		_s("ember", "Ember", Color(1.0, 0.5, 0.35), 0.2, 1.2),
		_s("frost", "Frost", Color(0.8, 0.95, 1.0), 0.3, 1.0),
		_s("neon", "Neon", Color(0.8, 1.0, 0.2), 0.1, 1.4),
		# v1.1 cosmetic depth (E6): 6 more to keep crates exciting for collectors.
		_s("magma", "Magma", Color(0.9, 0.25, 0.1), 0.3, 1.5),
		_s("aqua", "Aqua", Color(0.2, 0.7, 0.9), 0.5, 1.0),
		_s("rose", "Rose Quartz", Color(1.0, 0.6, 0.75), 0.4, 0.9),
		_s("obsidian", "Obsidian", Color(0.15, 0.15, 0.2), 0.8, 0.5),
		_s("solar", "Solar", Color(1.0, 0.9, 0.4), 0.6, 1.6),
		_s("nebula", "Nebula", Color(0.5, 0.3, 0.9), 0.3, 1.3),
	]

static func get_skin(id: String) -> Skin:
	for s in all():
		if s.id == id:
			return s
	return all()[0]

static func ids() -> Array:
	var out: Array = []
	for s in all():
		out.append(s.id)
	return out
