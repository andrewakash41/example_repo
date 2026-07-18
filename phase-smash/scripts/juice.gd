class_name Juice
extends RefCounted
## Builders for the GPUParticles3D systems (§6.2/§6.3): ball trail, fever flame,
## and level-clear confetti. Screen shake + hit-stop live in game.gd. Kept to a
## conservative particle-property set; amounts halve under Lite FX. These are
## additive polish — an editor pass should confirm the look.

static func _billboard_mesh(size: float) -> QuadMesh:
	var q := QuadMesh.new()
	q.size = Vector2(size, size)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.albedo_color = Color(1, 1, 1, 1)
	m.vertex_color_use_as_albedo = true
	q.material = m
	return q

static func make_trail(color: Color, lite: bool) -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.amount = 12 if lite else 24
	p.lifetime = 0.35
	p.local_coords = false
	p.draw_pass_1 = _billboard_mesh(0.28)
	var pm := ParticleProcessMaterial.new()
	pm.gravity = Vector3.ZERO
	pm.direction = Vector3(0, 1, 0)
	pm.spread = 18.0
	pm.initial_velocity_min = 0.0
	pm.initial_velocity_max = 0.4
	pm.scale_min = 0.5
	pm.scale_max = 0.9
	pm.color = color
	p.process_material = pm
	p.emitting = true
	return p

static func make_fever_flame(lite: bool) -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.amount = 20 if lite else 40
	p.lifetime = 0.45
	p.local_coords = false
	p.draw_pass_1 = _billboard_mesh(0.4)
	var pm := ParticleProcessMaterial.new()
	pm.gravity = Vector3(0, 3.0, 0)
	pm.direction = Vector3(0, 1, 0)
	pm.spread = 25.0
	pm.initial_velocity_min = 1.0
	pm.initial_velocity_max = 2.5
	pm.scale_min = 0.6
	pm.scale_max = 1.2
	pm.color = Color(1.0, 0.6, 0.2)
	p.process_material = pm
	p.emitting = false
	return p

static func make_confetti(lite: bool) -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.amount = 40 if lite else 90
	p.lifetime = 1.6
	p.one_shot = true
	p.explosiveness = 0.9
	p.local_coords = false
	p.draw_pass_1 = _billboard_mesh(0.22)
	var pm := ParticleProcessMaterial.new()
	pm.gravity = Vector3(0, -6.0, 0)
	pm.direction = Vector3(0, 1, 0)
	pm.spread = 180.0
	pm.initial_velocity_min = 4.0
	pm.initial_velocity_max = 8.0
	pm.scale_min = 0.5
	pm.scale_max = 1.0
	pm.angular_velocity_min = -400.0
	pm.angular_velocity_max = 400.0
	pm.color = Color(1.0, 0.9, 0.4)
	p.process_material = pm
	p.emitting = false
	return p
