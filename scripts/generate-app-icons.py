# scripts/generate-app-icons.py
# Generates PWA app icons from the Tether leaf branding source image.
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
SOURCE = ROOT / "assets" / "brand-logo-source.png"
BG = (238, 233, 220)  # #EEE9DC


def render_icon(size: int, logo_scale: float = 0.78) -> Image.Image:
    """Render a square app icon with centered branding on cream background."""
    canvas = Image.new("RGB", (size, size), BG)
    logo = Image.open(SOURCE).convert("RGBA")
    max_w = int(size * logo_scale)
    max_h = int(size * logo_scale)
    ratio = min(max_w / logo.width, max_h / logo.height)
    new_size = (max(1, int(logo.width * ratio)), max(1, int(logo.height * ratio)))
    logo = logo.resize(new_size, Image.Resampling.LANCZOS)
    x = (size - new_size[0]) // 2
    y = (size - new_size[1]) // 2
    canvas.paste(logo, (x, y), logo)
    return canvas


def save_favicon(path: Path) -> None:
    """Save multi-size favicon.ico."""
    sizes = [16, 32, 48]
    icons = [render_icon(size, logo_scale=0.82) for size in sizes]
    icons[0].save(
        path,
        format="ICO",
        sizes=[(icon.width, icon.height) for icon in icons],
        append_images=icons[1:],
    )


def main() -> None:
    """Generate all public icon assets."""
    if not SOURCE.exists():
        raise FileNotFoundError(f"Missing branding source: {SOURCE}")

    PUBLIC.mkdir(parents=True, exist_ok=True)
    render_icon(192).save(PUBLIC / "icon-192.png", optimize=True)
    render_icon(512).save(PUBLIC / "icon-512.png", optimize=True)
    render_icon(180).save(PUBLIC / "apple-touch-icon.png", optimize=True)
    save_favicon(PUBLIC / "favicon.ico")
    print("Generated app icons in", PUBLIC)


if __name__ == "__main__":
    main()
