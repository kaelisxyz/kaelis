# Kaelis asset kit

Everything made for posting, in one place. Files are named `kaelis-<what it is>`.

## logo/ (the 3D K)
| File | Use it for |
| --- | --- |
| `kaelis-logo-3d-dark.png` | Profile picture and anywhere dark |
| `kaelis-logo-3d-light.png` | The same mark on a light background |
| `kaelis-logo-3d-dust.png` | The earlier dust version, kept for reference |

## banner/ (X header)
| File | Look |
| --- | --- |
| `kaelis-x-banner-3d-studio-*.png` | The K on a dark studio floor |
| `kaelis-x-banner-3d-city-*.png` | The K in the Forge City at night |
| `kaelis-x-banner-3d-lab-*.png` | The K in the white lab |
| `kaelis-x-banner-flat-*.png` | The first, flat banner |

Each comes as 3000x1000 (upload this one) and 1500x500.

## video/ (MP4, 1920x1080, narrator and score)
| File | Length | Use it for |
| --- | --- | --- |
| `kaelis-intro.mp4` | 10 s | What Kaelis is, in four sentences. No web address in the picture |
| `kaelis-live.mp4` | 30 s | "Kaelis is live": what runs today, room by room |
| `kaelis-x-captions.md` | | The post text that goes with each video |

The MP4 files are not in git (too large); rebuild them with `video/README.md`.

## article/
| File | Use it for |
| --- | --- |
| `kaelis-x-article.md` | The long X article |

Sources: `tools/3d/logo_k.py` (logo), `tools/3d/banner_x.py` (banners), `tools/3d/video_k.py` and `video/` (videos).
