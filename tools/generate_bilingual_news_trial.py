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
        "jp_title": "4月の企業物価指数、前年比4.9%上昇",
        "cn_title": "日本4月企业物价指数同比上涨4.9%",
        "jp_points": [
            "日本銀行は5月15日、2026年4月の企業物価指数を公表。",
            "国内企業物価指数は前年比+4.9%、前月比+2.3%。",
            "企業間のコスト上昇が、今後の小売価格やサービス価格に波及する可能性がある。",
        ],
        "cn_points": [
            "日本银行5月15日发布2026年4月企业物价指数。",
            "国内企业物价指数同比上涨4.9%，环比上涨2.3%。",
            "企业成本上升后，可能继续传导到零售价格和服务价格。",
        ],
        "why": "这是生活成本的上游指标。对留学生来说，超市、餐饮、交通和日用品价格后续是否继续涨，要看企业成本压力能否缓解。",
        "org": "日本銀行",
        "date": "2026-05-15",
        "url": "https://www.boj.or.jp/statistics/pi/cgpi_release/index.htm",
        "status": "已核实：官方公表页确认4月企业物价指数PDF已发布；具体数值参考官方PDF及路透/市场转述，发布前建议再打开PDF核对表格。",
    },
    {
        "source_key": "fnn_prime_online",
        "jp_title": "首都圏のマンション賃料、過去最高水準に",
        "cn_title": "首都圈公寓租金升至历史高位",
        "jp_points": [
            "FNNは5月14日、東京カンテイのデータをもとに首都圏マンション賃料を報道。",
            "2026年4月の首都圏平均は1平方メートルあたり4143円、前年比+11%。",
            "東京都は1平方メートルあたり4911円とされた。",
        ],
        "cn_points": [
            "FNN 5月14日依据东京Kantei数据报道首都圈公寓租金。",
            "2026年4月首都圈平均租金为每平方米4143日元，同比上涨11%。",
            "东京都为每平方米4911日元。",
        ],
        "why": "房租是留学预算里最硬的成本。这个题适合提醒观众：日元便宜不等于日本生活一定便宜。",
        "org": "FNN Prime Online",
        "date": "2026-05-14",
        "url": "https://www.fnn.jp/articles/-/1044612",
        "status": "需人工核实：这是媒体报道且为分譲マンション租金口径，不能泛化为所有出租房。",
    },
    {
        "source_key": "stat_go_jp",
        "jp_title": "3月の家計消費支出、実質2.9%減",
        "cn_title": "日本3月家庭消费支出实际下降2.9%",
        "jp_points": [
            "総務省統計局は5月12日、家計調査2026年3月分を公表。",
            "二人以上の世帯の消費支出は1世帯当たり334,701円。",
            "前年同月比で実質2.9%減、名目1.3%減。",
        ],
        "cn_points": [
            "总务省统计局5月12日发布2026年3月家计调查。",
            "两人以上家庭每户消费支出为334701日元。",
            "同比实际下降2.9%，名义下降1.3%。",
        ],
        "why": "这说明物价压力下家庭消费仍偏谨慎。对账号来说，可延伸到“日本人为什么更省钱”“留学生生活费怎么算”。",
        "org": "総務省統計局",
        "date": "2026-05-12",
        "url": "https://www.stat.go.jp/data/kakei/sokuhou/tsuki/index.htm",
        "status": "已核实：官方页面直接列出金额和同比数据。",
    },
    {
        "source_key": "esri_cao",
        "jp_title": "2026年1-3月期GDP 1次速報、5月19日公表予定",
        "cn_title": "日本2026年一季度GDP初值将于5月19日公布",
        "jp_points": [
            "内閣府経済社会総合研究所の公表予定によると、2026年1-3月期GDP 1次速報は5月19日8時50分公表予定。",
            "民間予測では、2四半期連続のプラス成長を見込む見方が出ている。",
            "個人消費と輸出が、生活実感と景気判断の焦点になる。",
        ],
        "cn_points": [
            "内阁府经济社会综合研究所公表计划显示，2026年一季度GDP初值预定5月19日8:50发布。",
            "民间预测中，有观点认为将连续两个季度正增长。",
            "个人消费和出口将是判断景气与生活实感的重点。",
        ],
        "why": "GDP不是日常生活新闻，但会影响“日本经济恢复了吗”的大判断。适合作为明天重点观察。",
        "org": "内閣府 / e-Stat",
        "date": "2026-05-19予定",
        "url": "https://www.esri.cao.go.jp/jp/sna/kouhyou/kouhyou_top.html?source=content_type%3Areact%7Cfirst_level_url%3Aarticle%7Csection%3Amain_content%7Cbutton%3Abody_link",
        "status": "已核实：官方公表予定确认日期；预测值需与各机构来源分开表述。",
    },
    {
        "source_key": "stat_go_jp",
        "jp_title": "4月全国CPI、5月22日公表予定",
        "cn_title": "日本4月全国CPI将于5月22日公布",
        "jp_points": [
            "総務省統計局の統計調査ニュースによると、全国2026年4月分の消費者物価指数は5月22日公表予定。",
            "同日、小売物価統計調査の全国2026年4月分も公表予定。",
            "5月29日には労働力調査と東京都区部CPI中旬速報値も予定されている。",
        ],
        "cn_points": [
            "总务省统计局统计调查新闻显示，全国2026年4月CPI预定5月22日公布。",
            "同日还将公布全国2026年4月小售物价统计调查。",
            "5月29日还预定发布劳动力调查和东京都区部CPI中旬速报。",
        ],
        "why": "CPI直接关系生活成本、工资实际购买力和日银政策。适合做本周数据日历。",
        "org": "総務省統計局",
        "date": "2026-05-22予定",
        "url": "https://www.stat.go.jp/info/t-news/pdf/2604.pdf",
        "status": "已核实：官方发布日程确认；具体数值尚未公布。",
    },
    {
        "source_key": "boj",
        "jp_title": "日銀、5月18日に債券市場サーベイ等を公表予定",
        "cn_title": "日本银行5月18日预定发布债券市场调查等资料",
        "jp_points": [
            "日本銀行の公表予定では、5月18日17時に債券市場サーベイ（2026年5月調査）等が掲載予定。",
            "同日、日本銀行が保有する国債の銘柄別残高なども予定されている。",
            "金利上昇局面では、住宅ローンや家賃、企業コストへの波及が注目される。",
        ],
        "cn_points": [
            "日本银行公表计划显示，5月18日17:00预定发布债券市场调查（2026年5月调查）等资料。",
            "同日还预定发布日本银行持有国债的分品种余额等数据。",
            "在利率上升环境下，房贷、房租和企业成本的传导值得关注。",
        ],
        "why": "这不是普通人每天会看的数据，但对解释房租、贷款利率和日银政策很有用。",
        "org": "日本銀行",
        "date": "2026-05-18予定",
        "url": "https://www.boj.or.jp/about/calendar/index.htm",
        "status": "已核实：官方日程确认；发布后需查看具体报告内容。",
    },
    {
        "source_key": "jnto",
        "jp_title": "3月の訪日外客数、361万8900人で3月として過去最高",
        "cn_title": "日本3月访日外国游客达361.89万人，创3月历史新高",
        "jp_points": [
            "日本政府観光局（JNTO）は4月15日、2026年3月の訪日外客数を公表。",
            "3月は3,618,900人で、3月として過去最高を更新。",
            "桜シーズンやスクールホリデーによる訪日需要が押し上げ要因とされた。",
        ],
        "cn_points": [
            "日本政府观光局（JNTO）4月15日发布2026年3月访日外国游客数据。",
            "3月为3618900人，刷新3月单月历史最高。",
            "樱花季和学校假期带来的访日需求是推动因素。",
        ],
        "why": "旅游热会影响打工机会、住宿价格、地方经济和服务业人手需求，适合作为背景题。",
        "org": "日本政府観光局（JNTO）",
        "date": "2026-04-15",
        "url": "https://www.jnto.go.jp/news/press/20260415_monthly.html",
        "status": "已核实：官方新闻稿；不是近48小时新闻，作为背景数据使用。",
    },
]


def write_md() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    SOURCES.mkdir(parents=True, exist_ok=True)
    lines = [
        f"# {DAY} 日本生活经济观察｜每日双语新闻摘选",
        "",
        "> 试跑口径：近48小时优先；若当天公开来源不足，补入最新官方待发布事项或最近官方数据，并在核实状态中标注。",
        "",
        "## 今日优先关注 Top 3",
        "",
        "1. 4月企业物价指数同比+4.9%：物价上游压力最强，适合解释后续生活成本。",
        "2. 首都圈公寓租金上涨：和留学生预算直接相关，容易做成短视频或图文。",
        "3. 4月全国CPI 5月22日发布：本周生活成本和日银政策观察重点。",
        "",
        "## 新闻摘选",
        "",
    ]
    source_lines = [f"# {DAY} 来源清单", ""]
    fact_lines = [f"# {DAY} 发布前核实清单", ""]
    for i, item in enumerate(NEWS, 1):
        lines += [
            f"## {i}. {item['jp_title']}",
            "",
            f"- 中文标题：{item['cn_title']}",
            f"- 来源机构：{item['org']}",
            f"- 发布时间/发布日期：{item['date']}",
            f"- URL：{item['url']}",
            f"- 核实状态：{item['status']}",
            "",
            "### 日语要点",
            "",
        ]
        lines += [f"- {p}" for p in item["jp_points"]]
        lines += ["", "### 中文翻译", ""]
        lines += [f"- {p}" for p in item["cn_points"]]
        lines += ["", "### 为什么值得关注", "", item["why"], ""]

        source_lines += [
            f"## {i}. {item['jp_title']}",
            "",
            f"- 机构：{item['org']}",
            f"- 日期：{item['date']}",
            f"- URL：{item['url']}",
            f"- 关键引用事实：{'; '.join(item['cn_points'])}",
            f"- 核实状态：{item['status']}",
            "",
        ]
    fact_lines += [
        "- 企业物价指数：发布前打开日本银行PDF，核对4.9%、2.3%、132.8等数字。",
        "- 首都圈租金：明确这是FNN报道的东京Kantei分譲マンション口径，不代表所有出租房。",
        "- 家计调查：确认“二人以上世带”口径，不可泛化为单身留学生平均消费。",
        "- GDP与CPI：目前是发布日程，不是结果；不要提前写成已经公布。",
        "- JNTO访日数据：不是近48小时新闻，只能作为背景数据。",
        "- 所有媒体转述数据，发布前优先找官方原始PDF或公告。",
        "",
    ]
    (OUT / "news_bilingual.md").write_text("\n".join(lines), encoding="utf-8")
    (OUT / "source_manifest.md").write_text("\n".join(source_lines), encoding="utf-8")
    (OUT / "fact_check.md").write_text("\n".join(fact_lines), encoding="utf-8")

    for item in NEWS:
        path = SOURCES / f"{item['source_key']}.md"
        entry = dedent(
            f"""

            ## {DAY}

            - 原文标题：{item['jp_title']}
            - URL：{item['url']}
            - 引用位置：{DAY} 双语新闻摘选。
            - 关键事实摘要：{'; '.join(item['cn_points'])}
            - 人工核实状态：{item['status']}
            """
        )
        if path.exists():
            old = path.read_text(encoding="utf-8")
            if f"## {DAY}\n\n- 原文标题：{item['jp_title']}" not in old:
                path.write_text(old.rstrip() + entry, encoding="utf-8")
        else:
            title = item["source_key"].replace("_", " ").title()
            path.write_text(f"# {title} 来源索引\n{entry}", encoding="utf-8")

    index = ROOT / "content_archive" / "index.md"
    row = f"| {DAY} | 7 | 企业物价+4.9%；首都圈租金上涨；4月CPI发布预告 | content_archive/{DAY}/daily_bilingual_news.pdf | content_archive/{DAY}/ | 双语新闻摘选试跑 |"
    if index.exists():
        text = index.read_text(encoding="utf-8")
        if "新闻数量" not in text.splitlines()[0:10].__str__():
            text += "\n\n## 双语新闻摘选索引\n\n| 日期 | 新闻数量 | 今日Top 3 | PDF | 归档目录 | 备注 |\n| --- | ---: | --- | --- | --- | --- |\n"
        if row not in text:
            text = text.rstrip() + "\n" + row + "\n"
        index.write_text(text, encoding="utf-8")


def make_pdf() -> None:
    pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
    pdf = OUT / "daily_bilingual_news.pdf"
    doc = SimpleDocTemplate(
        str(pdf),
        pagesize=A4,
        rightMargin=12 * mm,
        leftMargin=12 * mm,
        topMargin=10 * mm,
        bottomMargin=10 * mm,
    )
    styles = getSampleStyleSheet()
    base = "STSong-Light"
    styles.add(ParagraphStyle(name="CJKTitle", fontName=base, fontSize=15, leading=18, alignment=TA_CENTER, spaceAfter=5))
    styles.add(ParagraphStyle(name="CJKH", fontName=base, fontSize=8.8, leading=10.5, textColor=colors.HexColor("#111827"), spaceAfter=2))
    styles.add(ParagraphStyle(name="CJK", fontName=base, fontSize=7.1, leading=8.4, textColor=colors.HexColor("#263238")))
    styles.add(ParagraphStyle(name="Small", fontName=base, fontSize=6.1, leading=7.2, textColor=colors.HexColor("#475569")))

    story = [
        Paragraph("日本生活经济观察｜每日双语新闻摘选", styles["CJKTitle"]),
        Paragraph(f"{DAY}｜A4 PDF 试跑版｜近48小时优先，补入最新官方待发布/最近官方数据", styles["Small"]),
        Spacer(1, 4),
        Paragraph("今日优先关注 Top 3：1. 企业物价+4.9%　2. 首都圈租金上涨　3. 4月CPI 5月22日发布", styles["CJKH"]),
        Spacer(1, 4),
    ]
    table_data = [["#", "日本語タイトル / 中文标题", "精简双语要点", "来源"]]
    for idx, item in enumerate(NEWS, 1):
        jp = item["jp_points"][0]
        cn = item["cn_points"][0]
        table_data.append(
            [
                str(idx),
                Paragraph(f"{item['jp_title']}<br/>{item['cn_title']}", styles["CJK"]),
                Paragraph(f"日：{jp}<br/>中：{cn}<br/><font color='#475569'>{item['why']}</font>", styles["Small"]),
                Paragraph(f"{item['org']}<br/>{item['date']}", styles["Small"]),
            ]
        )
    table = Table(table_data, colWidths=[9 * mm, 55 * mm, 85 * mm, 32 * mm], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), base),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, 0), 7),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    story.append(table)
    story += [
        Spacer(1, 5),
        Paragraph("发布前核实提醒：GDP/CPI为发布日程不是结果；租金为分譲マンション口径；家计调查为二人以上世带；媒体转述数字优先回到官方PDF核对。", styles["Small"]),
        Paragraph("来源URL详见同目录 news_bilingual.md 与 source_manifest.md。", styles["Small"]),
    ]
    doc.build(story)


if __name__ == "__main__":
    write_md()
    make_pdf()
