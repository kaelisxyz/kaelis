# Agent explainer video

`agent.html` is a 1280×720 animated page with `window.renderAt(t)` (0–36 s): one token goes through the Kaelis agent (read, check, score, explain, outputs).

Render and encode:

```
python3 -m http.server 8765        # from this folder
node render.js frames               # 30 fps JPEG frames
ffmpeg -framerate 30 -i frames/f%05d.jpg -c:v libx264 -crf 24 -pix_fmt yuv420p -movflags +faststart kaelis-agent.mp4
ffmpeg -framerate 30 -i frames/f%05d.jpg -c:v libvpx-vp9 -b:v 0 -crf 38 -pix_fmt yuv420p kaelis-agent.webm
```

Output goes to `site/media/` and is shown near the top of `site/guide.html`.
