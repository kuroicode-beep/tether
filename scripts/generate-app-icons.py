# scripts/generate-app-icons.py
# Generates PWA app icons from the Tether leaf branding source image.
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
SOURCE = ROOT / "assets" / "brand-logo-source.png"


def sample_background(image: Image.Image) -> tuple[int, int, int]:
    """Sample the cream background color from image edges."""
    rgb = image.convert("RGB")
    edge_pixels: list[tuple[int, int, int]] = []
    width, height = rgb.size
    for x in range(width):
        edge_pixels.append(rgb.getpixel((x, 0)))
        edge_pixels.append(rgb.getpixel((x, height - 1)))
    for y in range(height):
        edge_pixels.append(rgb.getpixel((0, y)))
        edge_pixels.append(rgb.getpixel((width - 1, y)))
    counts: dict[tuple[int, int, int], int] = {}
    for pixel in edge_pixels:
        counts[pixel] = counts.get(pixel, 0) + 1
    return max(counts, key=counts.get)


def render_icon(size: int, logo_scale: float = 0.9) -> Image.Image:
    """Render a square app icon with centered branding on sampled cream background."""
    logo = Image.open(SOURCE).convert("RGBA")
    bg = sample_background(logo)
    canvas = Image.new("RGB", (size, size), bg)
    max_w = int(size * logo_scale)
    max_h = int(size * logo_scale)
    ratio = min(max_w / logo.width, max_h / logo.height)
    new_size = (max(1, int(logo.width * ratio)), max(1, int(logo.height * ratio)))
    logo = logo.resize(new_size, Image.Resampling.LANCZOS)
    x = (size - new_size[0]) // 2
    y = (size - new_size[1]) // 2
    canvas.paste(logo, (x, y), logo)
    return canvas


def render_maskable_icon(size: int, logo_scale: float = 0.62) -> Image.Image:
    """Render a maskable icon with logo kept inside Android/iOS safe zone."""
    return render_icon(size, logo_scale=logo_scale)


def save_favicon(path: Path) -> Image.Image:
    """Save multi-size favicon.ico."""
    sizes = [16, 32, 48]
    icons = [render_icon(size, logo_scale=0.86) for size in sizes]
    icons[0].save(
        path,
        format="ICO",
        sizes=[(icon.width, icon.height) for icon in icons],
        append_images=icons[1:],
    )
    return icons[0]


def main() -> None:
    """Generate all public icon assets."""
    if not SOURCE.exists():
        raise FileNotFoundError(f"Missing branding source: {SOURCE}")

    PUBLIC.mkdir(parents=True, exist_ok=True)
    icon_192 = render_icon(192)
    icon_512 = render_icon(512)
    icon_180 = render_icon(180)
    icon_192.save(PUBLIC / "icon-192.png", optimize=True)
    icon_512.save(PUBLIC / "icon-512.png", optimize=True)
    icon_180.save(PUBLIC / "apple-touch-icon.png", optimize=True)
    render_maskable_icon(192).save(PUBLIC / "icon-maskable-192.png", optimize=True)
    render_maskable_icon(512).save(PUBLIC / "icon-maskable-512.png", optimize=True)
    save_favicon(PUBLIC / "favicon.ico")

    import base64
    from io import BytesIO

    buffer = BytesIO()
    icon_512.save(buffer, format="PNG", optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
        'viewBox="0 0 512 512" role="img" aria-label="Tether">'
        f'<image width="512" height="512" xlink:href="data:image/png;base64,{encoded}"/>'
        "</svg>"
    )
    (PUBLIC / "icon.svg").write_text(svg, encoding="utf-8")
    print("Generated app icons in", PUBLIC)


if __name__ == "__main__":
    main()
