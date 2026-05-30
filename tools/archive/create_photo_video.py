from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


W, H = 1080, 1920
FONT = "/System/Library/Fonts/Hiragino Sans GB.ttc"
BOLD = "/System/Library/Fonts/STHeiti Medium.ttc"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(BOLD if bold else FONT, size)


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def duration(path: Path) -> float:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
        text=True,
    )
    return float(json.loads(out)["format"]["duration"])


def wrap(draw: ImageDraw.ImageDraw, text: str, f: ImageFont.FreeTypeFont, width: int) -> list[str]:
    lines: list[str] = []
    cur = ""
    for ch in text:
        test = cur + ch
        if draw.textbbox((0, 0), test, font=f)[2] <= width:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = ch
    if cur:
        lines.append(cur)
    return lines


def draw_text(draw: ImageDraw.ImageDraw, text: str, xy: tuple[int, int], f: ImageFont.FreeTypeFont, color: str, width: int, gap: int = 12) -> int:
    x, y = xy
    for line in wrap(draw, text, f, width):
        draw.text((x, y), line, font=f, fill=color)
        y += f.size + gap
    return y


def cover_crop(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    tw, th = size
    iw, ih = img.size
    scale = max(tw / iw, th / ih)
    nw, nh = int(iw * scale), int(ih * scale)
    img = img.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = (nh - th) // 2
    return img.crop((left, top, left + tw, top + th))


def split_storyboard(storyboard: Path, out_dir: Path) -> list[Path]:
    img = Image.open(storyboard).convert("RGB")
    w, h = img.size
    cell_w, cell_h = w // 2, h // 3
    paths: list[Path] = []
    for row in range(3):
        for col in range(2):
            crop = img.crop((col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h))
            # Remove white gutters.
            crop = crop.crop((8, 8, crop.width - 8, crop.height - 8))
            frame = cover_crop(crop, (W, H))
            path = out_dir / f"photo_{row * 2 + col + 1:02d}.jpg"
            frame.save(path, quality=94)
            paths.append(path)
    return paths


def make_frame(src: Path, out: Path, label: str, title: str, body: str, stat: str | None = None) -> None:
    base = Image.open(src).convert("RGB")
    base = cover_crop(base, (W, H))
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rectangle((0, 0, W, H), fill=(0, 0, 0, 28))
    od.rectangle((0, 0, W, 300), fill=(8, 10, 14, 178))
    od.rectangle((0, 1330, W, H), fill=(8, 10, 14, 214))
    img = Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(img)

    draw.rounded_rectangle((64, 70, 440, 142), radius=28, fill="#111318")
    draw.text((94, 88), label, font=font(32, True), fill="#ffffff")

    if stat:
        draw.rounded_rectangle((64, 1160, W - 64, 1288), radius=22, fill="#f6f2ea")
        draw.text((104, 1190), stat, font=font(56, True), fill="#111318")

    draw.text((72, 1390), title, font=font(62, True), fill="#ffffff")
    draw_text(draw, body, (72, 1495), font(38), "#e8edf4", W - 144, 14)
    draw.text((72, 1818), "日本留学生视角｜生活经济观察", font=font(28), fill="#c7ced8")
    img.save(out, quality=94)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--storyboard", required=True)
    parser.add_argument("--audio", required=True)
    parser.add_argument("--out-dir", required=True)
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    photo_dir = out_dir / "photo_frames"
    photo_dir.mkdir(exist_ok=True)
    raw = split_storyboard(Path(args.storyboard), photo_dir)

    scenes = [
        ("今天看房租", "日元便宜了，生活就一定便宜吗？", "不一定。准备来日本前，房租可能比汇率更影响预算。", None),
        ("查房源", "便宜汇率，抵不过高房租", "东京租房不能只看月租，还要看初期费用、通勤和房源位置。", None),
        ("核心数据", "首都圈部分公寓租金继续上涨", "FNN 引述东京Kantei数据：4月租金每平方米4143日元，同比上涨11%。", "4143日元/㎡  +11%"),
        ("日常开支", "生活成本不是只有房租", "吃饭、日用品、交通费加起来，才是真正的月生活成本。", None),
        ("留学生视角", "留学预算要重新算", "不要只看学费和汇率，要把房租、交通、吃饭、打工收入放在一起算。", None),
        ("一句话", "日元便宜 ≠ 日本生活一定便宜", "做预算时，房租和通勤距离要提前算进去。", None),
    ]
    final_frames: list[Path] = []
    for i, (src, scene) in enumerate(zip(raw, scenes), 1):
        out = photo_dir / f"composed_{i:02d}.jpg"
        make_frame(src, out, *scene)
        final_frames.append(out)

    total = duration(Path(args.audio))
    weights = [0.9, 1.0, 1.18, 1.0, 1.08, 0.84]
    unit = total / sum(weights)
    concat = out_dir / "photo_concat.txt"
    with concat.open("w", encoding="utf-8") as f:
        for path, weight in zip(final_frames, weights):
            f.write(f"file '{path.resolve()}'\n")
            f.write(f"duration {unit * weight:.3f}\n")
        f.write(f"file '{final_frames[-1].resolve()}'\n")

    silent = out_dir / "photo_silent.mp4"
    run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat),
        "-vf", "fps=30,format=yuv420p",
        "-c:v", "libx264", "-profile:v", "high", "-level", "4.0", "-b:v", "4500k", "-pix_fmt", "yuv420p",
        str(silent),
    ])
    final = out_dir / "tokyo_rent_ai_photo_voice.mp4"
    run([
        "ffmpeg", "-y", "-i", str(silent), "-i", args.audio,
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "libx264", "-profile:v", "high", "-level", "4.0", "-b:v", "4500k", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart",
        str(final),
    ])
    print(final)


if __name__ == "__main__":
    main()
