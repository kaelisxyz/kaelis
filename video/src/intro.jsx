// Intro, 10 s. A question, then the answer.
//   0-2 s   the tower in the dark, floors switching on     "Every scanner checks the token."
//   2-4 s   the eye, shut, then open                        "No one checks who launched it."
//   4-6 s   the drop: the whole K                           "Kaelis does."
//   6-8 s   an arc across it                                "The trust layer for Solana."
//   8-10 s  the mark
// Cuts land on the bar lines of the score (120 bpm: a bar is 60 frames).
// The narrator tells it. Captions sit bottom centre like film subtitles; the name and the tagline stand left,
// beside the K. The video still reads with the sound off. No phrase here is used again in the Live video.
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Shot, Flash, Scrim, Block, MarkSlam, Words, Sub, ramp } from "./ui";
import VO from "./vo.json";

const V = VO.intro;
const Cut = ({ from, frames = 60, children }) => <Sequence from={from} durationInFrames={frames}>{children}</Sequence>;
const at = (line, from, share = 0) => Math.round((line.at + line.spoken * share) * 30) - from; // the frame, inside a cut, a line is spoken

export const Intro = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#05070a" }}>
      <Cut from={0}>
        <Shot name="climb" n={60} punch={0} />
        <Sub text="Scanners check the token." mark="the token." at={at(V.i1, 0)} total={60} />
      </Cut>
      <Cut from={60}>
        <Shot name="eye_open" n={60} punch={0.03} />
        <Sub text="Who launched it?" mark="Who" at={at(V.i2, 60, 0.44)} total={60} />
      </Cut>
      <Cut from={120}>
        <Shot name="reveal" n={60} punch={0.07} shake={14} shift={170} /><Scrim />
        <Block total={60} top={440}><MarkSlam at={3} size={160} /></Block>
        <Flash strength={0.85} frames={9} />
      </Cut>
      <Cut from={180}>
        <Shot name="sweep" n={60} punch={0.04} />
      </Cut>
      <Cut from={240}>
        <Shot name="hero" n={105} punch={0.05} shake={8} /><Scrim />
        <Block top={400} gap={30}>
          <MarkSlam at={2} size={150} step={1.2} />
          <Words text="The trust layer for Solana." at={12} step={2} size={60} weight={400} color="rgba(242,240,234,.92)" track="-0.02em" />
        </Block>
        <Flash strength={0.55} frames={8} />
      </Cut>
      <AbsoluteFill style={{ background: "#000", opacity: ramp(f, 0, 7, 1, 0), pointerEvents: "none" }} />
      <Audio src={staticFile("audio/kaelis-intro.wav")} />
    </AbsoluteFill>
  );
};
