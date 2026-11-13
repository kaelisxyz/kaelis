# Kaelis videos (Remotion)

Two short videos for X, built from the project's own 3D assets. Not part of the site build.
The finished files go to `asset/video/` at the project root.

| Composition | Length | Story |
| --- | --- | --- |
| `Intro` | 10 s | "Every scanner checks the token. No one checks who launched it. Kaelis does. The trust layer for Solana." |
| `Live` | 30 s | "Kaelis is live", then a walk through what runs today: the Assay Room, the ledger, the Archive, the wallet behind a token, the Gate, allow / warn / block |

1920x1080, 30 fps, with a narrator and a score. No web address in the picture.

## How it is put together

- **Picture.** The dark shots of the K are rendered in Blender Cycles (`tools/3d/video_k.py`, seven camera moves with
  motion blur and depth of field). The lab and corridor shots are real time (React Three Fiber, `src/scenes3d.jsx`) from
  the site's own models and baked light.
- **Voice.** `audio/make_vo.mjs` reads `audio/lines.json` with Kokoro (an open text-to-speech model, Apache-2.0) on this
  machine. Nothing is sent to an outside service. "Kaelis" is spelled "Kayliss" for the voice so it says KAY-liss.
- **Score.** `audio/make_mix.mjs` writes the music in code (`audio/dsp.mjs`: synths, reverb, echo, limiter). No samples,
  no loops, nothing licensed. 120 bpm, D minor, half-time drums. One beat is 15 frames and one bar is 60, so every cut
  and every hit lands on a frame. The music ducks under the voice.
- **Type.** Each word appears when the narrator says it (`src/vo.json`, written by the mix, holds the times).

## Rebuild

```bash
cd video
npm install

# 1. the K shots (about 45 min on an RTX 4060 Ti; skips frames that exist)
"C:/Program Files/Blender Foundation/Blender 4.0/blender.exe" -b -P ../tools/3d/video_k.py -- public/kshots final

# 2. lab assets: copy lab.glb, hall.glb, staff-*.glb from site/models and lab_shell.webp, lab_furn.webp, hall_shell.webp from site/media into public/

# 3. voice, then score and mix (writes public/audio/*.wav and src/vo.json)
node audio/make_vo.mjs am_michael 1.0
node audio/make_mix.mjs all

# 4. render
npx remotion render src/index.jsx Intro ../asset/video/kaelis-intro.mp4 --gl=angle --crf=17
npx remotion render src/index.jsx Live  ../asset/video/kaelis-live.mp4  --gl=angle --crf=17 --concurrency=4

npx remotion studio src/index.jsx     # preview and edit
```

Checks that run without anyone listening or watching:

- `node audio/check_vo.mjs` and `node audio/check_mix.mjs`: a speech recogniser (Whisper, local) transcribes the
  narration alone and then the finished mix. If the machine can read the words over the music, a person can.
- `sh audio/loud.sh <ffmpeg> public/audio/*.wav`: loudness (about -12 LUFS, peak -1 dBFS).
- `node stills.mjs <Composition> <dir> <frames>`: single frames, to check framing before a full render.

To change the narration: edit `audio/lines.json` (the words) and `audio/timeline.json` (when each line starts), then
run steps 3 and 4. To use a different piece of music, replace the WAV in `public/audio/`; the cuts sit at 120 bpm.

Two rules that each cost a debugging round:

- Do not wrap the 3D children in your own `<Suspense>`. `ThreeCanvas` already holds the render until models and
  textures are loaded; a second boundary swallows that and frames come out empty.
- Give Blender an absolute output path. It resolves a relative one against the drive root, not the folder you ran it from.

Remotion is free for individuals and small teams; check its licence if the team grows.
