// Shared look for the Kaelis videos: the site's own palette and type.
import { loadFont as loadSans } from "@remotion/google-fonts/InterTight";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

export const SANS = loadSans("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily;
export const MONO = loadMono("normal", { weights: ["400", "500", "700"], subsets: ["latin"] }).fontFamily;

export const C = {
  ink: "#0b0b0c", paper: "#f2f0ea", night: "#0a0c0f", mute: "#8b9096", line: "#2a2e33",
  mint: "#59e7ca", amber: "#ffc24a", red: "#ff4d6a", steel: "#b4b9be", lab: "#e6e9ec",
};
export const FPS = 30, W = 1920, H = 1080;
export const sec = (s) => Math.round(s * FPS);
