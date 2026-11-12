// Type and motion pieces used by every video. Words rise into place; nothing bounces.
import React from "react";
import { AbsoluteFill, interpolate, Easing, useCurrentFrame, useVideoConfig } from "remotion";
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
    {note && <div style={{ position: "absolute", left: 110, bottom: 54, fontFamily: MONO, fontSize: 17, letterSpacing: "0.1em", textTransform: "uppercase", color: dark ? "rgba(242,240,234,.45)" : "rgba(11,11,12,.5)" }}>{note}</div>}
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
