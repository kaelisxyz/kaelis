"""Build the Kaelis Labs ghost: a real sheet draped over a mannequin with Blender's cloth solver.

Run (headless):
  "C:/Program Files/Blender Foundation/Blender 4.0/blender.exe" -b -P tools/3d/ghost_cloth.py -- <preview_dir>

Output: site/models/ghost.raw.glb (compress with gltf-transform into site/models/ghost.glb) and a Cycles preview.
Conventions: 1 unit = 1 m, the floor is z = 0, the ghost faces Blender +Y (glTF -Z, towards the desk).
The sheet keeps the planar UVs of the flat cloth (the site uses them to fade and fray the hem) and
carries baked ambient occlusion in its vertex colours (the folds read even in a dark room).
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector, noise

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "site", "models", "ghost.raw.glb")
PREVIEW = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else None
FRAMES = 110

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


# ---- the mannequin the sheet hangs on: head, neck, shoulders, two arms reaching forward
parts = [sphere((0, 0, 1.5), (0.185, 0.2, 0.215)), sphere((0, 0, 1.3), (0.09, 0.09, 0.13)), sphere((0, 0, 1.14), (0.225, 0.14, 0.2))]
for s in (-1, 1):
    a, b = (s * 0.21, 0.02, 1.18), (s * 0.25, 0.36, 1.0)
    parts += [limb(a, b, 0.055), sphere(a, (0.07, 0.07, 0.07)), sphere(b, (0.075, 0.075, 0.075))]
bpy.ops.object.select_all(action="DESELECT")
for p in parts:
    p.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
body = bpy.context.object
body.name = "Mannequin"
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
body.modifiers.new("collision", "COLLISION")
body.collision.use = True
body.collision.thickness_outer = 0.012
body.collision.cloth_friction = 10

# ---- the sheet: a round cloth with an uneven edge
bpy.ops.mesh.primitive_grid_add(x_subdivisions=120, y_subdivisions=120, size=3.1, location=(0, 0.04, 1.75))
sheet = bpy.context.object
sheet.name = "Sheet"
bm = bmesh.new()
bm.from_mesh(sheet.data)
gone = []
for v in bm.verts:
    r = math.hypot(v.co.x, v.co.y)
    ang = math.atan2(v.co.y, v.co.x)
    edge = 1.5 + 0.07 * noise.noise(Vector((math.cos(ang) * 2.2, math.sin(ang) * 2.2, 0.3))) + 0.03 * noise.noise(Vector((math.cos(ang) * 9, math.sin(ang) * 9, 1.7)))
    if r > edge:
        gone.append(v)
bmesh.ops.delete(bm, geom=gone, context="VERTS")
bm.to_mesh(sheet.data)
bm.free()

cloth = sheet.modifiers.new("cloth", "CLOTH")
cs = cloth.settings
cs.quality = 10
cs.mass = 0.2
cs.tension_stiffness = cs.compression_stiffness = 8
cs.shear_stiffness = 4
cs.bending_stiffness = 0.06
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

# ---- smooth it (the face holes are cut in the site shader, see site/index.html)
bpy.ops.object.select_all(action="DESELECT")
sheet.select_set(True)
bpy.context.view_layer.objects.active = sheet
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)  # mesh coordinates = world coordinates from here on
sub = sheet.modifiers.new("sub", "SUBSURF")
sub.levels = 1
bpy.ops.object.modifier_apply(modifier="sub")
bm = bmesh.new()
bm.from_mesh(sheet.data)
cut = []
for fc in bm.faces:
    c = fc.calc_center_median()
    if True:  # the eyes and mouth are cut per pixel in the site shader (smooth edges); nothing is cut here
        continue
    eye = min(((c.x - s * 0.074) / 0.042) ** 2 + ((c.z - 1.545) / 0.058) ** 2 for s in (-1, 1))
    mouth = (c.x / 0.034) ** 2 + ((c.z - 1.425) / 0.05) ** 2
    if eye < 1 or mouth < 1:
        cut.append(fc)
bmesh.ops.delete(bm, geom=cut, context="FACES")
bm.to_mesh(sheet.data)
bm.free()
bpy.ops.object.shade_smooth()
lo = min(v.co.z for v in sheet.data.vertices)
print("sheet: %d verts, %d faces, hem at z=%.2f, cut %d faces" % (len(sheet.data.vertices), len(sheet.data.polygons), lo, len(cut)))

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
    print("AO baked into vertex colours")
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
print("wrote", OUT)

# ---- a Cycles preview so the drape can be judged without the site
if PREVIEW:
    os.makedirs(PREVIEW, exist_ok=True)
    black = bpy.data.materials.new("Void")
    black.use_nodes = True
    next(n for n in black.node_tree.nodes if n.type == "BSDF_PRINCIPLED").inputs["Base Color"].default_value = (0.003, 0.003, 0.003, 1)
    body.data.materials.append(black)
    for name, loc, energy, size, colr in (("Key", (-1.6, 2.2, 2.6), 420, 1.2, (1, 0.82, 0.6)), ("Rim", (1.8, -1.8, 2.0), 260, 1.0, (0.6, 0.85, 1))):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy, ld.size, ld.color = energy, size, colr
        lo_ = bpy.data.objects.new(name, ld)
        lo_.location = loc
        lo_.rotation_euler = (Vector((0, 0, 1.1)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(lo_)
    for name, loc in (("front", (1.5, 3.2, 1.5)), ("side", (3.4, 0.6, 1.4))):
        cd = bpy.data.cameras.new(name)
        cd.lens = 50
        cam = bpy.data.objects.new(name, cd)
        cam.location = loc
        cam.rotation_euler = (Vector((0, 0.1, 1.05)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(cam)
        scene.camera = cam
        scene.render.resolution_x, scene.render.resolution_y = 560, 760
        scene.render.filepath = os.path.join(PREVIEW, "ghost-%s.png" % name)
        bpy.ops.render.render(write_still=True)
    print("previews in", PREVIEW)
