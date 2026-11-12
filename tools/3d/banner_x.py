"""The Kaelis X banner (3:1): the K mark on the right, the Ledger's specimen shelf running out of focus behind it.

Run (headless):
  "C:/Program Files/Blender Foundation/Blender 4.0/blender.exe" -b -P tools/3d/banner_x.py -- <out.png> [width]

The K is built by the geometry part of logo_k.py, so the banner and the logo are the same object.
X covers the lower left with the profile picture, so nothing important sits there. No text in the image.
"""
import bpy, math, os, sys, random
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = ARGS[0] if ARGS else os.path.join(HERE, "work", "banner-x.png")
WIDTH = int(ARGS[1]) if len(ARGS) > 1 else 3000

# build the K exactly as the logo does (everything before its stage and light)
src = open(os.path.join(HERE, "logo_k.py"), encoding="utf-8").read().split("# ---- stage and light")[0]
sys.argv = [sys.argv[0], "--", OUT, "dark"]
exec(compile(src, "logo_k.py", "exec"))
scene = bpy.context.scene
random.seed(11)

# move the whole mark to the right third
KX = 3.25
for o in list(bpy.data.objects):
    if o.type == "MESH":
        o.location.x += KX

# ---- the shelf behind it: rows of sealed specimens, most of them mint, some amber, a few red
def emit(name, col, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (0, 0, 0, 1)
    b.inputs["Emission Color"].default_value = (*col, 1)
    b.inputs["Emission Strength"].default_value = strength
    return m


TUBES = [(emit("t_mint", (0.04, 0.75, 0.5), 0.75), 0.74), (emit("t_amber", (1.0, 0.55, 0.1), 0.9), 0.17), (emit("t_red", (1.0, 0.12, 0.16), 1.0), 0.09)]
board = bpy.data.materials.new("board")
board.use_nodes = True
bb = next(n for n in board.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
bb.inputs["Base Color"].default_value = (0.5, 0.52, 0.55, 1)
bb.inputs["Metallic"].default_value = 1.0
bb.inputs["Roughness"].default_value = 0.3
SY, X0, X1, STEP = 8.5, -15.0, 16.0, 0.2   # far enough back to melt into soft lights
base = {}
for mat_, _ in TUBES:
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.045, depth=0.3, location=(0, -50, 0))
    o = bpy.context.object
    o.data.materials.append(mat_)
    base[mat_.name] = o.data
for row in range(6):
    z = 0.35 + row * 0.72
    bpy.ops.mesh.primitive_cube_add(size=1, location=((X0 + X1) / 2, SY, z - 0.19))
    sh = bpy.context.object
    sh.scale = (X1 - X0 + 0.4, 0.26, 0.04)
    sh.data.materials.append(board)
    x = X0
    while x < X1:
        if random.random() > 0.06:                       # a gap now and then: a shelf in use, not a pattern
            r, acc = random.random(), 0.0
            for mat_, share in TUBES:
                acc += share
                if r <= acc:
                    t = bpy.data.objects.new("Tube", base[mat_.name])
                    t.location = (x, SY, z)
                    scene.collection.objects.link(t)
                    break
        x += STEP

# ---- stage and light
bgc = (0.010, 0.012, 0.015)
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (*bgc, 1)
floor = bpy.data.materials.new("floor")
floor.use_nodes = True
fb = next(n for n in floor.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
fb.inputs["Base Color"].default_value = (0.012, 0.014, 0.017, 1)
fb.inputs["Roughness"].default_value = 0.28
bpy.ops.mesh.primitive_plane_add(size=120, location=(0, 0, -0.05))
bpy.context.object.data.materials.append(floor)


def light(name, loc, energy, size, color=(1, 1, 1), aim=(KX, 0, 1.5)):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy, ld.size, ld.color = energy, size, color
    o = bpy.data.objects.new(name, ld)
    o.location = loc
    o.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(o)


light("Key", (KX - 3.4, -5.0, 5.4), 620, 2.6, (1, 0.97, 0.94))
light("Rim", (KX + 3.6, 2.6, 4.4), 520, 1.6, (0.75, 0.92, 1.0), aim=(KX + 0.2, 0, 1.9))
light("Fill", (KX + 4.2, -4.8, 1.6), 110, 4.0, (0.85, 1, 0.95))
light("Top", (KX + 0.1, -0.4, 6.0), 200, 2.2, aim=(KX + 0.1, 0, 1.2))

cd = bpy.data.cameras.new("Cam")
cd.lens = 50
cam = bpy.data.objects.new("Cam", cd)
cam.location = (0.4, -16.0, 1.9)
aim = Vector((0.4, 0, 1.62))
cam.rotation_euler = (aim - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.collection.objects.link(cam)
scene.camera = cam
cd.dof.use_dof = True
cd.dof.focus_distance = (Vector((KX, 0, 1.5)) - cam.location).length
cd.dof.aperture_fstop = 0.8                    # the shelf melts into lights; the K stays sharp

scene.render.engine = "CYCLES"
scene.cycles.device = "GPU"
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "OPTIX"
prefs.get_devices()
for d in prefs.devices:
    d.use = d.type == "OPTIX"
scene.cycles.samples = 320
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 16
scene.cycles.transmission_bounces = 16
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = -0.35
scene.render.resolution_x, scene.render.resolution_y = WIDTH, WIDTH // 3
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("BANNER", OUT)
