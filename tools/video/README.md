# Tech guide video

`video.html` is a 1280×720 animated page with `window.renderAt(t)` (0–125 s). It reads screenshots from `vid/` next to it.

Render and encode:

```
python3 -m http.server 8765        # from a folder holding video.html and vid/
node render.js frames               # 24 fps JPEG frames
ffmpeg -framerate 24 -i frames/f%05d.jpg -c:v libx264 -crf 26 -pix_fmt yuv420p -movflags +faststart kaelis-tech-guide.mp4
ffmpeg -framerate 24 -i frames/f%05d.jpg -c:v libvpx-vp9 -b:v 0 -crf 40 -pix_fmt yuv420p kaelis-tech-guide.webm
```

Output goes to `site/media/`, embedded in the Tech section of `site/index.html`.
