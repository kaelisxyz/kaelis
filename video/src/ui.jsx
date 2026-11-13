// Type and motion pieces used by every video. Words rise into place; nothing bounces.
import React from "react";
import { AbsoluteFill, Img, staticFile, interpolate, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import { C, SANS, MONO } from "./theme";

const out = Easing.bezier(0.16, 1, 0.3, 1);
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" };
export const ramp = (f, a, b, from = 0, to = 1, easing = out) => interpolate(f, [a, b], [from, to], { ...clamp, easing });

// fades a whole shot in and out at its edges
export const Fade = ({ children, total, inF = 12, outF = 12, style }) => {
  const f = useCurrentFrame();
  const o = Math.min(ramp(f, 0, inF, 0, 1, Easing.linear), ramp(f, total - outF, total, 1, 0, Easing.linear));
  return <AbsoluteFill style={{ opacity: o, ...style }}>{children}</AbsoluteFill>;
};

// a line of text whose words rise one after another
export const Words = ({ text, at = 0, step = 3, size = 96, weight = 500, color = C.paper, font = SANS, track = "-0.03em", lh = 1.02, max = 1500, style }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ fontFamily: font, fontSize: size, fontWeight: weight, color, letterSpacing: track, lineHeight: lh, maxWidth: max, display: "flex", flexWrap: "wrap", gap: `0 ${size * 0.26}px`, ...style }}>
      {String(text).split(" ").map((w, i) => {
        const k = ramp(f, at + i * step, at + i * step + 16);
        return <span key={i} style={{ display: "inline-block", opacity: k, transform: `translateY(${(1 - k) * size * 0.35}px)` }}>{w}</span>;
      })}
    </div>
  );
};

export const Kicker = ({ children, at = 0, color = C.mint, style }) => {
  const f = useCurrentFrame(), k = ramp(f, at, at + 14);
  return <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: "0.16em", textTransform: "uppercase", color, opacity: k, ...style }}>{children}</div>;
};

// lower-left caption. Over the dark K footage: a soft scrim. Over the bright lab: the site's own paper card with ink type.
export const Caption = ({ children, dark = true, bottom = 84, left = 84 }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {dark && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(6,8,10,.82) 0%, rgba(6,8,10,.5) 22%, rgba(6,8,10,0) 48%)" }} />}
    <div style={{ position: "absolute", left, bottom, display: "grid", gap: 16, ...(dark ? {} : { background: C.paper, border: `1.5px solid ${C.ink}`, padding: "30px 40px 34px", boxShadow: "0 30px 80px rgba(11,11,12,.18)" }) }}>{children}</div>
  </AbsoluteFill>
);

export const Foot = ({ dark = true, text = "", note }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <div style={{ position: "absolute", right: 70, bottom: 54, fontFamily: MONO, fontSize: 22, letterSpacing: "0.12em", color: dark ? "rgba(242,240,234,.72)" : "rgba(11,11,12,.7)" }}>{text}</div>
    {note && <div style={{ position: "absolute", left: 110, bottom: 54, fontFamily: MONO, fontSize: 22, letterSpacing: "0.1em", textTransform: "uppercase", color: dark ? "rgba(242,240,234,.62)" : "rgba(11,11,12,.6)" }}>{note}</div>}
  </AbsoluteFill>
);

// the KAELIS wordmark as on the site: every second letter outlined
export const Mark = ({ size = 34, color = C.paper, at = 0 }) => {
  const f = useCurrentFrame(), k = ramp(f, at, at + 16);
  return (
    <div style={{ display: "flex", fontFamily: SANS, fontWeight: 600, fontSize: size, letterSpacing: "0.16em", opacity: k }}>
      {"KAELIS".split("").map((ch, i) => <span key={i} style={i % 2 ? { color: "transparent", WebkitTextStroke: `1.5px ${color}` } : { color }}>{ch}</span>)}
    </div>
  );
};

// night backdrop with a faint grid, for the pure type shots
export const Night = ({ children, glow = true }) => {
  const f = useCurrentFrame(), { width } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: C.night }}>
      <AbsoluteFill style={{ backgroundImage: `linear-gradient(${C.line} 1px, transparent 1px), linear-gradient(90deg, ${C.line} 1px, transparent 1px)`, backgroundSize: "120px 120px", opacity: 0.28, transform: `translateY(${-(f * 0.35) % 120}px)` }} />
      {glow && <div style={{ position: "absolute", left: width * 0.55, top: -260, width: 1100, height: 1100, borderRadius: "50%", background: "radial-gradient(circle, rgba(89,231,202,.16) 0%, rgba(89,231,202,0) 62%)" }} />}
      {children}
    </AbsoluteFill>
  );
};

// a terminal window that types its lines
export const Terminal = ({ lines, at = 0, cps = 2.2, width = 1240, title = "agent" }) => {
  const f = useCurrentFrame();
  let budget = Math.max(0, (f - at) * cps);
  return (
    <div style={{ width, background: "#0d1013", border: `1px solid ${C.line}`, boxShadow: "0 40px 120px rgba(0,0,0,.6)", fontFamily: MONO, fontSize: 30, lineHeight: 1.5, color: C.paper }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: `1px solid ${C.line}`, color: C.mute, fontSize: 20, letterSpacing: "0.12em", textTransform: "uppercase" }}>
        <i style={{ width: 12, height: 12, borderRadius: 6, background: C.mint, display: "inline-block" }} />{title}
      </div>
      <div style={{ padding: "26px 30px 34px", minHeight: 420, whiteSpace: "pre-wrap" }}>
        {lines.map((l, i) => {
          const text = typeof l === "string" ? l : l.text, color = typeof l === "string" ? C.paper : l.color, gap = (typeof l !== "string" && l.pause) || 0;
          budget -= gap;
          const n = Math.max(0, Math.min(text.length, Math.floor(budget)));
          budget -= text.length;
          return <div key={i} style={{ color, minHeight: "1.5em", fontWeight: l.bold ? 700 : 400, fontSize: l.size || 30 }}>{text.slice(0, n)}{n > 0 && n < text.length ? "▍" : ""}</div>;
        })}
      </div>
    </div>
  );
};

// ============================================================ pieces for the narrated cuts (intro.jsx, live.jsx)

const pad4 = (n) => String(n).padStart(4, "0");
// one of the Blender shots (tools/3d/video_k.py), full frame. It lands with a small punch in and, on a hit, a shake.
export const Shot = ({ name, n, from = 0, punch = 0.05, shake = 0, shift = 0 }) => { // shift: push the picture right to clear the type (the bare strip sits under the scrim)
  const f = useCurrentFrame(), i = Math.max(0, Math.min(n - 1, Math.floor(from + f)));
  const z = 1.012 + punch * (1 - ramp(f, 0, 12)), d = Math.exp(-f / 5);
  return (
    <AbsoluteFill style={{ background: "#05070a", overflow: "hidden" }}>
      <Img src={staticFile(`kshots/${name}/f${pad4(i)}.jpg`)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `translate(${shift + Math.sin(f * 2.9) * shake * d}px, ${Math.cos(f * 3.7) * shake * d}px) scale(${z})` }} />
    </AbsoluteFill>
  );
};
export const Flash = ({ at = 0, frames = 8, strength = 0.8, color = "#eafff8" }) => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ background: color, opacity: f < at ? 0 : strength * Math.exp(-(f - at) / (frames / 3)), pointerEvents: "none" }} />;
};
// what the type stands on: darkness on the K footage, the lab's own white in the rooms
export const Scrim = ({ dark = true }) => (
  <AbsoluteFill style={{ pointerEvents: "none", background: dark
    ? "linear-gradient(90deg, rgba(5,7,10,.93) 0%, rgba(5,7,10,.72) 30%, rgba(5,7,10,0) 60%), radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,.5) 100%)"
    : "linear-gradient(90deg, rgba(238,241,243,.95) 0%, rgba(238,241,243,.82) 30%, rgba(238,241,243,0) 58%)" }} />
);
// the whole block leaves just before the cut
export const Block = ({ total, left = 110, top = 340, gap = 22, children, hold = 5 }) => {
  const f = useCurrentFrame(), k = total ? ramp(f, total - hold, total, 0, 1, Easing.in(Easing.cubic)) : 0;
  return <div style={{ position: "absolute", left, top, display: "grid", gap, opacity: 1 - k, transform: `translateY(${-k * 26}px)` }}>{children}</div>;
};

// when each word of a narrated line is spoken, in frames (spread by letter count over the measured length of the line)
export const wordFrames = (line, fps = 30) => {
  const words = line.text.split(" "), total = words.join("").length; let c = 0;
  return words.map((w) => { const t = line.at + line.spoken * (c / total); c += w.length; return Math.round(t * fps); });
};
// a narrated line: every word arrives as it is said. `start` is the frame this sequence begins on.
// `rows` splits the words into lines, e.g. [2, 3]; `tint` colours a word: (index, word) => colour or nothing.
export const Say = ({ line, start = 0, rows, size = 104, weight = 500, color = C.paper, tint, font = SANS, track = "-0.035em", lead = 2 }) => {
  const f = useCurrentFrame() + start, at = wordFrames(line), words = line.text.split(" "), split = rows || [words.length]; let i = 0;
  return (
    <div style={{ display: "grid", gap: size * 0.04, fontFamily: font, fontSize: size, fontWeight: weight, letterSpacing: track, lineHeight: 1.0 }}>
      {split.map((count, r) => (
        <div key={r} style={{ display: "flex", gap: `0 ${size * 0.25}px`, whiteSpace: "nowrap" }}>
          {words.slice(i, (i += count)).map((w, j) => {
            const n = i - count + j, k = ramp(f, at[n] - lead, at[n] - lead + 9);
            return <span key={n} style={{ display: "inline-block", color: (tint && tint(n, w)) || color, opacity: k, filter: k < 1 ? `blur(${(1 - k) * 10}px)` : undefined, transform: `translateY(${(1 - k) * size * 0.42}px) scale(${1 + (1 - k) * 0.06})`, transformOrigin: "0 100%" }}>{w}</span>;
          })}
        </div>
      ))}
    </div>
  );
};
// a word that slams in (verdicts, the name)
export const Slam = ({ children, at = 0, size = 220, color = C.paper, font = MONO, weight = 700, track = "-0.02em" }) => {
  const f = useCurrentFrame(), k = ramp(f, at, at + 7);
  return f < at ? null : <div style={{ fontFamily: font, fontSize: size, fontWeight: weight, color, letterSpacing: track, lineHeight: 0.95, opacity: Math.min(1, k * 2), transform: `scale(${1.22 - 0.22 * k})`, transformOrigin: "0 60%", filter: k < 1 ? `blur(${(1 - k) * 14}px)` : undefined }}>{children}</div>;
};
// KAELIS, letter by letter
export const MarkSlam = ({ at = 0, size = 190, color = C.paper, step = 1.6 }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ display: "flex", fontFamily: SANS, fontWeight: 600, fontSize: size, letterSpacing: "0.08em", lineHeight: 1 }}>
      {"KAELIS".split("").map((ch, i) => {
        const k = ramp(f, at + i * step, at + i * step + 9);
        return <span key={i} style={{ display: "inline-block", opacity: k, transform: `translateY(${(1 - k) * size * 0.3}px) scale(${1.25 - 0.25 * k})`, filter: k < 1 ? `blur(${(1 - k) * 12}px)` : undefined, ...(i % 2 ? { color: "transparent", WebkitTextStroke: `${Math.max(2, size / 60)}px ${color}` } : { color }) }}>{ch}</span>;
      })}
    </div>
  );
};
// a thin rule that draws itself
export const Rule = ({ at = 0, width = 420, color = C.mint }) => { const f = useCurrentFrame(); return <div style={{ height: 3, width: width * ramp(f, at, at + 16), background: color }} />; };
// a number that counts up
export const Count = ({ to, at = 0, frames = 18 }) => { const f = useCurrentFrame(); return <>{Math.round(to * ramp(f, at, at + frames))}</>; };

// a caption the way a film subtitles a line: bottom centre, white, a soft shadow, one word picked out in mint.
// It comes with a faint shade along the bottom edge so it reads on the white lab as well as on the dark K shots.
// `at` below zero means it was already up in the shot before; `total` makes it leave just before the cut.
export const Sub = ({ text, mark, at = 0, total = 0, size = 58, bottom = 104 }) => {
  const f = useCurrentFrame(), k = ramp(f, at, at + 13), out = total ? ramp(f, total - 5, total, 0, 1, Easing.in(Easing.cubic)) : 0;
  const i = mark ? text.indexOf(mark) : -1, parts = i < 0 ? [text] : [text.slice(0, i), mark, text.slice(i + mark.length)];
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ background: "linear-gradient(0deg, rgba(4,6,8,.84) 0%, rgba(4,6,8,.62) 12%, rgba(4,6,8,.22) 24%, rgba(4,6,8,0) 36%)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom, textAlign: "center", fontFamily: SANS, fontSize: size, fontWeight: 500, lineHeight: 1.15, letterSpacing: `${-0.012 + (1 - k) * 0.035}em`, color: "#ffffff",
        textShadow: "0 1px 2px rgba(0,0,0,.85), 0 3px 10px rgba(0,0,0,.7), 0 8px 34px rgba(0,0,0,.6)", opacity: k * (1 - out), transform: `translateY(${(1 - k) * 16 - out * 10}px)`, filter: k < 1 ? `blur(${(1 - k) * 7}px)` : undefined }}>
        {parts[0]}{parts[1] && <span style={{ color: C.mint }}>{parts[1]}</span>}{parts[2]}
      </div>
    </AbsoluteFill>
  );
};
