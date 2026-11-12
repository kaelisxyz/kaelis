"""The Kaelis X banner (3:1): the K mark on the right third, in front of one of four backgrounds.

Run (headless):
  "C:/Program Files/Blender Foundation/Blender 4.0/blender.exe" -b -P tools/3d/banner_x.py -- <out.png> [width] [studio|city|lab|shelf]

  studio  a dark stage: one soft mint glow behind the K, a thin mint horizon line, a long reflection
  city    the night city of the home page, far away and out of focus (points of light)
  lab     the white clean lab of the rooms: panels, a mint line, ceiling lights
  shelf   the Ledger's specimen shelf (rows of sealed tubes)

The K is built by the geometry part of logo_k.py, so the banner and the logo are the same object.
X covers the lower left with the profile picture, so nothing important sits there. No text in the image.
"""
import bpy, math, os, sys, random
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = ARGS[0] if ARGS else os.path.join(HERE, "work", "banner-x.png")
WIDTH = int(ARGS[1]) if len(ARGS) > 1 else 3000
BG = ARGS[2] if len(ARGS) > 2 else "studio"
LIGHT = BG == "lab"

# build the K exactly as the logo does (everything before its stage and light)
src = open(os.path.join(HERE, "logo_k.py"), encoding="utf-8").read().split("# ---- stage and light")[0]
sys.argv = [sys.argv[0], "--", OUT, "light" if LIGHT else "dark"]
exec(compile(src, "logo_k.py", "exec"))
scene = bpy.context.scene
random.seed(11)

KX = 3.25  # the mark sits on the right third
for o in list(bpy.data.objects):
    if o.type == "MESH":
        o.location.x += KX


def pbr(name, col, rough=0.5, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*col, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = strength
    return m


def box(size, loc, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.scale = size
    o.data.materials.append(m)
    return o


def plane(size, loc, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_plane_add(size=size, location=loc, rotation=rot)
    bpy.context.object.data.materials.append(m)
    return bpy.context.object


MINT = (0.06, 0.9, 0.6)
bgc = (0.82, 0.84, 0.86) if LIGHT else (0.010, 0.012, 0.015)
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (*bgc, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.9 if LIGHT else 1.0
fstop, exposure = 0.8, -0.35

if BG == "studio":
    plane(160, (0, 0, -0.05), pbr("floor", (0.012, 0.014, 0.017), 0.16))
    # one soft glow far behind the mark, and a thin horizon line that runs the whole width
    glow = pbr("glow", bgc, 1.0, emit=(0.05, 0.75, 0.5), strength=1.0)
    nt = glow.node_tree
    bs = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    tc, mp, gr, pw = nt.nodes.new("ShaderNodeTexCoord"), nt.nodes.new("ShaderNodeMapping"), nt.nodes.new("ShaderNodeTexGradient"), nt.nodes.new("ShaderNodeMath")
    mp.inputs["Location"].default_value = (-1, -1, 0)
    mp.inputs["Scale"].default_value = (2, 2, 1)
    gr.gradient_type = "SPHERICAL"
    pw.operation = "POWER"
    pw.inputs[1].default_value = 5.5   # the card is larger now, so the falloff is steeper
    nt.links.new(tc.outputs["UV"], mp.inputs["Vector"]); nt.links.new(mp.outputs["Vector"], gr.inputs["Vector"]); nt.links.new(gr.outputs["Fac"], pw.inputs[0])
    sc = nt.nodes.new("ShaderNodeMath"); sc.operation = "MULTIPLY"; sc.inputs[1].default_value = 1.6
    nt.links.new(pw.outputs[0], sc.inputs[0]); nt.links.new(sc.outputs[0], bs.inputs["Emission Strength"])
    plane(60, (KX + 0.4, 30, 3.0), glow, rot=(math.pi / 2, 0, 0))
    box((120, 0.04, 0.035), (0, 22, 0.5), pbr("line", (0, 0, 0), 0.5, emit=MINT, strength=2.2))
    fstop = 0.5

elif BG == "city":
    plane(400, (0, 0, -0.05), pbr("floor", (0.012, 0.014, 0.017), 0.14))
    dark = pbr("tower", (0.01, 0.012, 0.016), 0.6)
    cols = [pbr("w_warm", (0, 0, 0), 0.5, emit=(1.0, 0.72, 0.42), strength=30.0), pbr("w_cool", (0, 0, 0), 0.5, emit=(0.7, 0.86, 1.0), strength=30.0), pbr("w_mint", (0, 0, 0), 0.5, emit=MINT, strength=38.0)]
    wmesh = {}
    for c in cols:
        bpy.ops.mesh.primitive_circle_add(vertices=20, radius=0.2, fill_type="NGON", location=(0, 0, 0), rotation=(math.pi / 2, 0, 0))   # round, so the blur gives discs, not squares
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)   # bake the turn only; applying the location too would shift every copy
        bpy.context.object.location = (0, -90, 0)                                    # the template itself waits behind the camera
        bpy.context.object.data.materials.append(c)
        wmesh[c.name] = bpy.context.object.data
    x = -62.0
    while x < 66:                                   # a skyline 45 to 75 m away: dark towers with lit windows
        w, h, y = random.uniform(3.5, 8.0), random.uniform(7, 30), random.uniform(45, 75)
        box((w, w, h), (x + w / 2, y, h / 2), dark)
        for _ in range(int(w * h * 0.9)):
            if random.random() < 0.5:
                c = cols[0] if random.random() < 0.55 else cols[1] if random.random() < 0.7 else cols[2]   # warm, cool, and a share of Kaelis mint
                t = bpy.data.objects.new("win", wmesh[c.name])
                t.location = (x + random.uniform(0.3, w - 0.3), y - w / 2 - 0.05, random.uniform(0.8, h - 0.5))
                scene.collection.objects.link(t)
        x += w + random.uniform(0.4, 3.0)
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.018, 0.022, 0.035, 1)   # a trace of night sky
    fstop = 0.22

elif BG == "lab":
    white = pbr("panel", (0.9, 0.91, 0.92), 0.5)
    plane(160, (0, 0, -0.05), pbr("floor", (0.62, 0.63, 0.64), 0.2))
    WY = 9.0
    plane(160, (0, WY, 0), white, rot=(math.pi / 2, 0, 0))
    groove = pbr("groove", (0.42, 0.43, 0.45), 0.6)
    for i in range(-5, 7):
        box((0.015, 0.02, 12), (i * 4.2 + 0.9, WY - 0.01, 3), groove)
    box((160, 0.03, 0.07), (0, WY - 0.015, 1.08), pbr("mintline", (0.1, 0.78, 0.62), 0.4, emit=(0.1, 0.78, 0.62), strength=0.6))
    box((160, 0.03, 0.12), (0, WY - 0.015, 0.02), pbr("skirt", (0.62, 0.63, 0.65), 0.28, 1.0))
    for i in range(-5, 7):                          # ceiling light panels, seen only as reflections and glow
        box((1.2, 0.6, 0.02), (i * 2.8, 3.5, 4.6), pbr("lp%d" % i, (1, 1, 1), 0.5, emit=(1, 1, 1), strength=9.0))
    fstop, exposure = 0.9, -0.55

else:  # shelf
    plane(160, (0, 0, -0.05), pbr("floor", (0.012, 0.014, 0.017), 0.28))
    tubes = [(pbr("t_mint", (0, 0, 0), 0.5, emit=(0.04, 0.75, 0.5), strength=0.75), 0.74), (pbr("t_amber", (0, 0, 0), 0.5, emit=(1.0, 0.55, 0.1), strength=0.9), 0.17), (pbr("t_red", (0, 0, 0), 0.5, emit=(1.0, 0.12, 0.16), strength=1.0), 0.09)]
    board = pbr("board", (0.5, 0.52, 0.55), 0.3, 1.0)
    SY, X0, X1, STEP = 8.5, -15.0, 16.0, 0.2
    meshes = {}
    for m_, _ in tubes:
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.045, depth=0.3, location=(0, -50, 0))
        bpy.context.object.data.materials.append(m_)
        meshes[m_.name] = bpy.context.object.data
    for row in range(6):
        z = 0.35 + row * 0.72
        box((X1 - X0 + 0.4, 0.26, 0.04), ((X0 + X1) / 2, SY, z - 0.19), board)
        x = X0
        while x < X1:
            if random.random() > 0.06:
                r, acc = random.random(), 0.0
                for m_, share in tubes:
                    acc += share
                    if r <= acc:
                        t = bpy.data.objects.new("Tube", meshes[m_.name])
                        t.location = (x, SY, z)
                        scene.collection.objects.link(t)
                        break
            x += STEP


def light(name, loc, energy, size, color=(1, 1, 1), aim=(KX, 0, 1.5)):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy, ld.size, ld.color = energy, size, color
    o = bpy.data.objects.new(name, ld)
    o.location = loc
    o.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(o)


k = 0.75 if LIGHT else 1.0
light("Key", (KX - 3.4, -5.0, 5.4), 620 * k, 2.6, (1, 0.97, 0.94))
light("Rim", (KX + 3.6, 2.6, 4.4), 520 * k, 1.6, (0.75, 0.92, 1.0), aim=(KX + 0.2, 0, 1.9))
light("Fill", (KX + 4.2, -4.8, 1.6), 110 if not LIGHT else 260, 4.0, (0.85, 1, 0.95))
light("Top", (KX + 0.1, -0.4, 6.0), 200 * k, 2.2, aim=(KX + 0.1, 0, 1.2))

cd = bpy.data.cameras.new("Cam")
cd.lens = 50
cam = bpy.data.objects.new("Cam", cd)
cam.location = (0.4, -16.0, 1.9)
cam.rotation_euler = (Vector((0.4, 0, 1.62)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.collection.objects.link(cam)
scene.camera = cam
cd.dof.use_dof = True
cd.dof.focus_distance = (Vector((KX, 0, 1.5)) - cam.location).length
cd.dof.aperture_fstop = fstop                  # the background melts; the K stays sharp

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
scene.view_settings.exposure = exposure
scene.render.resolution_x, scene.render.resolution_y = WIDTH, WIDTH // 3
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = OUT
bpy.ops.render.render(write_still=True)
print("BANNER", BG, OUT, "| objects:", len(bpy.data.objects), "| windows:", sum(1 for o in bpy.data.objects if o.name.startswith("win")))
