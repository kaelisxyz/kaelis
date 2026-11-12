// The Kaelis videos for X. 1920x1080, 30 fps, no sound (X plays muted): every message is on screen.
import React from "react";
import { AbsoluteFill, Img, Sequence, staticFile, useCurrentFrame, interpolate, Easing } from "remotion";
import { C, MONO, SANS, FPS } from "./theme";
import { Words, Kicker, Caption, Foot, Mark, Fade, ramp, clamp } from "./ui";
import { Stage, Lab, Hall, Staff, Shelf, Tank, Bench, GateBoard, camMix } from "./scenes3d";

const K_FRAMES = 96; // tools/3d/logo_k_spin.py renders this loop into public/k
const smooth = Easing.bezier(0.45, 0, 0.2, 1);

// ---- the K, swaying, as full-frame footage (rendered in Blender Cycles). `shift` pushes it right to leave room for type.
const KLoop = ({ shift = 390, zoomFrom = 1.1, zoomTo = 1.18, total = 300 }) => {
  const f = useCurrentFrame();
  const n = String(Math.floor(f) % K_FRAMES).padStart(4, "0"), z = interpolate(f, [0, total], [zoomFrom, zoomTo], clamp);
  return (
    <AbsoluteFill style={{ background: "#05070a" }}>
      <Img src={staticFile(`k/k${n}.jpg`)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `translateX(${shift}px) scale(${z})`, transformOrigin: "50% 60%" }} />
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(5,7,10,1) 0%, rgba(5,7,10,.92) 24%, rgba(5,7,10,0) 58%)" }} />
    </AbsoluteFill>
  );
};

const BlackIn = ({ frames = 20 }) => { const f = useCurrentFrame(); return <AbsoluteFill style={{ background: "#000", opacity: ramp(f, 0, frames, 1, 0, Easing.linear) }} />; };

// =========================================================================== 1. Intro, 15 s
export const Intro = () => {
  const f = useCurrentFrame();
  const black = ramp(f, 0, 22, 1, 0, Easing.linear);
  return (
    <AbsoluteFill style={{ background: "#05070a" }}>
      <KLoop total={450} />
      <div style={{ position: "absolute", left: 110, top: 96 }}><Mark at={18} size={36} /></div>
      <div style={{ position: "absolute", left: 110, top: 330, display: "grid", gap: 34 }}>
        <Words text="The trust layer" at={44} size={132} />
        <Words text="for Solana." at={56} size={132} style={{ marginTop: -34 }} />
        <div style={{ display: "grid", gap: 10, marginTop: 18 }}>
          <Words text="Ratings for the wallets behind tokens." at={150} size={44} weight={400} color="rgba(242,240,234,.86)" track="-0.01em" />
          <Words text="A safety check for AI agents." at={205} size={44} weight={400} color="rgba(242,240,234,.86)" track="-0.01em" />
        </div>
      </div>
      <div style={{ position: "absolute", left: 110, bottom: 108, display: "flex", alignItems: "baseline", gap: 34 }}>
        <Words text="Proof, not vibes." at={300} size={50} font={MONO} weight={500} color={C.mint} track="0" />
      </div>
      <AbsoluteFill style={{ background: "#000", opacity: black }} />
    </AbsoluteFill>
  );
};

// =========================================================================== 2. Live, 30 s
const walkBob = (f) => [Math.sin(f * 0.24) * 0.02, Math.abs(Math.sin(f * 0.24)) * 0.035];

const HallShot = ({ total }) => {
  const f = useCurrentFrame(), k = ramp(f, 0, total, 0, 1, smooth), [bx, by] = walkBob(f);
  const z = 2.6 - k * 4.9, look = ramp(f, total * 0.55, total, 0, 1, smooth); // walk in, then turn to the first door as it opens
  const cam = { pos: [bx * (1 - look), 1.62 + by * (1 - look * 0.6), z], target: [-look * 3.0, 1.55, z - 6 + look * 4.2], fov: 62 };
  return (
    <Fade total={total}>
      <Stage cam={cam} bg={C.lab}><Hall open={0} openK={ramp(f, total * 0.62, total * 0.92, 0, 1, smooth)} t={f / FPS} /></Stage>
      <Caption dark={false}>
        <Kicker at={8} color={C.ink}>Inside the tower</Kicker>
        <Words text="Step inside." at={14} size={84} color={C.ink} />
        <Words text="Four rooms. One public record." at={62} size={38} weight={400} color="rgba(11,11,12,.78)" track="-0.01em" />
      </Caption>
    </Fade>
  );
};

const RoomShot = ({ total, from, to, kicker, head, sub, children, dark = false }) => {
  const f = useCurrentFrame(), cam = camMix(from, to, ramp(f, 0, total, 0, 1, smooth));
  return (
    <Fade total={total}>
      <Stage cam={cam} bg={C.lab}><Lab /><Bench />{typeof children === "function" ? children(f) : children}</Stage>
      <Caption dark={dark}>
        <Kicker at={8} color={dark ? C.mint : C.ink}>{kicker}</Kicker>
        <Words text={head} at={14} size={76} color={dark ? C.paper : C.ink} />
        <Words text={sub} at={62} size={38} weight={400} color={dark ? "rgba(242,240,234,.86)" : "rgba(11,11,12,.78)"} track="-0.01em" />
      </Caption>
    </Fade>
  );
};

const LiveOpen = ({ total }) => (
  <Fade total={total} inF={1}>
    <KLoop total={total} shift={390} />
    <div style={{ position: "absolute", left: 110, top: 96 }}><Mark at={6} size={36} /></div>
    <div style={{ position: "absolute", left: 110, top: 380, display: "grid", gap: 26 }}>
      <Kicker at={10}>Now live</Kicker>
      <Words text="Kaelis is live." at={16} size={150} />
    </div>
    <BlackIn frames={20} />
  </Fade>
);
const LiveEnd = ({ total }) => {
  const f = useCurrentFrame();
  return (
    <Fade total={total} outF={1}>
      <KLoop total={total} shift={390} zoomFrom={1.14} zoomTo={1.2} />
      <div style={{ position: "absolute", left: 110, top: 96 }}><Mark at={4} size={36} /></div>
      <div style={{ position: "absolute", left: 110, top: 330, display: "grid", gap: 24 }}>
        <Words text="The trust layer" at={8} size={112} />
        <Words text="for Solana." at={16} size={112} style={{ marginTop: -24 }} />
        <div style={{ marginTop: 30 }}><Words text="Proof, not vibes." at={40} size={56} font={MONO} weight={500} color={C.mint} track="0" /></div>
      </div>
      <Foot text="" note="No token yet. The track record comes first. Not financial advice." />
    </Fade>
  );
};

export const LIVE = { open: 110, hall: 180, assay: 180, archive: 170, gate: 150, end: 110 };
export const LIVE_TOTAL = Object.values(LIVE).reduce((a, b) => a + b, 0);
export const Live = () => {
  let t = 0; const at = (n) => { const s = t; t += n; return s; };
  const DEC = ["allow", "warn", "block"];
  return (
    <AbsoluteFill style={{ background: C.lab }}>
      <Sequence from={at(LIVE.open)} durationInFrames={LIVE.open}><LiveOpen total={LIVE.open} /></Sequence>
      <Sequence from={at(LIVE.hall)} durationInFrames={LIVE.hall}><HallShot total={LIVE.hall} /></Sequence>
      <Sequence from={at(LIVE.assay)} durationInFrames={LIVE.assay}>
        <RoomShot total={LIVE.assay} kicker="I · The Assay Room" head="Every token gets tested." sub="Every call is sealed on a public ledger."
          from={{ pos: [4.6, 2.5, 4.6], target: [-2.2, 0.75, -1.0], fov: 50 }} to={{ pos: [3.3, 2.0, 3.5], target: [-2.0, 0.8, -1.0], fov: 50 }}>
          {(f) => (<><Shelf resolved={0.55} t={f / FPS} /><Tank level={0.3 + ramp(f, 30, 150) * 0.6} color="#7fd6ff" t={f / FPS} /><Staff who="assayer" at={[0.1, 0, -0.02]} face={[3.4, 3.4]} t={f / FPS} /></>)}
        </RoomShot>
      </Sequence>
      <Sequence from={at(LIVE.archive)} durationInFrames={LIVE.archive}>
        <RoomShot total={LIVE.archive} kicker="II · The Archive" head="Graded 7 days later." sub="Hits and misses, published by name."
          from={{ pos: [3.0, 2.9, 4.6], target: [-2.4, 1.2, -3.0], fov: 52 }} to={{ pos: [1.6, 2.5, 2.8], target: [-2.6, 1.4, -3.2], fov: 52 }}>
          {(f) => (<><Shelf resolved={ramp(f, 20, 150, 0, 1, Easing.linear)} t={f / FPS} /><Tank level={0.45} t={f / FPS} /><Staff who="archivist" at={[2.0, 0, -2.05]} face={[2.2, 3.6]} scale={0.93} t={f / FPS} /></>)}
        </RoomShot>
      </Sequence>
      <Sequence from={at(LIVE.gate)} durationInFrames={LIVE.gate}>
        <RoomShot total={LIVE.gate} kicker="III · The Gate" head="One call before the trade." sub="Allow, warn or block: the check AI agents run."
          from={{ pos: [3.2, 2.6, 4.7], target: [-2.0, 1.3, -3.0], fov: 52 }} to={{ pos: [2.4, 2.4, 3.7], target: [-1.9, 1.4, -3.0], fov: 52 }}>
          {(f) => (<><GateBoard decision={DEC[Math.min(2, Math.floor(f / (LIVE.gate / 3)))]} /><Tank level={0.45} t={f / FPS} /><Staff who="broker" at={[2.5, 0, -2.2]} face={[2.6, 3.8]} t={f / FPS} /></>)}
        </RoomShot>
      </Sequence>
      <Sequence from={at(LIVE.end)} durationInFrames={LIVE.end}><LiveEnd total={LIVE.end} /></Sequence>
    </AbsoluteFill>
  );
};
