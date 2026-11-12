"""Build the Kaelis Labs ghosts: a real sheet draped over a mannequin with Blender's cloth solver.
Four characters, four bodies, four poses, so each silhouette reads on its own.

Run (headless), once per character:
  "C:/Program Files/Blender Foundation/Blender 4.0/blender.exe" -b -P tools/3d/ghost_cloth.py -- <assayer|archivist|broker|smith> [preview_dir]

Output: site/models/ghost-<name>.raw.glb (compress with `gltf-transform meshopt` into ghost-<name>.glb).
Conventions: 1 unit = 1 m, the floor is z = 0, the ghost faces Blender +Y (glTF -Z).
The sheet keeps the planar UVs of the flat cloth (GRID metres across; the site frays the hem with them) and
carries baked ambient occlusion in its vertex colours. Eyes and mouth are cut per pixel on the site, around the
head centre printed at the end (copy it into GHOSTS in site/index.html).
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector, noise

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
NAME = ARGS[0] if ARGS else "assayer"
PREVIEW = ARGS[1] if len(ARGS) > 1 else None
OUT = os.path.join(ROOT, "site", "models", "ghost-%s.raw.glb" % NAME)
FRAMES = 110
GRID = 3.4

# head = (centre, radii); spheres = extra body masses (centre, radii); arms = (shoulder, hand) per side
VARIANTS = {
    # tall and thin, leaning in to look
    "assayer": dict(head=((0, 0.10, 1.70), (0.17, 0.19, 0.21)), radius=1.62, bend=0.05, mass=0.2,
                    spheres=[((0, 0.06, 1.50), (0.08, 0.08, 0.13)), ((0, 0.03, 1.34), (0.2, 0.13, 0.19))],
                    arms=[((-0.19, 0.04, 1.37), (-0.2, 0.30, 1.13)), ((0.19, 0.04, 1.37), (0.2, 0.30, 1.13))]),
    # short, wide and hunched over its papers
    "archivist": dict(head=((0, 0.20, 1.26), (0.2, 0.21, 0.22)), radius=1.34, bend=0.07, mass=0.2,
                      spheres=[((0, 0.10, 1.10), (0.1, 0.1, 0.12)), ((0, 0.0, 0.98), (0.31, 0.2, 0.22)), ((0, -0.14, 1.12), (0.22, 0.2, 0.2))],
                      arms=[((-0.27, 0.05, 1.0), (-0.2, 0.36, 0.86)), ((0.27, 0.05, 1.0), (0.2, 0.36, 0.86))]),
    # upright, one arm held out in front, pointing
    "broker": dict(head=((0, 0.0, 1.56), (0.185, 0.2, 0.215)), radius=1.5, bend=0.05, mass=0.2,
                   spheres=[((0, 0, 1.36), (0.09, 0.09, 0.13)), ((0, 0, 1.2), (0.225, 0.14, 0.2))],
                   arms=[((-0.21, 0.02, 1.24), (-0.24, 0.2, 0.96)), ((0.21, 0.02, 1.26), (0.3, 0.44, 1.3))]),
    # big, broad shoulders, heavier cloth
    "smith": dict(head=((0, 0.0, 1.62), (0.2, 0.21, 0.23)), radius=1.66, bend=0.35, mass=0.3,
                  spheres=[((0, 0, 1.4), (0.11, 0.11, 0.13)), ((0, 0, 1.22), (0.37, 0.19, 0.24)), ((0, 0.03, 0.96), (0.31, 0.21, 0.26))],
                  arms=[((-0.35, 0.02, 1.26), (-0.43, 0.22, 0.94)), ((0.35, 0.02, 1.26), (0.43, 0.22, 0.94))]),
}
V = VARIANTS[NAME]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.frame_start, scene.frame_end = 1, FRAMES


def sphere(loc, scale):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1, location=loc)
    o = bpy.context.object
    o.scale = scale
    return o


def limb(a, b, r):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=r, depth=d.length, location=(a + b) / 2)
    o = bpy.context.object
    o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    return o


# ---- the mannequin the sheet hangs on
parts = [sphere(*V["head"])] + [sphere(c, r) for c, r in V["spheres"]]
for a, b in V["arms"]:
    parts += [limb(a, b, 0.055), sphere(a, (0.07, 0.07, 0.07)), sphere(b, (0.075, 0.075, 0.075))]
bpy.ops.object.select_all(action="DESELECT")
for p in parts:
    p.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
body = bpy.context.object
body.name = "Mannequin"
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
body.modifiers.new("collision", "COLLISION")
body.collision.use = True
body.collision.thickness_outer = 0.012
body.collision.cloth_friction = 10

# ---- the sheet: a round cloth with an uneven edge, dropped from just above the head
hc, hr = V["head"]
top = max([hc[2] + hr[2]] + [b[2] + 0.08 for _, b in V["arms"]]) + 0.04
bpy.ops.mesh.primitive_grid_add(x_subdivisions=130, y_subdivisions=130, size=GRID, location=(hc[0], hc[1] * 0.6, top))
sheet = bpy.context.object
sheet.name = "Sheet"
bm = bmesh.new()
bm.from_mesh(sheet.data)
gone = []
for v in bm.verts:
    r = math.hypot(v.co.x, v.co.y)
    ang = math.atan2(v.co.y, v.co.x)
    edge = V["radius"] + 0.07 * noise.noise(Vector((math.cos(ang) * 2.2, math.sin(ang) * 2.2, 0.3))) + 0.03 * noise.noise(Vector((math.cos(ang) * 9, math.sin(ang) * 9, 1.7)))
    if r > edge:
        gone.append(v)
bmesh.ops.delete(bm, geom=gone, context="VERTS")
bm.to_mesh(sheet.data)
bm.free()

cloth = sheet.modifiers.new("cloth", "CLOTH")
cs = cloth.settings
cs.quality = 10
cs.mass = V["mass"]
cs.tension_stiffness = cs.compression_stiffness = 8
cs.shear_stiffness = 4
cs.bending_stiffness = V["bend"]
cs.air_damping = 1.5
cc = cloth.collision_settings
cc.use_collision = True
cc.distance_min = 0.012
cc.collision_quality = 3
cc.use_self_collision = True
cc.self_distance_min = 0.006
cloth.point_cache.frame_start, cloth.point_cache.frame_end = 1, FRAMES
for f in range(1, FRAMES + 1):
    scene.frame_set(f)
dg = bpy.context.evaluated_depsgraph_get()
draped = bpy.data.meshes.new_from_object(sheet.evaluated_get(dg))
sheet.modifiers.clear()
sheet.data = draped

bpy.ops.object.select_all(action="DESELECT")
sheet.select_set(True)
bpy.context.view_layer.objects.active = sheet
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)  # mesh coordinates = world coordinates
sub = sheet.modifiers.new("sub", "SUBSURF")
sub.levels = 1
bpy.ops.object.modifier_apply(modifier="sub")
bpy.ops.object.shade_smooth()
hem = min(v.co.z for v in sheet.data.vertices)

# ---- material + baked ambient occlusion in the vertex colours
mat = bpy.data.materials.new("Sheet")
mat.use_nodes = True
bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
bsdf.inputs["Base Color"].default_value = (0.86, 0.83, 0.76, 1)
bsdf.inputs["Roughness"].default_value = 0.85
mat.use_backface_culling = False
sheet.data.materials.append(mat)
world = bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.012, 0.01, 0.008, 1)
scene.render.engine = "CYCLES"
scene.cycles.samples = 48
try:
    col = sheet.data.color_attributes.new("Col", "BYTE_COLOR", "POINT")
    sheet.data.color_attributes.active_color = col
    sheet.data.color_attributes.render_color_index = 0
    scene.render.bake.target = "VERTEX_COLORS"
    bpy.ops.object.bake(type="AO")
except Exception as e:  # the model still works without it
    print("AO bake skipped:", e)

bpy.ops.object.select_all(action="DESELECT")
sheet.select_set(True)
bpy.context.view_layer.objects.active = sheet
kw = dict(filepath=OUT, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_materials="EXPORT")
try:
    bpy.ops.export_scene.gltf(export_colors=True, **kw)
except TypeError:
    bpy.ops.export_scene.gltf(**kw)
# site coordinates: x, y = Blender z, z = -Blender y
print("GHOST %s verts=%d hem=%.2f head=[%.3f, %.3f, %.3f] headScale=%.3f edge=%.2f" % (NAME, len(sheet.data.vertices), hem, hc[0], hc[2], -hc[1], hr[2] / 0.215, V["radius"]))

if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)
    black = bpy.data.materials.new("Void")
    black.use_nodes = True
    next(n for n in black.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"].default_value = (0.003, 0.003, 0.003, 1)
    body.data.materials.append(black)
    for name, loc, energy, size, colr in (("Key", (-1.6, 2.2, 2.6), 420, 1.2, (1, 0.95, 0.9)), ("Rim", (1.8, -1.8, 2.0), 260, 1.0, (0.7, 0.85, 1))):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy, ld.size, ld.color = energy, size, colr
        lo_ = bpy.data.objects.new(name, ld)
        lo_.location = loc
        lo_.rotation_euler = (Vector((0, 0, 1.1)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(lo_)
    cd = bpy.data.cameras.new("front")
    cd.lens = 50
    cam = bpy.data.objects.new("front", cd)
    cam.location = (1.6, 3.6, 1.4)
    cam.rotation_euler = (Vector((0, 0.1, 1.0)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(cam)
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = 420, 620
    scene.render.filepath = os.path.join(PREVIEW, "ghost-%s.png" % NAME)
    bpy.ops.render.render(write_still=True)
