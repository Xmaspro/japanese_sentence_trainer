from __future__ import annotations

import argparse
import json
import math
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


W, H = 1080, 1920
FONT = "/System/Library/Fonts/Hiragino Sans GB.ttc"
BOLD = "/System/Library/Fonts/STHeiti Medium.ttc"


def f(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(BOLD if bold else FONT, size)


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def probe_duration(path: Path) -> float:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
        text=True,
    )
    return float(json.loads(out)["format"]["duration"])


def wrap(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, width: int) -> list[str]:
    lines, cur = [], ""
    for ch in text:
        if ch == "\n":
            lines.append(cur)
            cur = ""
            continue
        test = cur + ch
        if draw.textbbox((0, 0), test, font=font)[2] <= width:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = ch
    if cur:
        lines.append(cur)
    return lines


def text(draw: ImageDraw.ImageDraw, body: str, xy: tuple[int, int], font: ImageFont.FreeTypeFont, color: str, width: int, gap: int = 12) -> int:
    x, y = xy
    for line in wrap(draw, body, font, width):
        draw.text((x, y), line, font=font, fill=color)
        y += font.size + gap
    return y


def bg() -> Image.Image:
    img = Image.new("RGB", (W, H), "#eef1f4")
    draw = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        r = int(236 * (1 - t) + 214 * t)
        g = int(240 * (1 - t) + 225 * t)
        b = int(244 * (1 - t) + 231 * t)
        draw.line((0, y, W, y), fill=(r, g, b))
    return img


def header(draw: ImageDraw.ImageDraw, label: str) -> None:
    draw.rounded_rectangle((64, 64, 500, 142), radius=28, fill="#141821")
    draw.text((96, 82), label, font=f(34, True), fill="#ffffff")


def bottom_caption(draw: ImageDraw.ImageDraw, title: str, body: str) -> None:
    draw.rounded_rectangle((64, 1390, W - 64, 1808), radius=34, fill="#111318")
    draw.text((108, 1440), title, font=f(58, True), fill="#ffffff")
    text(draw, body, (108, 1538), f(38), "#d9dee7", 860, 14)


def draw_apartment(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((0, 1150, W, H), fill="#d8d2c8")
    draw.rectangle((110, 430, 455, 1260), fill="#c74f42")
    draw.rectangle((485, 330, 890, 1260), fill="#d7b35d")
    for bx, by, bw, bh, floors in [(110, 430, 345, 830, 6), (485, 330, 405, 930, 7)]:
        for i in range(floors):
            for j in range(3):
                x = bx + 42 + j * 96
                y = by + 58 + i * 112
                draw.rounded_rectangle((x, y, x + 58, y + 70), radius=6, fill="#f3f7ff")
                draw.line((x + 29, y, x + 29, y + 70), fill="#9ba8b8", width=2)
    draw.rectangle((565, 1110, 690, 1260), fill="#30343c")
    draw.ellipse((665, 1185, 680, 1200), fill="#f4c542")
    draw.line((70, 1260, 980, 1260), fill="#818891", width=8)
    draw.rectangle((170, 1210, 260, 1260), fill="#343942")
    draw.ellipse((178, 1240, 208, 1270), fill="#111318")
    draw.ellipse((225, 1240, 255, 1270), fill="#111318")


def draw_train(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((0, 1080, W, H), fill="#c8d0d8")
    draw.line((0, 1270, W, 1270), fill="#777f87", width=8)
    draw.line((0, 1360, W, 1360), fill="#777f87", width=8)
    draw.rounded_rectangle((95, 610, 985, 1190), radius=52, fill="#f6f7f8", outline="#30343c", width=8)
    draw.rectangle((95, 910, 985, 990), fill="#d8372a")
    for i in range(4):
        x = 160 + i * 195
        draw.rounded_rectangle((x, 680, x + 130, 850), radius=16, fill="#9cc6df")
    draw.rectangle((790, 680, 910, 1160), fill="#e6e8eb", outline="#30343c", width=4)
    draw.ellipse((210, 1130, 290, 1210), fill="#151922")
    draw.ellipse((760, 1130, 840, 1210), fill="#151922")
    draw.text((130, 500), "通勤距离也会变成生活成本", font=f(46, True), fill="#111318")


def draw_supermarket(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((0, 1120, W, H), fill="#ded7ca")
    draw.rounded_rectangle((110, 390, 970, 1180), radius=30, fill="#ffffff", outline="#c3cad3", width=6)
    for shelf_y in [550, 760, 970]:
        draw.rectangle((160, shelf_y, 920, shelf_y + 26), fill="#5c6470")
        for i in range(8):
            x = 185 + i * 88
            color = ["#d8372a", "#f4c542", "#3f7cac", "#5fb57d"][i % 4]
            draw.rounded_rectangle((x, shelf_y - 105, x + 54, shelf_y - 8), radius=8, fill=color)
    draw.rounded_rectangle((180, 1210, 900, 1310), radius=18, fill="#111318")
    draw.text((225, 1230), "吃饭 + 日用品 + 交通", font=f(44, True), fill="#ffffff")


def draw_budget(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((0, 0, W, H), fill="#ebe5d9")
    draw.rounded_rectangle((140, 360, 870, 1270), radius=30, fill="#fffdf7", outline="#b5a789", width=5)
    draw.rectangle((140, 480, 870, 560), fill="#d8372a")
    draw.text((190, 494), "留学预算", font=f(44, True), fill="#ffffff")
    items = [("房租", "¥ ?"), ("交通", "¥ ?"), ("吃饭", "¥ ?"), ("打工收入", "¥ ?")]
    y = 670
    for name, val in items:
        draw.text((220, y), name, font=f(48, True), fill="#1a1a1a")
        draw.text((640, y), val, font=f(48, True), fill="#d8372a")
        draw.line((200, y + 78, 810, y + 78), fill="#d9d1c0", width=3)
        y += 135
    draw.ellipse((760, 1190, 980, 1410), fill="#f4c542")
    draw.text((800, 1250), "先算\n房租", font=f(44, True), fill="#111318")


def draw_map(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((0, 0, W, H), fill="#e8edf2")
    for x in range(80, W, 160):
        draw.line((x, 300, x + 520, 1260), fill="#cdd5df", width=12)
    for y in range(360, 1280, 170):
        draw.line((60, y, W - 60, y - 160), fill="#cdd5df", width=12)
    draw.line((180, 1150, 880, 570), fill="#d8372a", width=18)
    for x, y, name in [(180, 1150, "家"), (880, 570, "学校")]:
        draw.ellipse((x - 46, y - 46, x + 46, y + 46), fill="#111318")
        draw.text((x - 38, y - 30), name, font=f(34, True), fill="#ffffff")
    draw.rounded_rectangle((220, 1270, 860, 1370), radius=24, fill="#ffffff")
    draw.text((270, 1290), "远一点可能省房租，但多交通费", font=f(38, True), fill="#111318")


def draw_closing(draw: ImageDraw.ImageDraw) -> None:
    draw.rectangle((0, 0, W, H), fill="#111318")
    draw.ellipse((-250, 200, 520, 970), fill="#d8372a")
    draw.ellipse((610, 850, 1260, 1500), fill="#f4c542")
    draw.rounded_rectangle((80, 450, W - 80, 1280), radius=42, fill="#f6f2ea")
    draw.text((150, 560), "日元便宜", font=f(82, True), fill="#111318")
    draw.text((150, 690), "≠", font=f(100, True), fill="#d8372a")
    draw.text((150, 850), "日本生活一定便宜", font=f(72, True), fill="#111318")
    draw.text((150, 1080), "预算要看：房租、交通、吃饭、收入", font=f(38, True), fill="#30343c")


def make_scene(path: Path, idx: int, label: str, title: str, body: str) -> None:
    img = bg()
    draw = ImageDraw.Draw(img)
    if idx == 0:
        draw_apartment(draw)
    elif idx == 1:
        draw_apartment(draw)
        draw.rounded_rectangle((120, 1130, 960, 1290), radius=30, fill="#111318")
        draw.text((165, 1170), "4143日元/㎡   +11%", font=f(62, True), fill="#ffffff")
    elif idx == 2:
        draw_train(draw)
    elif idx == 3:
        draw_supermarket(draw)
    elif idx == 4:
        draw_budget(draw)
    else:
        draw_closing(draw)
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rectangle((0, 0, W, 260), fill=(17, 19, 24, 218))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(img)
    header(draw, label)
    if idx != 5:
        bottom_caption(draw, title, body)
    # Light film grain.
    noise = Image.effect_noise((W, H), 5).convert("L")
    img = Image.composite(img.filter(ImageFilter.GaussianBlur(0.15)), img, noise.point(lambda p: 255 if p > 170 else 0))
    img.save(path, quality=95)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--audio", required=True)
    args = parser.parse_args()
    out_dir = Path(args.out_dir)
    audio = Path(args.audio)
    frames = out_dir / "scene_frames"
    frames.mkdir(parents=True, exist_ok=True)

    scenes = [
        ("今天看房租", "日元便宜了，生活就一定便宜吗？", "不一定。准备来日本前，房租可能比汇率更影响预算。"),
        ("核心数据", "首都圈部分公寓租金继续上涨", "FNN 引述东京Kantei数据：4月租金每平方米4143日元，同比上涨11%。"),
        ("通勤成本", "住远一点，不一定总便宜", "房租低一些，但电车费、通学时间，也会变成每天的生活成本。"),
        ("日常开支", "房租不是唯一压力", "吃饭、日用品、交通费加起来，才是真正的月生活成本。"),
        ("留学生视角", "留学预算要重新算", "不要只看学费和汇率，要把房租、交通、吃饭、打工收入放在一起算。"),
        ("一句话", "", ""),
    ]
    frame_paths = []
    for i, scene in enumerate(scenes):
        p = frames / f"scene_{i+1:02d}.jpg"
        make_scene(p, i, *scene)
        frame_paths.append(p)

    total = probe_duration(audio)
    weights = [0.95, 1.15, 1.0, 1.0, 1.15, 0.85]
    unit = total / sum(weights)
    concat = out_dir / "scene_concat.txt"
    with concat.open("w", encoding="utf-8") as fh:
        for p, w in zip(frame_paths, weights):
            fh.write(f"file '{p.resolve()}'\n")
            fh.write(f"duration {unit*w:.3f}\n")
        fh.write(f"file '{frame_paths[-1].resolve()}'\n")

    silent = out_dir / "scene_silent.mp4"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-b:v", "3500k", "-pix_fmt", "yuv420p", str(silent)])
    final = out_dir / "tokyo_rent_scene_naturalish_voice.mp4"
    run(["ffmpeg", "-y", "-i", str(silent), "-i", str(audio), "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-profile:v", "high", "-level", "4.0", "-pix_fmt", "yuv420p", "-b:v", "3500k", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", str(final)])
    print(final)


if __name__ == "__main__":
    main()
