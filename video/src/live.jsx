// "Kaelis is live", 30 s. A walk through what runs today, told by one voice.
//    0 s  the K                       "Kaelis is live."
//    2 s  the corridor, a door opens  (no words: the score builds)
//    4 s  the Assay Room              "Every token that comes through here gets tested."
//    8 s  the wall of tubes sealing   "Every call, sealed on a public ledger."
//   12 s  the Archive                 "Seven days later, it's graded. Hits and misses, published by name."
//   16 s  down a tube to the tower    "Behind every token is a wallet. We keep a record on those too."
//   20 s  the Gate                    "And before an AI agent buys, one call."
//   24.5  the eye                     "Allow. Warn. Block."
//   26.5  the mark                    "Kaelis. Proof, not vibes."
// Cuts sit on the beats of the score (120 bpm: a beat is 15 frames).
// The narrator tells it. One short caption per part, bottom centre like film subtitles; the titles (the opening line,
// the three verdicts, the name) stand left, beside the K. No labels, cards or small print. It reads with the sound off.
// Nothing said or shown here repeats the Intro: that one says what Kaelis is, this one shows what runs.
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, Easing } from "remotion";
import { C, MONO, FPS } from "./theme";
import { Shot, Flash, Scrim, Block, Slam, MarkSlam, Words, Sub, ramp } from "./ui";
import { Stage, Lab, Hall, Staff, Shelf, Tank, Bench, GateBoard, camMix } from "./scenes3d";
import VO from "./vo.json";

const V = VO.live;
const smooth = Easing.bezier(0.45, 0, 0.2, 1);
// a camera move that starts fast and never quite stops
const snap = (f, total, part = 0.45, w = 0.8) => w * ramp(f, 0, total * part) + (1 - w) * (f / total);
const said = (id, from) => Math.round(V[id].at * 30) - from; // the frame, inside a part, a line is spoken


// ---- a room shot: the lab, a camera move, what stands in it
const Room = ({ total, from, to, part, w, children, phrase, mark, at, last }) => {
  const f = useCurrentFrame(), cam = camMix(from, to, snap(f, total, part, w));
  return (
    <AbsoluteFill>
      <Stage cam={cam} bg={C.lab}><Lab /><Bench />{typeof children === "function" ? children(f) : children}</Stage>
      {phrase && <Sub text={phrase} mark={mark} at={at} total={last ? total : 0} />}
    </AbsoluteFill>
  );
};

const Open = () => (
  <AbsoluteFill>
    <Shot name="reveal" n={60} punch={0.07} shake={14} shift={170} /><Scrim />
    <Block total={60} top={450}><Words text="Kaelis is live." at={said("l1", 0)} step={3} size={120} /></Block>
    <Flash strength={0.85} frames={9} />
  </AbsoluteFill>
);

const Corridor = ({ total }) => {
  const f = useCurrentFrame(), k = ramp(f, 0, total, 0, 1, smooth), look = ramp(f, total * 0.42, total, 0, 1, smooth), z = 2.8 - k * 5.4;
  const bob = Math.abs(Math.sin(f * 0.42)) * 0.03 * (1 - look);
  return (
    <AbsoluteFill>
      <Stage cam={{ pos: [0, 1.62 + bob, z], target: [-look * 3.0, 1.55, z - 6 + look * 4.2], fov: 68 }} bg={C.lab}><Hall open={0} openK={ramp(f, total * 0.4, total * 0.88, 0, 1, smooth)} t={f / FPS} /></Stage>
      <Flash strength={0.7} frames={7} color="#ffffff" />
    </AbsoluteFill>
  );
};

const Wallet = ({ total, start }) => (
  <AbsoluteFill>
    <Shot name="trace" n={135} from={6} punch={0.04} />
    <Sub text="The wallet behind it." mark="wallet" at={said("l6", start)} total={total} />
    <Flash strength={1} frames={6} color="#000" />
  </AbsoluteFill>
);

const VERDICT = [["ALLOW", C.mint], ["WARN", C.amber], ["BLOCK", C.red]];
const Verdict = ({ total }) => {
  const f = useCurrentFrame(), n = Math.min(2, Math.floor(f / 15)), [word, col] = VERDICT[n];
  return (
    <AbsoluteFill>
      <Shot name="verdict" n={60} punch={0.03} /><Scrim />
      <Block total={total} top={430} hold={3}><div key={n}><Slam at={n * 15} size={200} color={col}>{word}</Slam></div></Block>
      <Flash at={0} strength={0.35} frames={6} color={C.mint} /><Flash at={15} strength={0.35} frames={6} color={C.amber} /><Flash at={30} strength={0.45} frames={7} color={C.red} />
    </AbsoluteFill>
  );
};

const Close = ({ start }) => {
  const at = said("l10", start);
  return (
    <AbsoluteFill>
      <Shot name="hero" n={105} punch={0.05} shake={8} /><Scrim />
      <Block top={400} gap={30}>
        <MarkSlam at={at - 2} size={150} step={1.2} />
        <Words text="Proof, not vibes." at={at + 18} step={3} size={60} font={MONO} weight={500} color={C.mint} track="0" />
      </Block>
      <Flash strength={0.55} frames={8} />
    </AbsoluteFill>
  );
};

// where each part starts and how long it runs, in frames
export const LIVE = [["open", 0, 60], ["hall", 60, 60], ["assayA", 120, 60], ["assayB", 180, 60], ["sealA", 240, 60], ["sealB", 300, 60], ["archiveA", 360, 60], ["archiveB", 420, 60],
  ["wallet", 480, 120], ["gateA", 600, 60], ["gateB", 660, 75], ["verdict", 735, 60], ["close", 795, 105]];
export const LIVE_TOTAL = 900;
const ON = -100; // a phrase carried over from the shot before

export const Live = () => {
  const P = Object.fromEntries(LIVE.map(([k, a, n]) => [k, { from: a, durationInFrames: n }]));
  const t = (f) => f / FPS, lin = Easing.linear;
  const sealed = (g) => (g < 300 ? ramp(g, 240, 300, 0.36, 0.72, lin) : ramp(g, 300, 352, 0.72, 1.08, lin)), // the wave stays in front of the camera
    graded = (g) => ramp(g, 366, 476, 0, 1, lin);
  return (
    <AbsoluteFill style={{ background: C.lab }}>
      <Sequence {...P.open}><Open /></Sequence>
      <Sequence {...P.hall}><Corridor total={60} /></Sequence>

      <Sequence {...P.assayA}>
        <Room total={60} from={{ pos: [4.7, 2.7, 4.7], target: [-2.2, 0.75, -1.0], fov: 50 }} to={{ pos: [3.3, 2.0, 3.5], target: [-2.0, 0.8, -1.0], fov: 50 }}
          phrase="Every token, tested." mark="tested." at={said("l2", 120)}>
          {(f) => (<><Shelf resolved={0} sealed={0} /><Tank level={0.25 + ramp(f, 0, 60, 0, 0.3, lin)} t={t(f)} /><Staff who="assayer" at={[0.1, 0, -0.02]} face={[3.4, 3.4]} t={t(f)} /></>)}
        </Room>
        <Flash strength={0.75} frames={8} color="#ffffff" />
      </Sequence>
      <Sequence {...P.assayB}>
        <Room total={60} last from={{ pos: [2.2, 1.8, 2.3], target: [-2.7, 1.35, -1.2], fov: 42 }} to={{ pos: [1.6, 1.68, 1.75], target: [-2.8, 1.4, -1.3], fov: 42 }}
          phrase="Every token, tested." mark="tested." at={ON}>
          {(f) => (<><Shelf resolved={0} sealed={0} /><Tank level={0.55 + ramp(f, 0, 60, 0, 0.35, lin)} t={t(f + 60)} /><Staff who="assayer" at={[0.1, 0, -0.02]} face={[3.4, 3.4]} t={t(f + 60)} /></>)}
        </Room>
      </Sequence>

      <Sequence {...P.sealA}>
        <Room total={60} part={1} w={0} from={{ pos: [-1.9, 3.05, -1.25], target: [-1.0, 3.0, -3.2], fov: 44 }} to={{ pos: [1.9, 3.05, -1.25], target: [2.8, 3.0, -3.2], fov: 44 }}
          phrase="Every call, sealed." mark="sealed." at={said("l3", 240)}>
          {(f) => <Shelf resolved={0} sealed={sealed(f + 240)} />}
        </Room>
      </Sequence>
      <Sequence {...P.sealB}>
        <Room total={60} last from={{ pos: [3.4, 2.8, 4.6], target: [-0.8, 2.2, -3.2], fov: 50 }} to={{ pos: [2.3, 2.5, 3.3], target: [-0.9, 2.3, -3.2], fov: 50 }}
          phrase="Every call, sealed." mark="sealed." at={ON}>
          {(f) => (<><Shelf resolved={0} sealed={sealed(f + 300)} /><Tank level={0.9} t={t(f)} /><Staff who="assayer" at={[0.1, 0, -0.02]} face={[3.4, 3.4]} t={t(f)} /></>)}
        </Room>
      </Sequence>

      <Sequence {...P.archiveA}>
        <Room total={60} from={{ pos: [3.4, 3.0, 4.7], target: [-2.4, 1.3, -3.0], fov: 52 }} to={{ pos: [1.7, 2.5, 2.9], target: [-2.5, 1.4, -3.1], fov: 52 }}
          phrase="Graded 7 days later." mark="7 days" at={4}>
          {(f) => (<><Shelf resolved={graded(f + 360)} t={t(f)} /><Tank level={0.45} t={t(f)} /><Staff who="archivist" at={[2.0, 0, -2.05]} face={[2.2, 3.6]} scale={0.93} t={t(f)} /></>)}
        </Room>
        <Flash strength={0.5} frames={6} color="#ffffff" />
      </Sequence>
      <Sequence {...P.archiveB}>
        <Room total={60} last part={0.6} from={{ pos: [2.4, 2.3, -1.3], target: [1.5, 2.3, -3.2], fov: 46 }} to={{ pos: [-0.8, 2.3, -1.3], target: [-1.7, 2.3, -3.2], fov: 46 }}
          phrase="Graded 7 days later." mark="7 days" at={ON}>
          {(f) => <Shelf resolved={graded(f + 420)} t={t(f)} />}
        </Room>
      </Sequence>

      <Sequence {...P.wallet}><Wallet total={120} start={480} /></Sequence>

      <Sequence {...P.gateA}>
        <Room total={60} from={{ pos: [3.6, 2.8, 4.7], target: [-1.6, 1.9, -3.0], fov: 52 }} to={{ pos: [2.5, 2.4, 3.6], target: [-1.7, 2.0, -3.0], fov: 52 }}
          phrase="One call before the trade." mark="One call" at={said("l8", 600)}>
          {(f) => (<><GateBoard decision="call" /><Tank level={0.45} t={t(f)} /><Staff who="broker" at={[2.5, 0, -2.2]} face={[2.6, 3.8]} t={t(f)} /></>)}
        </Room>
        <Flash strength={0.75} frames={8} color="#ffffff" />
      </Sequence>
      <Sequence {...P.gateB}>
        <Room total={75} last from={{ pos: [2.2, 2.2, 2.9], target: [-2.4, 1.9, -3.05], fov: 46 }} to={{ pos: [1.6, 2.2, 1.9], target: [-2.5, 1.95, -3.05], fov: 46 }}
          phrase="One call before the trade." mark="One call" at={ON}>
          {(f) => (<><GateBoard decision="call" /><Tank level={0.45} t={t(f + 60)} /><Staff who="broker" at={[2.5, 0, -2.2]} face={[2.6, 3.8]} t={t(f + 60)} /></>)}
        </Room>
      </Sequence>

      <Sequence {...P.verdict}><Verdict total={60} /></Sequence>
      <Sequence {...P.close}><Close start={795} /></Sequence>
      <Audio src={staticFile("audio/kaelis-live.wav")} />
    </AbsoluteFill>
  );
};
