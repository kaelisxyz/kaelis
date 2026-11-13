// The 3D sets, built from the site's own assets: the baked clean lab and corridor, the staff, and the few live
// props the site adds on top (specimen shelf, tank, screens, the Gate's wall display).
// Everything here is driven by the frame number, so a render is identical every time.
import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import { staticFile, useVideoConfig } from "remotion";
import { C, MONO } from "./theme";

const GAIN = 1 / 0.6; // the bakes are stored at 0.6x (see tools/3d/bake_lab.py)

// ---- stage: one canvas, a camera placed by the shot, the site's tone mapping.
// No <Suspense> of our own here: ThreeCanvas already wraps its children in one that holds the render until every
// model and texture is in. A second boundary inside it would swallow that signal and frames would come out empty.
const Rig = ({ pos, target, fov }) => {
  const { camera } = useThree();
  camera.position.set(...pos); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(...target);
  return null;
};
const Env = () => { // reflections for glass and steel
  const { gl, scene } = useThree();
  useMemo(() => { scene.environment = new THREE.PMREMGenerator(gl).fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.75; }, [gl, scene]);
  return null;
};
export const Stage = ({ cam, bg = C.lab, children }) => {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas width={width} height={height} style={{ position: "absolute", inset: 0 }} camera={{ fov: cam.fov, near: 0.1, far: 400, position: cam.pos }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.AgXToneMapping; gl.toneMappingExposure = 1.15; }}>
      <color attach="background" args={[bg]} />
      <Rig {...cam} />
      <Env />
      {children}
    </ThreeCanvas>
  );
};
// camera between two key positions; k is 0..1
export const camMix = (a, b, k) => ({ pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k), target: a.target.map((v, i) => v + (b.target[i] - v) * k), fov: a.fov + (b.fov - a.fov) * k });

const baked = (tex) => { tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.needsUpdate = true; return new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(GAIN, GAIN, GAIN) }); };
const RoomLight = () => (<><hemisphereLight args={[0xffffff, 0xc4c8cc, 1.7]} /><directionalLight args={[0xffffff, 1.2]} position={[2, 6, 3]} /></>);

// ---- the lab (site/models/lab.glb + two baked atlases)
export const Lab = () => {
  const gltf = useGLTF(staticFile("lab.glb"));
  const [shell, furn] = useTexture([staticFile("lab_shell.webp"), staticFile("lab_furn.webp")]);
  const scene = useMemo(() => {
    const mats = { lab_shell: baked(shell), lab_furn: baked(furn), lab_glass: new THREE.MeshStandardMaterial({ color: 0xdff2f0, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false }) };
    const s = gltf.scene.clone(true);
    s.traverse((o) => { if (o.isMesh) o.material = mats[o.material.name] || mats.lab_furn; });
    return s;
  }, [gltf, shell, furn]);
  return (<><RoomLight /><primitive object={scene} /></>);
};

// ---- the corridor (site/models/hall.glb + one atlas), with its doors, windows and the eye at the end
const DOORS = [[-1, -3.6], [1, -3.6], [-1, -8.8], [1, -8.8]];
export const Hall = ({ open = -1, openK = 0, t = 0 }) => {
  const gltf = useGLTF(staticFile("hall.glb"));
  const tex = useTexture(staticFile("hall_shell.webp"));
  const scene = useMemo(() => { const m = baked(tex), s = gltf.scene.clone(true); s.traverse((o) => { if (o.isMesh) o.material = m; }); return s; }, [gltf, tex]);
  return (
    <>
      <RoomLight />
      <primitive object={scene} />
      {DOORS.map(([s, z], i) => {
        const wx = s * 1.68, k = i === open ? openK : 0;
        return (
          <group key={i}>
            <mesh position={[wx - s * 0.004, 1.1, z]} rotation={[0, -s * Math.PI / 2, 0]}><planeGeometry args={[1.0, 2.2]} /><meshBasicMaterial color={[2.3, 2.4, 2.5]} /></mesh>
            <group position={[wx - s * 0.03, 0, z + 0.525]} rotation={[0, -s * 1.5 * k, 0]}>
              <mesh position={[0, 1.125, -0.525]}><boxGeometry args={[0.08, 2.25, 1.05]} /><meshStandardMaterial color={0xe6e9eb} roughness={0.32} metalness={0.1} /></mesh>
              {[0.35, 1.9].map((y) => <mesh key={y} position={[-s * 0.005, y, -0.525]}><boxGeometry args={[0.1, 0.07, 1.07]} /><meshStandardMaterial color={0xb4b9be} roughness={0.25} metalness={1} /></mesh>)}
              <mesh position={[-s * 0.07, 1.05, -0.9]}><sphereGeometry args={[0.05, 14, 10]} /><meshStandardMaterial color={0x8e9499} roughness={0.3} metalness={0.9} /></mesh>
            </group>
            <mesh position={[wx, 1.7, z - 1.5]} rotation={[0, -s * Math.PI / 2, 0]}><planeGeometry args={[1.5, 1.1]} /><meshBasicMaterial color={[0.93 + Math.sin(t * 2.3 + z) * 0.03, 0.97, 1.0]} /></mesh>
            {[[1.62, 0.07, 0.58, 0], [1.62, 0.07, -0.58, 0], [0.07, 1.2, 0, 0.78], [0.07, 1.2, 0, -0.78], [0.04, 1.1, 0, 0]].map(([w, h, dy, dz], j) => (
              <mesh key={j} position={[wx - s * 0.02, 1.7 + dy, z - 1.5 + dz]}><boxGeometry args={[0.06, h, w]} /><meshStandardMaterial color={0x2a2d31} roughness={0.4} metalness={0.7} /></mesh>))}
          </group>
        );
      })}
      <mesh position={[0, 1.75, -13.67]}><circleGeometry args={[0.5, 40]} /><meshBasicMaterial color={0x030807} /></mesh>
      <mesh position={[0, 1.75, -13.66]}><ringGeometry args={[0.1, 0.16, 40]} /><meshBasicMaterial color={[0.9, 2.4, 2.0]} /></mesh>
      <mesh position={[0, 1.75, -13.65]}><torusGeometry args={[0.55, 0.07, 12, 48]} /><meshStandardMaterial color={0xb4b9be} roughness={0.25} metalness={1} /></mesh>
    </>
  );
};

// ---- a member of staff (site/models/staff-*.glb), standing at `at`, turned towards `face`
export const Staff = ({ who = "assayer", at = [0.1, 0, -0.02], face = [3.6, 3.5], scale = 1, t = 0 }) => {
  const gltf = useGLTF(staticFile(`staff-${who}.glb`));
  const scene = useMemo(() => {
    const s = gltf.scene.clone(true);
    s.traverse((o) => { if (o.isMesh) { o.frustumCulled = false; o.material = o.material.clone(); if (/glass/.test(o.material.name)) { o.material.vertexColors = false; o.material.envMapIntensity = 1.6; } } });
    return s;
  }, [gltf]);
  const yaw = Math.atan2(-(face[0] - at[0]), -(face[1] - at[2])) + Math.sin(t * 0.5) * 0.04; // the model faces -Z
  return (
    <group position={at} rotation={[0, yaw, Math.sin(t * 0.9) * 0.008]} scale={scale}>
      <primitive object={scene} position={[0, Math.sin(t * 1.4) * 0.004, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}><circleGeometry args={[0.6, 40]} /><meshBasicMaterial color={0x14181c} transparent opacity={0.28} depthWrite={false} /></mesh>
    </group>
  );
};

// ---- the specimen shelf: one sealed tube per call. `sealed` 0..1 runs a wave along the wall that seals them one by one;
// `resolved` 0..1 turns them from "open" to their outcome.
const TUBE = { raw: new THREE.Color("#4f585e"), flash: new THREE.Color("#8dffe6"), open: new THREE.Color("#c9d2d6"), held: new THREE.Color("#59e7ca"), watch: new THREE.Color("#ffc24a"), rug: new THREE.Color("#ff4d6a") };
function rand(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export const Shelf = ({ resolved = 1, sealed = 1, t = 0 }) => {
  const ref = useRef();
  const plan = useMemo(() => { const r = rand(17); return Array.from({ length: 320 }, () => { const x = r(); return { kind: x < 0.7 ? "held" : x < 0.87 ? "watch" : "rug", when: r() }; }); }, []);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), c = new THREE.Color(), im = ref.current;
    for (let i = 0; i < 320; i++) {
      const row = Math.floor(i / 64);
      m.makeTranslation(-4.75 + (i % 64) * 0.15, 3.42 - row * 0.56, -3.2); im.setMatrixAt(i, m);
      const p = plan[i], on = resolved >= p.when;
      const s0 = ((i % 64) / 64) * 0.88 + row * 0.02, done = sealed >= 1 ? 1 : (sealed - s0) / 0.06;
      if (on) { c.copy(TUBE[p.kind]); if (p.kind === "rug") c.multiplyScalar(0.75 + 0.25 * Math.abs(Math.sin(t * 5 + i))); }
      else if (done <= 0) c.copy(TUBE.raw);
      else if (done < 1) c.copy(TUBE.flash).multiplyScalar(1.5 - done * 0.5);
      else c.copy(TUBE.open);
      im.setColorAt(i, c);
    }
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[null, null, 320]} frustumCulled={false}><cylinderGeometry args={[0.036, 0.036, 0.27, 10]} /><meshBasicMaterial color={0xffffff} toneMapped={false} /></instancedMesh>;
};

// ---- the specimen tank: white enamel, steel, glass, a liquid that glows
export const Tank = ({ level = 0.45, color = "#7fd6ff", t = 0 }) => {
  const H = 1.9, Y0 = 0.32, col = new THREE.Color(color);
  return (
    <group position={[-2.15, 0, -1.55]}>
      <mesh position={[0, 0.15, 0]}><cylinderGeometry args={[0.62, 0.7, 0.3, 40]} /><meshStandardMaterial color={0xe3e6e9} roughness={0.32} metalness={0.15} /></mesh>
      <mesh position={[0, Y0, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.5, 0.04, 10, 48]} /><meshStandardMaterial color={0xaeb3b8} roughness={0.25} metalness={1} /></mesh>
      <mesh position={[0, Y0 + (H * level) / 2, 0]}><cylinderGeometry args={[0.36, 0.36, H * level, 40]} /><meshBasicMaterial color={col.clone().multiplyScalar(1.15 + Math.sin(t * 2) * 0.05)} transparent opacity={0.92} /></mesh>
      <mesh position={[0, Y0 + H / 2, 0]}><cylinderGeometry args={[0.42, 0.42, H, 40, 1, true]} /><meshStandardMaterial color={0xcfe0e0} transparent opacity={0.2} roughness={0.05} metalness={0.2} side={THREE.DoubleSide} depthWrite={false} /></mesh>
      <mesh position={[0, Y0 + H + 0.17, 0]}><cylinderGeometry args={[0.5, 0.46, 0.34, 40]} /><meshStandardMaterial color={0xe3e6e9} roughness={0.32} metalness={0.15} /></mesh>
      <mesh position={[0, Y0 + H, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.5, 0.04, 10, 48]} /><meshStandardMaterial color={0xaeb3b8} roughness={0.25} metalness={1} /></mesh>
      <pointLight args={[col, 6, 9, 1.6]} position={[0.2, 1.4, 0.5]} />
    </group>
  );
};

// ---- what stands on the bench: three screens, a keyboard, the test button
const screenTex = (seed, accent) => {
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 300; const g = cv.getContext("2d"), r = rand(seed);
  g.fillStyle = "#0b0d10"; g.fillRect(0, 0, 512, 300); g.fillStyle = accent; g.fillRect(0, 0, 512, 26);
  g.fillStyle = "#cfd6da"; for (let i = 0; i < 9; i++) g.fillRect(22, 50 + i * 26, 80 + r() * 300, 7);
  g.strokeStyle = "#59e7ca"; g.lineWidth = 3; g.beginPath(); for (let i = 0; i <= 20; i++) { const x = 300 + i * 9, y = 250 - r() * 60 - i * 2; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
};
export const Bench = () => {
  const tex = useMemo(() => [screenTex(3, "#d9b77a"), screenTex(8, "#59e7ca"), screenTex(21, "#ff8a9a")], []);
  return (
    <group>
      {[[-0.98, 0.34], [0, 0], [0.98, -0.34]].map(([x, ry], i) => (
        <group key={i} position={[x, 1.33, -1.18 + Math.abs(x) * 0.12]} rotation={[0, ry, 0]}>
          <mesh><boxGeometry args={[0.92, 0.56, 0.035]} /><meshStandardMaterial color={0x101215} roughness={0.35} metalness={0.4} /></mesh>
          <mesh position={[0, 0, 0.019]}><planeGeometry args={[0.86, 0.5]} /><meshBasicMaterial map={tex[i]} /></mesh>
          <mesh position={[0, -0.36, -0.02]}><cylinderGeometry args={[0.02, 0.02, 0.2, 10]} /><meshStandardMaterial color={0x8e9499} roughness={0.3} metalness={0.9} /></mesh>
          <mesh position={[0, -0.47, -0.02]}><cylinderGeometry args={[0.13, 0.13, 0.015, 24]} /><meshStandardMaterial color={0x8e9499} roughness={0.3} metalness={0.9} /></mesh>
        </group>))}
      <mesh position={[-0.05, 0.86, -0.78]}><boxGeometry args={[0.62, 0.02, 0.2]} /><meshStandardMaterial color={0x16181b} roughness={0.5} /></mesh>
      <mesh position={[0.82, 0.87, -0.82]}><cylinderGeometry args={[0.13, 0.15, 0.05, 28]} /><meshStandardMaterial color={0x16181b} roughness={0.5} /></mesh>
      <mesh position={[0.82, 0.925, -0.82]}><cylinderGeometry args={[0.1, 0.1, 0.07, 28]} /><meshStandardMaterial color={0xff7d8d} emissive={0xff4d6a} emissiveIntensity={0.35} roughness={0.4} /></mesh>
    </group>
  );
};

// ---- the Gate's wall display: one word, large
const DEC = { allow: "#59e7ca", warn: "#ffc24a", block: "#ff4d6a", call: "#59e7ca" };
export const GateBoard = ({ decision = "allow" }) => {
  const tex = useMemo(() => {
    const cv = document.createElement("canvas"); cv.width = 1400; cv.height = 800; const g = cv.getContext("2d");
    g.fillStyle = "#0b0d10"; g.fillRect(0, 0, 1400, 800); g.textBaseline = "top";
    g.fillStyle = "#8b9096"; g.font = `500 26px ${MONO}, monospace`; g.fillText("THE GATE  ·  PRE-TRADE CHECK FOR AGENTS", 44, 36);
    if (decision === "call") { // the question, before the answer
      g.fillStyle = "#e9e5df"; g.font = `700 128px ${MONO}, monospace`; g.fillText("check_before_buy", 40, 190);
      g.fillStyle = DEC.call; g.font = `700 128px ${MONO}, monospace`; g.fillText("( mint )", 40, 340);
      g.fillStyle = "#e9e5df"; g.font = `500 40px ${MONO}, monospace`; g.fillText("one call, before the trade", 44, 540);
    } else {
      g.fillStyle = DEC[decision]; g.font = `700 300px ${MONO}, monospace`; g.fillText(decision.toUpperCase(), 34, 150);
      g.fillStyle = "#e9e5df"; g.font = `500 40px ${MONO}, monospace`;
      g.fillText({ allow: "no known red flag", warn: "middling score, failed check, risky deployer", block: "a hard flag, or a score above the limit" }[decision], 44, 520);
    }
    g.fillStyle = "#8b9096"; g.font = `500 24px ${MONO}, monospace`; g.fillText("check_before_buy  ·  reasons  ·  deployer record  ·  ledger hash", 44, 700);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }, [decision]);
  return (
    <group position={[-0.5, 2.42, -3.05]}>
      <mesh><planeGeometry args={[4.9, 2.8]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
      {[[5.1, 0.1, 0, 1.45], [5.1, 0.1, 0, -1.45], [0.1, 3.0, -2.5, 0], [0.1, 3.0, 2.5, 0]].map(([w, h, x, y], i) => (
        <mesh key={i} position={[x, y, 0.02]}><boxGeometry args={[w, h, 0.08]} /><meshStandardMaterial color={0x2a2d31} roughness={0.35} metalness={0.6} /></mesh>))}
    </group>
  );
};

for (const f of ["lab.glb", "hall.glb", "staff-assayer.glb", "staff-archivist.glb", "staff-broker.glb", "staff-smith.glb"]) useGLTF.preload(staticFile(f));
