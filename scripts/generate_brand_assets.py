#!/usr/bin/env python3
"""Generate branded favicon and OG image assets for Impactly AI.

Outputs:
  - client/public/apple-touch-icon.png (180x180)
  - client/public/og-default.png (1200x630)
  - client/public/favicon-32.png (32x32)
  - client/public/favicon-16.png (16x16)
  - client/public/mstile-150x150.png (PWA tile)
"""

import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# Brand colors (indigo → purple gradient)
INDIGO = (79, 70, 229)       # #4f46e5
PURPLE = (124, 58, 237)      # #7c3aed
DEEP = (15, 12, 41)          # near-black purple for OG bg
WHITE = (255, 255, 255)
TEXT = (226, 232, 240)       # slate-200
MUTED = (148, 163, 184)      # slate-400

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "client", "public")


def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def gradient_bg(w, h, c1=INDIGO, c2=PURPLE, angle_deg=135):
    """Create a diagonal gradient background."""
    img = Image.new("RGB", (w, h), c1)
    px = img.load()
    import math
    rad = math.radians(angle_deg)
    for y in range(h):
        for x in range(w):
            t = (x * math.cos(rad) + y * math.sin(rad)) / (w * abs(math.cos(rad)) + h * abs(math.sin(rad)))
            t = max(0.0, min(1.0, t))
            px[x, y] = lerp_color(c1, c2, t)
    return img


def get_font(size, bold=False):
    """Try to load a system font; fall back to PIL default."""
    candidates = []
    if bold:
        candidates += [
            r"C:\Windows\Fonts\segoeuib.ttf",
            r"C:\Windows\Fonts\arialbd.ttf",
            r"C:\Windows\Fonts\calibrib.ttf",
        ]
    candidates += [
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\calibri.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                pass
    return ImageFont.load_default()


def draw_lightning(draw, x, y, size, color=WHITE):
    """Draw the lightning bolt logo at (x, y) top-left with given size."""
    # Path: M13 2L3 14h9l-1 8 10-12h-9l1-8z
    # Normalize to a 24x24 viewBox, then scale.
    s = size / 24.0
    points = [
        (13, 2), (3, 14), (12, 14), (11, 22), (21, 10), (12, 10), (13, 2)
    ]
    scaled = [(x + p[0] * s, y + p[1] * s) for p in points]
    draw.polygon(scaled, fill=color)


def make_apple_touch_icon():
    """180x180 PNG with the brand gradient + lightning bolt."""
    size = 180
    img = gradient_bg(size, size, INDIGO, PURPLE, 135)
    draw = ImageDraw.Draw(img)
    draw_lightning(draw, x=60, y=60, size=60)
    out = os.path.join(OUT_DIR, "apple-touch-icon.png")
    img.save(out, "PNG", optimize=True)
    print(f"Wrote {out} ({size}x{size})")


def make_favicon_png(s, filename):
    """Small favicon PNG."""
    img = gradient_bg(s, s, INDIGO, PURPLE, 135)
    draw = ImageDraw.Draw(img)
    # lightning bolt roughly centered
    pad = max(2, s // 5)
    draw_lightning(draw, x=pad, y=pad, size=s - 2 * pad)
    out = os.path.join(OUT_DIR, filename)
    img.save(out, "PNG", optimize=True)
    print(f"Wrote {out} ({s}x{s})")


def make_og_image():
    """1200x630 OG image with brand gradient, logo, headline, tagline."""
    W, H = 1200, 630
    # Background: deep purple → indigo gradient
    img = gradient_bg(W, H, (17, 24, 39), INDIGO, 160)

    # Add soft glowing orbs
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse([100, 80, 500, 480], fill=(99, 102, 241, 70))   # indigo
    gdraw.ellipse([800, 200, 1200, 600], fill=(168, 85, 247, 60)) # purple
    glow = glow.filter(ImageFilter.GaussianBlur(80))
    img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")

    draw = ImageDraw.Draw(img)

    # Logo (lightning bolt) in upper-left
    draw_lightning(draw, x=80, y=70, size=80)

    # Brand name next to logo
    font_brand = get_font(56, bold=True)
    draw.text((180, 88), "Impactly AI", fill=WHITE, font=font_brand)

    # Headline
    font_h1 = get_font(72, bold=True)
    headline = "Stop Stressing Over Your"
    draw.text((80, 240), headline, fill=WHITE, font=font_h1)
    headline2 = "Annual Self-Appraisal."
    draw.text((80, 320), headline2, fill=(196, 181, 253), font=font_h1)  # light purple

    # Subhead
    font_sub = get_font(28)
    sub1 = "AI-powered weekly work logging that drafts"
    sub2 = "promotion-ready, STAR-format self-evaluations."
    draw.text((80, 440), sub1, fill=TEXT, font=font_sub)
    draw.text((80, 478), sub2, fill=TEXT, font=font_sub)

    # Bottom strip with trust signals
    font_strip = get_font(20)
    draw.text((80, 560), "impactlyai.com", fill=(165, 180, 252), font=font_strip)
    draw.text((360, 560), "•", fill=MUTED, font=font_strip)
    draw.text((390, 560), "Privacy-First", fill=TEXT, font=font_strip)
    draw.text((580, 560), "•", fill=MUTED, font=font_strip)
    draw.text((610, 560), "No LLM Training on Your Data", fill=TEXT, font=font_strip)
    draw.text((1080, 560), "•", fill=MUTED, font=font_strip)
    draw.text((1110, 560), "Free", fill=(134, 239, 172), font=font_strip)

    out = os.path.join(OUT_DIR, "og-default.png")
    img.save(out, "PNG", optimize=True)
    print(f"Wrote {out} ({W}x{H})")


def make_mstile():
    """150x150 PWA tile."""
    make_favicon_png(150, "mstile-150x150.png")


def make_producthunt_logo():
    """240x240 PNG logo specifically for Product Hunt."""
    size = 240
    img = gradient_bg(size, size, INDIGO, PURPLE, 135)
    draw = ImageDraw.Draw(img)
    # lightning bolt centered
    pad = 60
    draw_lightning(draw, x=pad, y=pad, size=size - 2 * pad)
    out = os.path.join(OUT_DIR, "producthunt-logo.png")
    img.save(out, "PNG", optimize=True)
    print(f"Wrote {out} ({size}x{size})")


def make_ico():
    """Multi-resolution ICO with 16, 32, 48 sizes."""
    sizes = [16, 32, 48]
    images = []
    for s in sizes:
        img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        # Solid gradient
        grad = gradient_bg(s, s, INDIGO, PURPLE, 135).convert("RGBA")
        img.paste(grad, (0, 0))
        draw = ImageDraw.Draw(img)
        pad = max(1, s // 5)
        draw_lightning(draw, x=pad, y=pad, size=s - 2 * pad, color=WHITE)
        images.append(img)
    out = os.path.join(OUT_DIR, "favicon.ico")
    images[0].save(out, format="ICO", sizes=[(s, s) for s in sizes], append_images=images[1:])
    print(f"Wrote {out} (multi-res: {sizes})")


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    make_apple_touch_icon()
    make_favicon_png(32, "favicon-32x32.png")
    make_favicon_png(16, "favicon-16x16.png")
    make_og_image()
    make_mstile()
    make_producthunt_logo()
    make_ico()
    print("\nAll brand assets generated.")

