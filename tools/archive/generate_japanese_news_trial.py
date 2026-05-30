from __future__ import annotations

from pathlib import Path
from textwrap import dedent

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path("/Users/user/Documents/New project")
DAY = "2026-05-18"
OUT = ROOT / "content_archive" / DAY
SOURCES = ROOT / "content_archive" / "sources"


NEWS = [
    {
        "source_key": "boj",
        "title": "4月の企業物価指数、前年比4.9%上昇",
        "points": [
            "日本銀行は5月15日、2026年4月の企業物価指数を公表した。",
            "国内企業物価指数は前年比+4.9%、前月比+2.3%となった。",
            "企業間のコスト上昇が、小売価格やサービス価格へ波及する可能性がある。",
        ],
        "org": "日本銀行",
        "date": "2026-05-15",
        "status": "確認済み。ただし、発表前にPDF本文で指数値と前年比を再確認すること。",
        "url": "https://www.boj.or.jp/statistics/pi/cgpi_release/index.htm",
    },
    {
        "source_key": "fnn_prime_online",
        "title": "首都圏のマンション賃料、過去最高水準に",
        "points": [
            "FNNは5月14日、東京カンテイのデータをもとに首都圏マンション賃料を報じた。",
            "2026年4月の首都圏平均は1平方メートルあたり4143円、前年比+11%。",
            "東京都は1平方メートルあたり4911円とされ、住居費負担の重さが改めて意識される。",
        ],
        "org": "FNN Prime Online",
        "date": "2026-05-14",
        "status": "要確認。分譲マンション賃料の口径であり、一般的な賃貸住宅全体とは区別すること。",
        "url": "https://www.fnn.jp/articles/-/1044612",
    },
    {
        "source_key": "stat_go_jp",
        "title": "3月の家計消費支出、実質2.9%減",
        "points": [
            "総務省統計局は5月12日、家計調査2026年3月分を公表した。",
            "二人以上の世帯の消費支出は1世帯当たり334,701円。",
            "前年同月比では実質2.9%減、名目1.3%減となり、節約志向の強さがうかがえる。",
        ],
        "org": "総務省統計局",
        "date": "2026-05-12",
        "status": "確認済み。二人以上の世帯という統計口径に注意。",
        "url": "https://www.stat.go.jp/data/kakei/sokuhou/tsuki/index.htm",
    },
    {
        "source_key": "esri_cao",
        "title": "2026年1-3月期GDP 1次速報、5月19日公表予定",
        "points": [
            "内閣府経済社会総合研究所の公表予定では、2026年1-3月期GDP 1次速報は5月19日8時50分に公表される。",
            "民間予測では、2四半期連続のプラス成長を見込む見方が出ている。",
            "個人消費と輸出が、景気判断の焦点になりそうだ。",
        ],
        "org": "内閣府 / e-Stat",
        "date": "2026-05-19予定",
        "status": "確認済み。現時点では公表予定であり、結果ではない。",
        "url": "https://www.esri.cao.go.jp/jp/sna/kouhyou/kouhyou_top.html?source=content_type%3Areact%7Cfirst_level_url%3Aarticle%7Csection%3Amain_content%7Cbutton%3Abody_link",
    },
    {
        "source_key": "stat_go_jp",
        "title": "4月全国CPI、5月22日公表予定",
        "points": [
            "総務省統計局の統計調査ニュースによると、全国2026年4月分の消費者物価指数は5月22日に公表予定。",
            "同日、小売物価統計調査の全国2026年4月分も公表される予定。",
            "5月29日には労働力調査と東京都区部CPI中旬速報値も予定されている。",
        ],
        "org": "総務省統計局",
        "date": "2026-05-22予定",
        "status": "確認済み。数値は未公表のため、予測や結果として扱わないこと。",
        "url": "https://www.stat.go.jp/info/t-news/pdf/2604.pdf",
    },
    {
        "source_key": "boj",
        "title": "日銀、5月18日に債券市場サーベイ等を公表予定",
        "points": [
            "日本銀行の公表予定では、5月18日17時に債券市場サーベイ（2026年5月調査）などが掲載予定。",
            "同日、日本銀行が保有する国債の銘柄別残高も公表予定となっている。",
            "金利環境の変化は、住宅ローンや企業の資金調達コストに影響し得る。",
        ],
        "org": "日本銀行",
        "date": "2026-05-18予定",
        "status": "確認済み。内容の評価は公表後に行うこと。",
        "url": "https://www.boj.or.jp/about/calendar/index.htm",
    },
    {
        "source_key": "jnto",
        "title": "3月の訪日外客数、361万8900人で3月として過去最高",
        "points": [
            "日本政府観光局（JNTO）は4月15日、2026年3月の訪日外客数を公表した。",
            "3月は3,618,900人で、3月として過去最高を更新した。",
            "桜シーズンやスクールホリデーによる訪日需要が押し上げ要因とされた。",
        ],
        "org": "日本政府観光局（JNTO）",
        "date": "2026-04-15",
        "status": "確認済み。ただし近48時間のニュースではなく、背景データとして扱うこと。",
        "url": "https://www.jnto.go.jp/news/press/20260415_monthly.html",
    },
]


VOCAB = [
    ("企業物価指数", "きぎょうぶっかしすう", "推定N2", "企業間で取引される商品の価格動向を示す指数。"),
    ("前年比", "ぜんねんひ", "N2", "前年と比べた割合。"),
    ("前月比", "ぜんげつひ", "N2", "前月と比べた割合。"),
    ("波及", "はきゅう", "N1", "影響が次第に広がること。"),
    ("小売価格", "こうりかかく", "推定N2", "消費者に販売されるときの価格。"),
    ("賃料", "ちんりょう", "N1", "部屋や土地などを借りるために支払う料金。"),
    ("水準", "すいじゅん", "N2", "程度やレベル。"),
    ("分譲", "ぶんじょう", "推定N1", "土地や建物を分けて売ること。"),
    ("口径", "こうけい", "推定N1", "統計や議論で使う範囲・定義。"),
    ("住居費", "じゅうきょひ", "推定N2", "住まいにかかる費用。"),
    ("負担", "ふたん", "N2", "費用や責任を引き受けること。"),
    ("家計調査", "かけいちょうさ", "推定N2", "家庭の収入や支出を調べる統計調査。"),
    ("消費支出", "しょうひししゅつ", "推定N2", "生活のために使った支出。"),
    ("実質", "じっしつ", "N2", "物価変動などを除いた実際の中身。"),
    ("名目", "めいもく", "N1", "物価変動を調整しない表面的な数値。"),
    ("節約志向", "せつやくしこう", "推定N2", "支出を抑えようとする傾向。"),
    ("速報", "そくほう", "N2", "早く知らせる報告。"),
    ("公表", "こうひょう", "N2", "広く一般に発表すること。"),
    ("民間予測", "みんかんよそく", "推定N2", "民間機関による見通し。"),
    ("景気判断", "けいきはんだん", "推定N2", "経済の状態を判断すること。"),
    ("消費者物価指数", "しょうひしゃぶっかしすう", "推定N2", "消費者が買う商品やサービスの価格動向を示す指数。"),
    ("労働力調査", "ろうどうりょくちょうさ", "推定N2", "就業者や失業者などを調べる統計。"),
    ("中旬速報値", "ちゅうじゅんそくほうち", "推定N1", "月の中ごろ時点で出す速報の数値。"),
    ("債券市場", "さいけんしじょう", "推定N2", "国債や社債などが取引される市場。"),
    ("国債", "こくさい", "N2", "国が発行する債券。"),
    ("銘柄別残高", "めいがらべつざんだか", "推定N1", "銘柄ごとに残っている数量や金額。"),
    ("資金調達", "しきんちょうたつ", "N1", "必要な資金を集めること。"),
    ("訪日外客数", "ほうにちがいきゃくすう", "推定N1", "日本を訪れた外国人旅行者の数。"),
    ("更新", "こうしん", "N2", "記録などを新しくすること。"),
    ("押し上げ要因", "おしあげよういん", "推定N1", "数値や需要を高める原因。"),
]


def write_md() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    SOURCES.mkdir(parents=True, exist_ok=True)
    lines = [
        f"# {DAY} 日本生活経済観察｜毎日日本語ニュース摘録",
        "",
        "> 試行版：近48時間を優先し、必要に応じて直近の公式統計・公表予定も含める。",
        "",
        "## 今日の注目Top 3",
        "",
        "1. 4月の企業物価指数、前年比4.9%上昇：生活コストの上流にある物価圧力として重要。",
        "2. 首都圏のマンション賃料、過去最高水準に：住居費負担の変化を示す身近な材料。",
        "3. 4月全国CPI、5月22日公表予定：今週の物価判断で最も注目される統計。",
        "",
        "## ニュース摘録",
        "",
    ]
    source_lines = [f"# {DAY} 来源清单", ""]
    fact_lines = [f"# {DAY} 確認メモ", ""]
    for i, item in enumerate(NEWS, 1):
        lines += [
            f"## {i}. {item['title']}",
            "",
            f"- 出典機関：{item['org']}",
            f"- 発表日/掲載日：{item['date']}",
            f"- 確認状態：{item['status']}",
            "",
            "### 日本語要点",
            "",
        ]
        lines += [f"- {p}" for p in item["points"]]
        lines.append("")

        source_lines += [
            f"## {i}. {item['title']}",
            "",
            f"- 机构：{item['org']}",
            f"- 日期：{item['date']}",
            f"- URL：{item['url']}",
            f"- 关键引用事实：{'; '.join(item['points'])}",
            f"- 核实状态：{item['status']}",
            "",
        ]
    lines += ["## N1・N2語彙リスト", "", "| 語彙 | かな | レベル | 短い意味 |", "| --- | --- | --- | --- |"]
    for word, kana, level, meaning in VOCAB:
        lines.append(f"| {word} | {kana} | {level} | {meaning} |")
    lines += [
        "",
        "## 確認メモ",
        "",
        "- 企業物価指数は日本銀行PDF本文で指数値、前年比、前月比を再確認する。",
        "- 首都圏賃料は分譲マンション賃料の口径であり、一般賃貸全体とは区別する。",
        "- 家計調査は二人以上の世帯が対象で、単身世帯や留学生の平均支出ではない。",
        "- GDPとCPIは現時点では公表予定であり、結果として扱わない。",
        "- JNTOの訪日外客数は近48時間のニュースではなく、背景データとして扱う。",
    ]
    (OUT / "news_japanese.md").write_text("\n".join(lines), encoding="utf-8")
    (OUT / "source_manifest.md").write_text("\n".join(source_lines), encoding="utf-8")
    (OUT / "fact_check.md").write_text("\n".join(fact_lines + lines[-5:]), encoding="utf-8")

    for item in NEWS:
        path = SOURCES / f"{item['source_key']}.md"
        entry = dedent(
            f"""

            ## {DAY}

            - 原文タイトル：{item['title']}
            - URL：{item['url']}
            - 引用位置：{DAY} 日語ニュース摘録。
            - 关键事实摘要：{'; '.join(item['points'])}
            - 人工核实状态：{item['status']}
            """
        )
        if path.exists():
            old = path.read_text(encoding="utf-8")
            if f"原文タイトル：{item['title']}" not in old:
                path.write_text(old.rstrip() + entry, encoding="utf-8")
        else:
            path.write_text(f"# {item['source_key']} 来源索引\n{entry}", encoding="utf-8")

    index = ROOT / "content_archive" / "index.md"
    row = f"| {DAY} | 7 | 企業物価+4.9%；首都圏賃料；4月CPI公表予定 | content_archive/{DAY}/daily_japanese_news.pdf | content_archive/{DAY}/ | 日語ニュース摘録試跑 |"
    text = index.read_text(encoding="utf-8") if index.exists() else ""
    if "## 日語ニュース摘録索引" not in text:
        text += "\n\n## 日語ニュース摘録索引\n\n| 日期 | 新闻数量 | 今日Top 3 | PDF | 归档目录 | 备注 |\n| --- | ---: | --- | --- | --- | --- |\n"
    if row not in text:
        text = text.rstrip() + "\n" + row + "\n"
    index.write_text(text, encoding="utf-8")


def make_pdf() -> None:
    pdfmetrics.registerFont(UnicodeCIDFont("HeiseiKakuGo-W5"))
    base = "HeiseiKakuGo-W5"
    pdf = OUT / "daily_japanese_news.pdf"
    doc = SimpleDocTemplate(
        str(pdf),
        pagesize=A4,
        rightMargin=10 * mm,
        leftMargin=10 * mm,
        topMargin=9 * mm,
        bottomMargin=9 * mm,
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="JPTitle", fontName=base, fontSize=14, leading=17, alignment=TA_CENTER, spaceAfter=4))
    styles.add(ParagraphStyle(name="JPH", fontName=base, fontSize=8, leading=9.5, textColor=colors.HexColor("#111827")))
    styles.add(ParagraphStyle(name="JP", fontName=base, fontSize=6.6, leading=7.8, textColor=colors.HexColor("#263238")))
    styles.add(ParagraphStyle(name="Small", fontName=base, fontSize=5.7, leading=6.8, textColor=colors.HexColor("#475569")))
    story = [
        Paragraph("日本生活経済観察｜毎日日本語ニュース摘録", styles["JPTitle"]),
        Paragraph(f"{DAY}｜A4 PDF 試行版｜URL非表示", styles["Small"]),
        Spacer(1, 3),
        Paragraph("今日の注目Top 3：1. 企業物価+4.9%　2. 首都圏賃料　3. 4月全国CPI公表予定", styles["JPH"]),
        Spacer(1, 4),
    ]
    table_data = [["#", "タイトル", "日本語要点", "出典"]]
    for idx, item in enumerate(NEWS, 1):
        table_data.append(
            [
                str(idx),
                Paragraph(item["title"], styles["JP"]),
                Paragraph("<br/>".join(item["points"][:2]), styles["Small"]),
                Paragraph(f"{item['org']}<br/>{item['date']}", styles["Small"]),
            ]
        )
    table = Table(table_data, colWidths=[8 * mm, 50 * mm, 92 * mm, 32 * mm], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), base),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 2.5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2.5),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 5))
    vocab_text = " / ".join([f"{w}（{k}）" for w, k, _, _ in VOCAB[:22]])
    story.append(Paragraph("N1・N2語彙：" + vocab_text, styles["Small"]))
    story.append(Spacer(1, 3))
    story.append(Paragraph("確認メモ：GDP・CPIは公表予定であり結果ではない。賃料は分譲マンション口径。家計調査は二人以上の世帯。", styles["Small"]))
    doc.build(story)


if __name__ == "__main__":
    write_md()
    make_pdf()
