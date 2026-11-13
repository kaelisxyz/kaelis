"""Camera shots around the Kaelis K for the X videos (Blender Cycles, 30 fps).

Run (headless):
  "C:/Program Files/Blender Foundation/Blender 4.0/blender.exe" -b -P tools/3d/video_k.py -- <out_dir> [preview|final] [shots] [step]

  climb     60  dark: the camera climbs the tower while its floors switch on
  eye_open  60  the eye, shut, then it opens
  reveal    60  the drop: lights up, the tubes fill, the camera swings out to show the whole K
  sweep     60  a low arc across the front of the K
  hero     105  the whole K, a push in that never quite stops
  trace    135  down a tube, from the sealed end back to the tower it came from
  verdict   60  the eye turns mint, amber, red (allow, warn, block), one every 15 frames

`shots` is a comma list (default: all). `preview` renders five small frames per shot; `final` renders every frame at
1920x1080 into <out_dir>/<shot>/f0000.jpg and skips files that exist. `step` renders every Nth frame (for timing).
The picture leaves the left half calm on purpose: the type goes there (video/src).
"""
import bpy, math, os, sys, random, time
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
A = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
DEST = os.path.abspath(A[0])                     # Blender resolves a relative render path against the drive root, not the folder you ran it from
QUAL = A[1] if len(A) > 1 else "preview"
PICK = [x for x in (A[2] if len(A) > 2 else "").split(",") if x and x != "all"]
STEP = int(A[3]) if len(A) > 3 else 1

src = open(os.path.join(HERE, "logo_k.py"), encoding="utf-8").read().split("# ---- stage and light")[0]
sys.argv = [sys.argv[0], "--", DEST, "dark"]
exec(compile(src, "logo_k.py", "exec"))
scene = bpy.context.scene
random.seed(11)

MINT, AMBER, RED = (0.06, 0.9, 0.6), (1.0, 0.5, 0.06), (1.0, 0.06, 0.12)
C = Vector((0.12, 0, 1.5))                      # the middle of the mark
EYE = Vector((SX, -SW / 2 - 0.012, 1.52))
Jv, UPv, DNv = Vector(J), Vector(UP), Vector(DN)


def bsdf(m):
    return next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


# ---- parts that change over time
BANDS = []
for i in range(9):
    o = bpy.data.objects["Band%d" % i]
    m = M["band"].copy()
    o.data.materials[0] = m
    BANDS.append(bsdf(m))
RING, LENS, LIQ = bsdf(M["band"]), bsdf(M["lens"]), bsdf(M["liquid"])
IRIS = bpy.data.objects["EyeIris"]

ticks = bpy.data.objects.new("Ticks", None)     # a ring of marks around the iris that turns: the eye is reading
ticks.location = EYE + Vector((0, -0.006, 0))
scene.collection.objects.link(ticks)
for k in range(28):
    a = k / 28 * math.tau
    long = k % 7 == 0
    bpy.ops.mesh.primitive_cube_add(size=1, location=ticks.location + Vector((math.cos(a), 0, math.sin(a))) * 0.135, rotation=(0, -a, 0))
    t = bpy.context.object
    t.scale = (0.03 if long else 0.016, 0.004, 0.005)
    bpy.ops.object.transform_apply(scale=True)
    t.data.materials.append(M["lens"])
    mw = t.matrix_world.copy()
    t.parent = ticks
    t.matrix_parent_inverse = ticks.matrix_world.inverted()
    t.matrix_world = mw

LIQS = []                                        # (object, start, middle) so a tube can fill from the tower outwards
for tag, end, fill in (("Up", UPv, 0.62), ("Dn", DNv, 1.0)):
    o = bpy.data.objects["Liquid" + tag]
    a0, b0 = Jv + (end - Jv) * 0.04, Jv + (end - Jv) * fill
    LIQS.append((o, a0, (a0 + b0) / 2, end, fill))
BUBBLES = []
for o in bpy.data.objects:
    if o.name.startswith("Bubble"):
        best = min(((o.location - (Jv + (e - Jv) * max(0, min(1, (o.location - Jv).dot(e - Jv) / (e - Jv).length_squared)))).length, n, (o.location - Jv).dot(e - Jv) / (e - Jv).length_squared) for n, e in enumerate((UPv, DNv)))
        BUBBLES.append((o, best[1], best[2]))

# ---- the room around it: enough far lights and dust for the camera moves to read as moves
world = bpy.data.worlds.new("W")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.006, 0.008, 0.01, 1)
fl = mat("floor", (0.012, 0.014, 0.017), 0.22, 0.0)
bpy.ops.mesh.primitive_plane_add(size=160, location=(0, 0, -0.05))
bpy.context.object.data.materials.append(fl)
M["far"] = mat("far", (0, 0, 0), 0.4, emit=(0.5, 0.95, 0.85), strength=2.6)
M["farw"] = mat("farw", (0, 0, 0), 0.4, emit=(0.8, 0.9, 1.0), strength=3.6)
M["dust"] = mat("dust", (0, 0, 0), 0.4, emit=(0.7, 1.0, 0.9), strength=3.0)
FAR = [bsdf(M["far"]), bsdf(M["farw"])]
for k in range(46):                              # tall light slits on a wide arc behind and beside the K
    phi = math.radians(-42 + k * (264 / 45) + random.uniform(-1.6, 1.6))
    r = random.uniform(15, 22)
    h = random.uniform(2.5, 8.5)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(r * math.cos(phi), r * math.sin(phi), h / 2 + random.uniform(0, 1.5)))
    o = bpy.context.object
    o.scale = (0.07, 0.07, h)
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(M["farw" if k % 5 == 0 else "far"])
for rr in (2.7, 3.9, 5.6, 8.0):                  # rings on the floor
    bpy.ops.mesh.primitive_torus_add(major_radius=rr, minor_radius=0.007, major_segments=160, location=(0.1, 0, -0.044))
    bpy.context.object.data.materials.append(M["far"])
for k in range(150):                             # dust in the air
    p = Vector((random.uniform(-4.5, 4.5), random.uniform(-7, 3), random.uniform(0.15, 4.4)))
    if abs(p.x - 0.1) < 1.6 and abs(p.y) < 0.6:
        continue
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=random.uniform(0.003, 0.008), location=p)
    bpy.context.object.data.materials.append(M["dust"])

LIGHTS = {}


def light(name, loc, energy, size, color=(1, 1, 1), aim=(0, 0, 1.5)):
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy, ld.size, ld.color = energy, size, color
    o = bpy.data.objects.new(name, ld)
    o.location = loc
    o.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(o)
    LIGHTS[name] = (ld, energy)


light("Key", (-3.4, -5.0, 5.4), 620, 2.6, (1, 0.97, 0.94))
light("Rim", (3.6, 3.4, 4.4), 620, 1.6, (0.75, 0.92, 1.0), aim=(0.2, 0, 1.9))
light("Fill", (4.2, -4.8, 1.6), 110, 4.0, (0.85, 1, 0.95))
light("Top", (0.1, -0.4, 6.0), 200, 2.2, aim=(0.1, 0, 1.2))


# ---- timing helpers
def lerp(a, b, k):
    return a + (b - a) * k


def sat(k):
    return max(0.0, min(1.0, k))


def seg(f, a, b):
    return sat((f - a) / (b - a))


def smooth(k):
    k = sat(k)
    return k * k * k * (k * (k * 6 - 15) + 10)


def out_expo(k):
    k = sat(k)
    return (1 - 2 ** (-9 * k)) / (1 - 2 ** -9)


def orbit(deg, r, z):
    a = math.radians(deg)
    return Vector((C.x + r * math.sin(a), -r * math.cos(a), z))


def flick(f, t0):                                # a lamp that catches: on, a dip, on
    t = f - t0
    return 0.0 if t < 0 else 1.7 if t < 1 else 0.1 if t < 2 else 1.4 if t < 3 else 1.0


def flash(f, t0, amount=3.0, life=7.0):          # a burst that dies away after t0
    t = f - t0
    return 0.0 if t < 0 else amount * math.exp(-t / life * 3)


# ---- the shots. cam(f) -> where the camera is; look(f) -> what the K is doing. f is the frame inside the shot.
EYE_DIR = Vector((-0.343, -0.933, 0.11))


def base(**kw):
    d = dict(power=1.0, bands=[1.0] * 9, col=MINT, ring=1.0, fill=1.0, iris=1.0, icol=MINT, isc=1.0, far=1.0, tick=0.0, liq=1.0)
    d.update(kw)
    return d


def climb_cam(f):
    z = lerp(0.3, 2.05, f / 60)
    return dict(pos=Vector((-2.75, -2.35, z + 0.1)), tgt=Vector((-0.78, 0, z + 0.2)), lens=50, fstop=1.6, focus=Vector((-0.78, -0.33, z + 0.2)), shift=-0.2)


def climb_look(f):
    return base(power=lerp(0.04, 0.15, f / 60), bands=[0.8 * flick(f, 2 + i * 5.4) for i in range(9)], ring=0.0, fill=0.0, iris=0.0, far=lerp(0.12, 0.4, f / 60))


OPEN_AT = 32                                     # the frame the eye opens: "...who launched it"


def eye_open_cam(f):
    u = f / 60
    d = EYE_DIR.lerp(Vector((-0.22, -0.97, 0.07)), u).normalized() * lerp(3.3, 2.3, 0.55 * smooth(u) + 0.45 * u)
    return dict(pos=EYE + d, tgt=EYE, lens=70, fstop=2.2, focus=EYE, shift=-0.2)


def eye_open_look(f):
    on = flick(f, OPEN_AT)
    return base(power=lerp(0.1, 0.2, f / 60) + flash(f, OPEN_AT, 0.25, 8), bands=[0.45 + 0.5 * flash(f, OPEN_AT, 1.0, 8)] * 9, ring=0.0, fill=0.0,
                iris=0.6 * on * (1 + flash(f, OPEN_AT, 3.0, 6)), isc=lerp(0.35, 1.0, out_expo(seg(f, OPEN_AT, OPEN_AT + 16))), far=0.4, tick=f * 0.04)


def reveal_cam(f):
    k = 0.9 * out_expo(seg(f, 0, 32)) + 0.1 * f / 60
    return dict(pos=orbit(lerp(-66, -7, k), lerp(4.7, 11.7, k), lerp(0.55, 2.35, k)), tgt=Vector((C.x, 0, lerp(1.62, 1.47, k))),
                lens=lerp(32, 53, k), fstop=4.0, focus=C, shift=lerp(0, -0.2, smooth(seg(f, 3, 30))))


def reveal_look(f):
    b = 1 + flash(f, 0, 2.2)
    return base(power=1 + flash(f, 0, 1.3, 9), bands=[b] * 9, ring=b, fill=out_expo(seg(f, 1, 36)), iris=b, far=1 + flash(f, 0, 1.5), tick=f * 0.03)


def sweep_cam(f):
    u = f / 60
    k = 0.7 * smooth(u) + 0.3 * u
    return dict(pos=orbit(lerp(-40, 34, k), lerp(6.0, 7.2, k), lerp(0.75, 2.3, k)), tgt=Vector((C.x + 0.1, 0, lerp(1.55, 1.5, k))), lens=35, fstop=3.2, focus=C, shift=-0.2)


def sweep_look(f):
    return base(bands=[1 + 0.9 * max(0.0, 1 - abs(i - (f * 0.3 - 2)) / 1.4) for i in range(9)], tick=f * 0.03, liq=1 + 0.5 * math.sin(f * 0.21) ** 2)


def hero_cam(f):
    d = 0.75 * out_expo(seg(f, 0, 26)) + 0.25 * f / 105
    return dict(pos=orbit(lerp(-11, -5, d), lerp(13.6, 11.3, d), 2.3), tgt=Vector((C.x, 0, 1.46)), lens=54, fstop=5.6, focus=C, shift=-0.2)


def hero_look(f):
    hit = flash(f, 0, 1.6, 10)
    return base(power=1 + hit * 0.5, bands=[1 + 0.15 * math.sin(f * 0.15 + i) + hit for i in range(9)], ring=1 + hit, iris=1 + hit, far=1 + hit * 0.8, tick=f * 0.03)


def trace_cam(f):
    u = f / 135
    k = 0.7 * smooth(u) + 0.3 * u
    p = (Jv + (UPv - Jv) * 0.97).lerp(Vector((-0.66, -0.12, 1.52)), k)
    off = Vector((0.35, -2.3, 0.45)).lerp(Vector((-0.8, -2.45, 0.25)), k)
    return dict(pos=p + off, tgt=p, lens=50, fstop=2.0, focus=p + Vector((0, -0.25, 0)), shift=-0.2)


def trace_look(f):
    return base(bands=[0.6 + 0.15 * math.sin(f * 0.2 + i) for i in range(9)], iris=0.6, tick=f * 0.03, liq=1 + 0.5 * math.sin(f * 0.21) ** 2)


def verdict_cam(f):
    n = min(2, int(max(f, 0) // 15))
    punch = (0, 0.22, 0.44)[n] + 0.1 * out_expo(seg(f, n * 15, n * 15 + 8)) + 0.06 * seg(f, 30, 60)   # a snap closer on every answer
    d = EYE_DIR.lerp(Vector((-0.16, -0.985, 0.05)), f / 60).normalized() * (2.9 - punch * 1.0)
    return dict(pos=EYE + d, tgt=EYE, lens=70, fstop=2.2, focus=EYE, shift=-0.2)


def verdict_look(f):
    n = min(2, int(max(f, 0) // 15))
    t0, col = n * 15, (MINT, (1.0, 0.36, 0.0), (1.0, 0.015, 0.04))[n]
    g = (1.0, 0.6, 0.5)[n]                        # amber and red wash out to pastel if they are as bright as the mint
    fl_ = flash(f, t0, 2.4, 6)
    isc = (1.0, 0.82, 1.42)[n] + (0.35 if n < 2 else -0.5) * math.exp(-(f - t0) / 3)     # the iris snaps, then settles
    return base(power=0.75, bands=[g * (0.42 + fl_ * 0.3)] * 9, col=col, iris=g * (0.5 + fl_ * 0.5), icol=col, isc=isc, far=0.7, tick=f * 0.05 + n * 0.6)


SHOTS = [("climb", 60, climb_cam, climb_look), ("eye_open", 60, eye_open_cam, eye_open_look), ("reveal", 60, reveal_cam, reveal_look), ("sweep", 60, sweep_cam, sweep_look),
         ("hero", 105, hero_cam, hero_look), ("trace", 135, trace_cam, trace_look), ("verdict", 60, verdict_cam, verdict_look)]

# one camera per shot, keyed on every frame (and one frame past each end, so motion blur is right at the cuts)
PLAN, start = [], 0
for name, n, cam_fn, look_fn in SHOTS:
    cd = bpy.data.cameras.new(name)
    cd.sensor_width = 36
    cd.dof.use_dof = True
    ob = bpy.data.objects.new(name, cd)
    scene.collection.objects.link(ob)
    prev = None
    for lf in range(-1, n + 1):
        s = cam_fn(lf)
        q = (s["tgt"] - s["pos"]).to_track_quat("-Z", "Y")
        e = q.to_euler("XYZ", prev) if prev else q.to_euler("XYZ")
        prev = e
        ob.location, ob.rotation_euler = s["pos"], e
        cd.lens, cd.shift_x, cd.dof.aperture_fstop, cd.dof.focus_distance = s["lens"], s["shift"], s["fstop"], (s["focus"] - s["pos"]).length
        g = start + lf
        ob.keyframe_insert("location", frame=g)
        ob.keyframe_insert("rotation_euler", frame=g)
        for path in ("lens", "shift_x", "dof.aperture_fstop", "dof.focus_distance"):
            cd.keyframe_insert(path, frame=g)
    for idb in (ob, cd):
        for fc in idb.animation_data.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"
    PLAN.append((name, start, n, ob, look_fn))
    start += n


def dress(look):
    for name, (ld, e) in LIGHTS.items():
        ld.energy = e * look["power"]
    for i, b in enumerate(BANDS):
        b.inputs["Emission Strength"].default_value = 3.2 * look["bands"][i]
        b.inputs["Emission Color"].default_value = (*look["col"], 1)
    RING.inputs["Emission Strength"].default_value = 3.2 * look["ring"]
    LENS.inputs["Emission Strength"].default_value = 7.0 * look["iris"]
    LENS.inputs["Emission Color"].default_value = (*look["icol"], 1)
    LIQ.inputs["Emission Strength"].default_value = 1.15 * look.get("liq", 1.0)
    IRIS.scale = (look["isc"],) * 3
    ticks.rotation_euler = (0, look["tick"], 0)
    FAR[0].inputs["Emission Strength"].default_value = 2.6 * look["far"]
    FAR[1].inputs["Emission Strength"].default_value = 3.6 * look["far"]
    k = look["fill"]
    for o, a0, mid, end, fill in LIQS:
        o.hide_render = k < 0.02
        o.scale = (1, 1, max(k, 0.02))
        o.location = a0 + (mid - a0) * k
    for o, arm, t in BUBBLES:
        o.hide_render = t > 0.04 + ((0.62, 1.0)[arm] - 0.04) * k - 0.03


scene.render.engine = "CYCLES"
scene.cycles.device = "GPU"
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "OPTIX"
prefs.get_devices()
for d in prefs.devices:
    d.use = d.type == "OPTIX"
final = QUAL == "final"
scene.cycles.samples = 64 if final else 28
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 10
scene.cycles.transmission_bounces = 10
scene.cycles.glossy_bounces = 6
scene.cycles.sample_clamp_indirect = 8
scene.render.use_motion_blur = True
scene.render.motion_blur_shutter = 0.5
scene.render.use_persistent_data = True
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.view_settings.exposure = -0.35
scene.render.resolution_x, scene.render.resolution_y = (1920, 1080) if final else (640, 360)
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 93
os.makedirs(DEST, exist_ok=True)

frames = []
for name, st, n, ob, look_fn in PLAN:
    if PICK and name not in PICK:
        continue
    todo = range(0, n, STEP) if final else sorted({0, n // 4, n // 2, 3 * n // 4, n - 1})
    frames += [(st + lf, lf, name, ob, look_fn) for lf in todo]
t_all = time.time()
for g, lf, name, ob, look_fn in frames:
    if final:
        os.makedirs(os.path.join(DEST, name), exist_ok=True)
    path = os.path.join(DEST, name, "f%04d.jpg" % lf) if final else os.path.join(DEST, "%s_%03d.jpg" % (name, lf))
    if final and os.path.exists(path):
        continue
    t0 = time.time()
    scene.frame_set(g)
    scene.camera = ob
    dress(look_fn(lf))
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("KSHOT %s %d %.1fs" % (name, lf, time.time() - t0), flush=True)
print("KSHOT done %s in %.0fs" % (DEST, time.time() - t_all))
