from __future__ import annotations

import argparse
import json
import subprocess
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


WIDTH = 1080
HEIGHT = 1920
FONT = "/System/Library/Fonts/Hiragino Sans GB.ttc"
FONT_BOLD = "/System/Library/Fonts/STHeiti Medium.ttc"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT, size)


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        paragraph = paragraph.strip()
        if not paragraph:
            lines.append("")
            continue
        current = ""
        for char in paragraph:
            test = current + char
            if draw.textbbox((0, 0), test, font=fnt)[2] <= max_width:
                current = test
            else:
                if current:
                    lines.append(current)
                current = char
        if current:
            lines.append(current)
    return lines


def draw_text_block(
    draw: ImageDraw.ImageDraw,
    text: str,
    xy: tuple[int, int],
    fnt: ImageFont.FreeTypeFont,
    fill: str,
    max_width: int,
    line_gap: int = 16,
) -> int:
    x, y = xy
    for line in wrap(draw, text, fnt, max_width):
        if not line:
            y += fnt.size
            continue
        draw.text((x, y), line, font=fnt, fill=fill)
        y += fnt.size + line_gap
    return y


def make_slide(
    path: Path,
    eyebrow: str,
    title: str,
    body: str,
    stat: str | None = None,
    footer: str = "日本留学生视角｜生活经济观察",
) -> None:
    img = Image.new("RGB", (WIDTH, HEIGHT), "#111318")
    draw = ImageDraw.Draw(img)

    # Background bands.
    draw.rectangle((0, 0, WIDTH, 260), fill="#20242d")
    draw.rectangle((0, HEIGHT - 260, WIDTH, HEIGHT), fill="#181c23")
    draw.rounded_rectangle((72, 340, WIDTH - 72, HEIGHT - 360), radius=28, fill="#f6f2ea")

    accent = "#d8372a"
    draw.rectangle((72, 340, 96, HEIGHT - 360), fill=accent)

    draw.text((72, 86), eyebrow, font=font(44, True), fill="#f6f2ea")
    draw.text((72, 152), footer, font=font(28), fill="#b8c0cc")

    y = draw_text_block(draw, title, (132, 430), font(76, True), "#171717", 800, 18)
    y += 30
    if stat:
        draw.rounded_rectangle((132, y, WIDTH - 132, y + 180), radius=18, fill="#111318")
        draw.text((172, y + 42), stat, font=font(64, True), fill="#ffffff")
        y += 230
    draw_text_block(draw, body, (132, y), font(46), "#2c2c2c", 816, 16)

    draw.text((72, HEIGHT - 160), "来源需发布前核对：FNN / 东京Kantei", font=font(30), fill="#b8c0cc")
    img.save(path)


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def duration(path: Path) -> float:
    output = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            str(path),
        ],
        text=True,
    )
    return float(json.loads(output)["format"]["duration"])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", required=True)
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    frames_dir = out_dir / "frames"
    frames_dir.mkdir(exist_ok=True)

    voice_text = (
        "日元便宜了，来日本生活就一定更便宜吗？不一定，先看房租。"
        "FNN 5月14日报道，根据东京Kantei的数据，首都圈分譲マンション4月的租金，"
        "平均每平方米4143日元，比去年同期上涨11%。如果按70平米的家庭型房间算，"
        "大约是29万日元一个月。东京都的数据更高，每平方米接近4911日元。"
        "为什么会涨？简单说，房子本身的成本在变高。建筑成本、物价、维护成本都在涨，"
        "再加上城市里好位置的房源有限，租金就很难便宜下来。"
        "对留学生来说，这个新闻不代表你一定要租29万日元的房子，"
        "因为那是家庭型公寓的口径。但它提醒我们一件事：日元汇率便宜，"
        "不等于在日本生活成本一定下降。你真正要算的是房租、交通、吃饭、打工收入这几项加在一起。"
        "所以现在做日本留学预算，不能只看学费和汇率，房租和通勤距离也要提前算进去。"
    )
    tts_text = out_dir / "voice_text.txt"
    tts_text.write_text(voice_text, encoding="utf-8")

    audio = out_dir / "voice.aiff"
    try:
        run(["say", "-v", "Tingting", "-r", "205", "-f", str(tts_text), "-o", str(audio)])
        if audio.stat().st_size <= 4096:
            audio = None
    except Exception:
        audio = None

    slides = [
        (
            "今天看房租",
            "日元便宜了，生活就一定便宜吗？",
            "不一定。对准备来日本的人，房租可能比汇率更影响预算。",
            None,
        ),
        (
            "核心数据",
            "首都圈部分公寓租金继续上涨",
            "FNN 5月14日报道，东京Kantei数据显示，首都圈分譲マンション4月租金同比上涨。",
            "4143日元/㎡  +11%",
        ),
        (
            "换算一下",
            "70平米家庭型约29万日元/月",
            "这不是留学生单人房标准，但能说明首都圈居住成本压力在上升。",
            "约29万日元/月",
        ),
        (
            "为什么涨",
            "建筑成本、物价、维护成本都在涨",
            "城市好位置房源有限，成本上涨就更容易传导到租金。",
            None,
        ),
        (
            "留学生视角",
            "不要只看学费和汇率",
            "真正要算的是：房租、交通、吃饭、打工收入，以及通学时间。",
            None,
        ),
        (
            "一句话",
            "日元便宜 ≠ 日本生活一定便宜",
            "做留学预算时，房租和通勤距离要提前算进去。",
            None,
        ),
    ]

    frame_paths = []
    for i, slide in enumerate(slides, 1):
        path = frames_dir / f"slide_{i:02d}.png"
        make_slide(path, *slide)
        frame_paths.append(path)

    total = duration(audio) if audio else 72.0
    weights = [1.0, 1.35, 1.15, 1.15, 1.25, 1.0]
    unit = total / sum(weights)
    concat = out_dir / "concat.txt"
    with concat.open("w", encoding="utf-8") as f:
        for path, weight in zip(frame_paths, weights):
            f.write(f"file '{path.resolve()}'\n")
            f.write(f"duration {unit * weight:.3f}\n")
        f.write(f"file '{frame_paths[-1].resolve()}'\n")

    silent_video = out_dir / "draft_silent.mp4"
    run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat),
            "-vf",
            "fps=30,format=yuv420p",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(silent_video),
        ]
    )

    final = out_dir / "tokyo_rent_draft.mp4"
    if audio:
        run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(silent_video),
                "-i",
                str(audio),
                "-c:v",
                "copy",
                "-c:a",
                "aac",
                "-b:a",
                "160k",
                "-shortest",
                str(final),
            ]
        )
    else:
        silent_video.rename(final)

    print(final)


if __name__ == "__main__":
    main()
