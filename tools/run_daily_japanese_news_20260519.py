from __future__ import annotations

from collections import defaultdict
from pathlib import Path
from textwrap import dedent

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path("/Users/user/Documents/New project")
DAY = "2026-05-19"
OUT = ROOT / "content_archive" / DAY
SOURCES_DIR = ROOT / "content_archive" / "sources"


NEWS = [
    {
        "section": "経済・物価",
        "source_key": "esri_cao",
        "title": "1-3月期GDP一次速報、きょう8時50分に公表予定",
        "org": "内閣府経済社会総合研究所",
        "date": "2026-05-19予定",
        "url": "https://www.esri.cao.go.jp/jp/sna/kouhyou/kouhyou_top.html",
        "status": "確認済み。8時時点では公表予定であり、結果ではない。",
        "points": [
            "内閣府の公表予定では、2026年1-3月期の四半期別GDP速報一次速報は5月19日8時50分に公表される。",
            "GDPは個人消費、設備投資、輸出入、公的需要などを総合して景気の大きな方向を確認する統計。",
            "留学生の生活費には直接出ないが、賃金、雇用、物価対策、金融政策を読む前提になる。",
            "公表前の段階では、民間予測や市場の見通しを公式結果として扱わない。",
        ],
    },
    {
        "section": "経済・物価",
        "source_key": "stat_go_jp",
        "title": "4月全国CPI、22日に公表予定",
        "org": "総務省統計局",
        "date": "2026-05-22予定",
        "url": "https://www.stat.go.jp/info/t-news/pdf/2604.pdf",
        "status": "確認済み。統計調査ニュースに基づく。",
        "points": [
            "総務省統計局の統計調査ニュースでは、全国の2026年4月分消費者物価指数が5月22日に公表予定とされている。",
            "同日には小売物価統計調査の全国2026年4月分も予定され、食料、光熱、日用品価格を見る材料になる。",
            "物価指数は家計の実感と完全には一致しないが、食費や交通費を気にする学生には重要な背景指標。",
            "公表前の予想値、SNS上の切り抜き、海外メディアの速報を公式値として扱わない。",
        ],
    },
    {
        "section": "経済・物価",
        "source_key": "boj",
        "title": "日銀、20日に債券市場サーベイを公表予定",
        "org": "日本銀行",
        "date": "2026-05-20予定",
        "url": "https://www.boj.or.jp/about/calendar/index.htm",
        "status": "確認済み。日本銀行の公表予定表に基づく。",
        "points": [
            "日本銀行の公表予定では、5月20日に債券市場サーベイ（2026年5月調査）が掲載予定。",
            "債券市場サーベイは、市場参加者の国債市場に対する見方を把握する資料。",
            "長期金利の変化は、住宅ローン、企業の資金調達、家賃や不動産市場の雰囲気にも影響し得る。",
            "日々の生活には遠く見えるが、物価と金利をセットで読む材料として保存しておく。",
        ],
    },
    {
        "section": "経済・物価",
        "source_key": "tbs_news_dig",
        "title": "大和ハウス、7月以降の住宅引き渡し遅れの可能性",
        "org": "TBS NEWS DIG",
        "date": "2026-05-18",
        "url": "https://newsdig.tbs.co.jp/articles/-/2668842",
        "status": "確認済み。企業発表本文で追加確認するとより安全。",
        "points": [
            "大和ハウスは、中東情勢による建築資材の供給不安を受け、7月以降の住宅引き渡しが遅れる可能性を明らかにした。",
            "住宅設備や建築資材の調達難は、新築住宅だけでなくリフォーム、賃貸物件の修繕にも波及する可能性がある。",
            "住まいの供給が遅れると、家賃、引っ越し時期、契約更新の判断にも影響し得る。",
            "留学生が部屋探しをする際も、建築・修繕遅れによる入居時期変更には注意が必要。",
        ],
    },
    {
        "section": "経済・物価",
        "source_key": "tbs_news_dig",
        "title": "ブラジル外相、日本への原油供給で貢献可能との考え",
        "org": "TBS NEWS DIG",
        "date": "2026-05-19",
        "url": "https://newsdig.tbs.co.jp/list/genre/%E7%B5%8C%E6%B8%88",
        "status": "要確認。経済ニュース一覧ベースのため、本文確認が必要。",
        "points": [
            "TBSの経済ニュース一覧では、ブラジル外相が日本への原油供給で貢献可能との考えを示したとされる。",
            "赤沢経済産業大臣は、リオ沖の油田開発や今後の増産を踏まえ、原油調達での連携を呼びかけたと報じられている。",
            "中東依存を下げる調達先分散は、ガソリン、電気代、物流費、食品価格に関係する。",
            "本文と経産省側の発表を確認し、実際の契約、協議段階、政治的発言を分けて読む。",
        ],
    },
    {
        "section": "経済・物価",
        "source_key": "tbs_news_dig",
        "title": "大王製紙、家庭用・業務用全製品を15%以上値上げへ",
        "org": "TBS NEWS DIG",
        "date": "2026-05-15",
        "url": "https://newsdig.tbs.co.jp/articles/-/2664735",
        "status": "確認済み。近7日内の生活コスト関連ニュースとして採用。",
        "points": [
            "大王製紙は、ティッシュペーパーやトイレットペーパーなど家庭用・業務用の全製品を値上げすると発表した。",
            "8月1日納品分から現在価格より15%以上の値上げを行うとされ、対象にはエリエールブランドも含まれる。",
            "原材料、包装資材、インクなどの価格上昇が理由とされ、生活用品にも中東情勢の影響が出ている。",
            "日用品は節約しにくいため、留学生の生活費では食費と並んで固定的な負担になりやすい。",
        ],
    },
    {
        "section": "企業・消費",
        "source_key": "tbs_news_dig",
        "title": "食品パッケージの色数を減らす動き、ナフサ調達不安が背景",
        "org": "TBS NEWS DIG",
        "date": "2026-05-15",
        "url": "https://newsdig.tbs.co.jp/articles/-/2664993",
        "status": "確認済み。近7日内の物価背景ニュースとして採用。",
        "points": [
            "中東情勢の影響でインク原料のナフサ調達が不安定になり、食品パッケージの色数を減らす動きが報じられた。",
            "農水大臣は、供給不安に備えた企業判断との認識を示し、必要量は供給できていると説明した。",
            "包装の簡素化は値札には直接出にくいが、企業がコスト上昇を吸収するための対応として見られる。",
            "消費者は価格だけでなく、内容量、包装、品質表示の変化にも注意する必要がある。",
        ],
    },
    {
        "section": "企業・消費",
        "source_key": "tbs_news_dig",
        "title": "3メガ銀行、純利益合計5兆円超",
        "org": "TBS NEWS DIG",
        "date": "2026-05-15",
        "url": "https://newsdig.tbs.co.jp/articles/-/2664932",
        "status": "確認済み。各社決算短信で二重確認するとより安全。",
        "points": [
            "三菱UFJ、三井住友、みずほの大手銀行3グループは、金利上昇を追い風に純利益がいずれも過去最高となった。",
            "3社合計の純利益は5兆円を超え、金利上昇が銀行の利ざや改善につながっている。",
            "銀行業績の改善は、金融業界の採用、賃金、サービス競争にも影響する可能性がある。",
            "家計側では預金金利、住宅ローン、手数料などを通じて金利環境の変化を受ける。",
        ],
    },
    {
        "section": "政治・政策",
        "source_key": "tbs_news_dig",
        "title": "高市総理、きょうから韓国訪問へ",
        "org": "TBS NEWS DIG",
        "date": "2026-05-18",
        "url": "https://newsdig.tbs.co.jp/articles/-/2666419",
        "status": "確認済み。会談後の共同発表で内容確認が必要。",
        "points": [
            "高市総理は5月19日から1泊2日の日程で韓国を訪問し、李在明大統領と首脳会談を行う予定。",
            "韓国大統領府は、国賓に準じた待遇で歓迎すると発表した。",
            "日韓関係は観光、留学、就職、地域経済、若者交流に影響しやすい。",
            "会談後に経済協力、人的交流、安全保障、歴史問題への言及があるかを確認する。",
        ],
    },
    {
        "section": "政治・政策",
        "source_key": "tbs_news_dig",
        "title": "為替介入をめぐり、日米の連携確認が続く",
        "org": "TBS NEWS DIG / nippon.com",
        "date": "2026-05-12",
        "url": "https://newsdig.tbs.co.jp/articles/withbloomberg/2653761?display=1",
        "status": "要確認。やや古いが円安・物価の背景として採用。",
        "points": [
            "片山財務大臣は、米ベッセント財務長官との会談後、日本の為替介入について米側の理解を得たとの認識を示した。",
            "政府は、過度な変動がある場合のみ対応するという日米財務相の共同声明に沿っていると説明している。",
            "円安は輸入品、エネルギー、食品価格に影響し、留学生の生活費にも関係する。",
            "今朝のニュースとして扱う場合は、直近の為替水準と財務省発言を追加確認する。",
        ],
    },
    {
        "section": "社会・生活",
        "source_key": "tbs_news_dig",
        "title": "クルーズ船乗客ら帰国へ、ハンタウイルス集団感染疑い",
        "org": "TBS NEWS DIG",
        "date": "2026-05-19",
        "url": "https://newsdig.tbs.co.jp/articles/",
        "status": "要確認。トップページ見出しベースのため本文確認が必要。",
        "points": [
            "TBSのトップページでは、クルーズ船の乗客らが帰国へ向かい、陽性者や体調不良者がいると報じられている。",
            "日本人1人は英国で最大45日間の健康観察対象になるとされ、感染症管理と国際移動の問題が重なる。",
            "旅行、留学、帰省では、渡航先の感染症情報、保険、隔離・健康観察ルールの確認が必要。",
            "ハンタウイルスの種類、感染経路、国内リスクは専門機関の情報で確認する。",
        ],
    },
    {
        "section": "社会・生活",
        "source_key": "tbs_news_dig",
        "title": "愛媛・今治の造船工場で男性2人死亡",
        "org": "TBS NEWS DIG",
        "date": "2026-05-19",
        "url": "https://newsdig.tbs.co.jp/articles/",
        "status": "要確認。トップページ見出しベースのため本文確認が必要。",
        "points": [
            "TBSのトップページでは、愛媛県今治市の造船工場で男性2人が死亡したと報じられている。",
            "見出しでは、LPGタンカーの窒素ガス除去作業中だったことが示されている。",
            "工場、造船、物流の現場では、酸欠や有毒ガスなど目に見えにくい労働安全リスクがある。",
            "留学生のアルバイトや就職でも、安全教育、保護具、作業環境の説明を軽視しないことが重要。",
        ],
    },
    {
        "section": "社会・生活",
        "source_key": "tbs_news_dig",
        "title": "仙台・広瀬川でアユ5000匹以上が大量死",
        "org": "TBS NEWS DIG",
        "date": "2026-05-18",
        "url": "https://newsdig.tbs.co.jp/articles/",
        "status": "要確認。トップページ見出しベースのため、自治体発表を確認する。",
        "points": [
            "TBSのトップページでは、仙台の広瀬川でアユ5000匹以上が大量死したと報じられている。",
            "原因は、農業用水の取水などによる水不足の可能性があるとされる。",
            "水資源、農業、河川環境は、食品価格や地域観光にもつながる生活テーマ。",
            "正式利用前には仙台市、宮城県、河川管理者の発表を確認する。",
        ],
    },
    {
        "section": "社会・生活",
        "source_key": "tbs_news_dig",
        "title": "閉山中の富士山で無謀な登山が相次ぐ",
        "org": "TBS NEWS DIG",
        "date": "2026-05-17",
        "url": "https://newsdig.tbs.co.jp/",
        "status": "確認済み。山梨県・静岡県の登山情報で追加確認が望ましい。",
        "points": [
            "TBSは、閉山中の富士山で無謀な登山が相次いでいると報じた。",
            "富士山は観光地として有名だが、閉山期は天候、装備、救助体制の面でリスクが高い。",
            "外国人観光客や留学生も訪れやすい場所のため、日本語・英語の登山規制情報を事前確認する必要がある。",
            "安い交通費やSNS映えだけで判断せず、開山期間、保険、装備、撤退判断を重視する。",
        ],
    },
    {
        "section": "社会・生活",
        "source_key": "tbs_news_dig",
        "title": "5月28日から防災気象情報の提供方法が変更へ",
        "org": "TBS NEWS DIG / 気象庁関連情報",
        "date": "2026-05-14",
        "url": "https://newsdig.tbs.co.jp/articles/-/2661996",
        "status": "確認済み。気象庁資料で制度名を再確認する。",
        "points": [
            "5月28日から新たな防災気象情報、注意報・警報の提供が始まると報じられている。",
            "大雨や洪水時の逃げ遅れを防ぐため、警戒レベルや色分けの理解が重要になる。",
            "外国人住民や留学生にとって、日本語の防災表現は難しく、普段から避難情報を確認しておきたい分野。",
            "住んでいる自治体の防災アプリ、避難場所、ハザードマップを一度確認しておく。",
        ],
    },
    {
        "section": "社会・生活",
        "source_key": "tbs_news_dig",
        "title": "20日ごろから広い範囲で10年に1度程度の高温可能性",
        "org": "TBS NEWS DIG / 気象庁関連情報",
        "date": "2026-05-15",
        "url": "https://newsdig.tbs.co.jp/articles/-/2662423",
        "status": "確認済み。気象庁の早期天候情報を併読する。",
        "points": [
            "気象庁は高温に関する早期天候情報を発表し、5月20日ごろから28日ごろにかけて著しい高温の可能性を示した。",
            "北海道を除く各地方で、この時期としては10年に1度程度の高温となる可能性がある。",
            "5月でも熱中症リスクがあり、通学、アルバイト、部活動では水分補給と冷房準備が必要。",
            "高温は電気代、食品保存、睡眠環境にも影響する生活コストのニュースとして見られる。",
        ],
    },
    {
        "section": "教育・留学",
        "source_key": "moj_isa",
        "title": "外国人支援者向け在留資格セミナー、21日に開催予定",
        "org": "出入国在留管理庁 / FRESC",
        "date": "2026-05-21予定",
        "url": "https://www.moj.go.jp/isa/support/fresc/fresc01.html",
        "status": "確認済み。対象者と参加方法は公式ページで要確認。",
        "points": [
            "外国人在留支援センターは、外国人支援者向けセミナー基礎編「支援に役立つ在留資格の基礎知識」を5月21日に開催予定。",
            "在留資格は、留学から就労への変更、資格外活動、更新手続き、家族滞在などに関わる。",
            "留学生本人向けではなく支援者向けの可能性があるが、制度理解の入口として有用。",
            "資料公開の有無、参加対象、使用言語を確認し、使える情報があれば保存しておく。",
        ],
    },
    {
        "section": "雇用・賃金",
        "source_key": "livedoor_news",
        "title": "ストレスチェック、2028年4月から全事業所で義務化へ",
        "org": "共同通信 / ライブドアニュース",
        "date": "2026-05-18",
        "url": "https://news.livedoor.com/article/detail/31306115/",
        "status": "確認済み。厚労省の制度資料で詳細確認が必要。",
        "points": [
            "厚生労働省は、働く人の心理的負荷を調べるストレスチェックを2028年4月から全事業所で義務化する方針を明らかにした。",
            "これまで対象外だった小規模事業所にも広がるため、アルバイト先や中小企業でもメンタルヘルス対応が重要になる。",
            "留学生のアルバイトでは、長時間労働、シフト過多、日本語での相談しにくさがストレス要因になりやすい。",
            "制度開始時期、対象人数、実施方法、個人情報の扱いは厚労省資料で確認する。",
        ],
    },
    {
        "section": "雇用・賃金",
        "source_key": "livedoor_news",
        "title": "外食分野の特定技能、新規受け入れ停止で企業が苦慮",
        "org": "ライブドアニュース / 読売新聞系記事",
        "date": "2026-05-17",
        "url": "https://news.livedoor.com/article/detail/31293948/",
        "status": "要確認。出入国在留管理庁の一次情報を確認する。",
        "points": [
            "外食業で在留資格「特定技能1号」の新たな受け入れが4月13日から原則停止されたと報じられている。",
            "背景には、外食分野の受け入れ人数が上限に近づいたことがあるとされる。",
            "外食は留学生のアルバイト先や卒業後の就職先として身近な業種。",
            "既に働いている人、更新、転職、新規入国で扱いが違う可能性があるため、公式情報で確認する。",
        ],
    },
    {
        "section": "テクノロジー",
        "source_key": "tbs_news_dig",
        "title": "米国務省がUFO資料161点を公開、日本周辺の物体にも言及",
        "org": "TBS NEWS DIG",
        "date": "2026-05-19",
        "url": "https://newsdig.tbs.co.jp/articles/",
        "status": "要確認。トップページ見出しベースのため、公開資料の原文確認が必要。",
        "points": [
            "TBSのトップページでは、米国務省がUFO資料161点を公開し、日本周辺の正体不明の飛行物体にも触れたと報じられている。",
            "木原官房長官は重大な関心を示したとされ、国防、航空安全、情報公開のテーマが重なる。",
            "話題性は高いが、科学的確認、軍事機密、外交上の表現を慎重に分けて読む必要がある。",
            "原文資料、政府会見、専門家解説を確認するまで断定的に扱わない。",
        ],
    },
    {
        "section": "スポーツ",
        "source_key": "jfa",
        "title": "サッカー日本代表、W杯メンバー26人発表が引き続き話題",
        "org": "日本サッカー協会",
        "date": "2026-05-16",
        "url": "https://www.jfa.jp/samuraiblue/worldcup_2026/news/00036341/",
        "status": "確認済み。公式発表に基づく。",
        "points": [
            "日本サッカー協会は、FIFAワールドカップ2026に臨むSAMURAI BLUEのメンバー26人を発表した。",
            "日本は8大会連続8度目の出場で、グループステージではオランダ、チュニジア、スウェーデンと対戦する。",
            "代表発表は、テレビ視聴、スポーツバー、グッズ、SNS話題、広告出稿など消費面にも影響する。",
            "留学生にとっても、日本人との雑談で使いやすい共通話題になりやすい。",
        ],
    },
    {
        "section": "スポーツ",
        "source_key": "npb",
        "title": "プロ野球、19日は各地で公式戦予定",
        "org": "NPB / スポーツナビ",
        "date": "2026-05-19予定",
        "url": "https://baseball.yahoo.co.jp/npb/schedule/first/all?date=2026-05-19",
        "status": "確認済み。試合日程は変更の可能性がある。",
        "points": [
            "5月19日は、ヤクルト対巨人、阪神対中日、広島対DeNA、日本ハム対楽天などが予定されている。",
            "試合開始は多くが18時で、平日夜の交通、飲食、地域消費にも関係する。",
            "地方球場での開催もあり、スポーツ興行は地域経済の材料として見られる。",
            "雨天や運営事情で変更される可能性があるため、観戦前には公式日程を確認する。",
        ],
    },
]


TOP5 = [
    ("1-3月期GDP一次速報、きょう8時50分に公表予定", "今週の景気判断の基礎になるため。"),
    ("大和ハウス、7月以降の住宅引き渡し遅れの可能性", "住まいと建築資材の供給不安を示すため。"),
    ("ブラジル外相、日本への原油供給で貢献可能との考え", "エネルギー調達と生活コストに関係するため。"),
    ("ストレスチェック、2028年4月から全事業所で義務化へ", "アルバイトを含む働き方の変化につながるため。"),
    ("20日ごろから広い範囲で10年に1度程度の高温可能性", "通学、健康管理、電気代に影響するため。"),
]


VOCAB = [
    ("四半期別GDP速報", "しはんきべつジーディーピーそくほう", "推定N1", "一定期間の国内総生産を早く示す統計。"),
    ("公表予定", "こうひょうよてい", "N2", "広く発表される予定。"),
    ("消費者物価指数", "しょうひしゃぶっかしすう", "推定N2", "消費者が買う商品やサービスの価格動向を示す指数。"),
    ("小売物価", "こうりぶっか", "推定N2", "店頭で消費者に販売される商品の価格。"),
    ("債券市場", "さいけんしじょう", "推定N2", "国債や社債などが取引される市場。"),
    ("長期金利", "ちょうききんり", "推定N2", "期間の長い資金にかかる金利。"),
    ("資金調達", "しきんちょうたつ", "N1", "必要な資金を集めること。"),
    ("供給不安", "きょうきゅうふあん", "推定N2", "必要な量が安定して供給されない不安。"),
    ("建築資材", "けんちくしざい", "推定N2", "建物を作るための材料。"),
    ("波及", "はきゅう", "N1", "影響が次第に広がること。"),
    ("原油供給", "げんゆきょうきゅう", "推定N2", "原油を安定して供給すること。"),
    ("調達先", "ちょうたつさき", "推定N2", "必要な物を入手する相手先。"),
    ("価格転嫁", "かかくてんか", "推定N1", "上がったコストを販売価格に反映すること。"),
    ("納品分", "のうひんぶん", "推定N2", "納められる商品の分。"),
    ("原材料", "げんざいりょう", "N2", "製品を作るもとになる材料。"),
    ("ナフサ", "ナフサ", "推定N1", "石油化学製品の原料になる油。"),
    ("簡素化", "かんそか", "N2", "複雑なものを簡単にすること。"),
    ("純利益", "じゅんりえき", "推定N2", "最終的に残る利益。"),
    ("利ざや", "りざや", "推定N1", "金利差などから得る利益。"),
    ("首脳会談", "しゅのうかいだん", "N2", "国の代表者同士の会談。"),
    ("国賓", "こくひん", "N1", "国が公式に迎える重要な客。"),
    ("為替介入", "かわせかいにゅう", "推定N1", "通貨当局が為替相場に影響を与えるため売買すること。"),
    ("過度な変動", "かどなへんどう", "推定N2", "行き過ぎた大きな変化。"),
    ("健康観察", "けんこうかんさつ", "推定N2", "体調の変化を一定期間確認すること。"),
    ("集団感染", "しゅうだんかんせん", "推定N2", "同じ場所や集団で感染が広がること。"),
    ("酸欠", "さんけつ", "推定N1", "酸素が不足すること。"),
    ("労働安全", "ろうどうあんぜん", "推定N2", "働く場所で事故を防ぎ安全を守ること。"),
    ("大量死", "たいりょうし", "推定N2", "多くの生物が一度に死ぬこと。"),
    ("取水", "しゅすい", "推定N1", "川などから水を取ること。"),
    ("閉山中", "へいざんちゅう", "推定N2", "山が公式に開かれていない期間。"),
    ("防災気象情報", "ぼうさいきしょうじょうほう", "推定N1", "災害を防ぐための気象情報。"),
    ("早期天候情報", "そうきてんこうじょうほう", "推定N1", "通常より早く注意を促す気象情報。"),
    ("著しい", "いちじるしい", "N2", "程度がはっきり大きい。"),
    ("在留資格", "ざいりゅうしかく", "推定N2", "外国人が日本に滞在するための資格。"),
    ("資格外活動", "しかくがいかつどう", "推定N1", "在留資格で認められた範囲外の活動。"),
    ("心理的負荷", "しんりてきふか", "推定N1", "心にかかる負担。"),
    ("義務化", "ぎむか", "N2", "必ず行うよう制度で決めること。"),
    ("特定技能", "とくていぎのう", "推定N1", "一定の技能を持つ外国人向けの在留資格。"),
    ("受け入れ停止", "うけいれていし", "推定N2", "新たに受け入れることを止めること。"),
    ("情報公開", "じょうほうこうかい", "N2", "行政や組織の情報を外部に示すこと。"),
    ("選出", "せんしゅつ", "N2", "選んで出すこと。"),
    ("興行", "こうぎょう", "N1", "観客を集めて行う催しや事業。"),
]


def grouped_news() -> dict[str, list[dict[str, object]]]:
    grouped: dict[str, list[dict[str, object]]] = defaultdict(list)
    for item in NEWS:
        grouped[str(item["section"])].append(item)
    return grouped


def write_markdown() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    SOURCES_DIR.mkdir(parents=True, exist_ok=True)
    lines = [
        f"# {DAY} 日本生活経済観察｜毎日日本語ニュース摘録",
        "",
        "> 試行版：当日および近48時間を優先し、必要に応じて直近7日以内の公式統計・公表予定・背景性の高いニュースも含める。",
        "",
        "## 今日の注目Top 5",
        "",
    ]
    for title, reason in TOP5:
        lines.append(f"- {title}：{reason}")
    lines += ["", "## ニュース摘録", ""]

    for section, items in grouped_news().items():
        lines += [f"## {section}", ""]
        for item in items:
            lines += [
                f"### {item['title']}",
                "",
                f"- 分類：{item['section']}",
                f"- 出典機関：{item['org']}",
                f"- 発表日/掲載日：{item['date']}",
                f"- 確認状態：{item['status']}",
                "",
                "#### 日本語要点",
                "",
            ]
            lines += [f"- {point}" for point in item["points"]]
            lines.append("")

    lines += [
        "## N1・N2語彙リスト",
        "",
        "| 語彙 | かな | レベル | 短い意味 |",
        "| --- | --- | --- | --- |",
    ]
    for word, kana, level, meaning in VOCAB:
        lines.append(f"| {word} | {kana} | {level} | {meaning} |")

    lines += [
        "",
        "## 確認メモ",
        "",
        "- GDPとCPIは公表予定であり、8時時点では結果として扱わない。",
        "- TBSトップページまたは一覧ベースの項目は、本文公開後に原文確認する。",
        "- ブラジル原油供給、為替介入、特定技能は、政府・省庁の一次資料で制度や発言の範囲を確認する。",
        "- 感染症、労働災害、防災、気象は、専門機関・自治体・警察消防発表を併読する。",
        "- スポーツ日程は当日変更の可能性があるため、公式日程を確認する。",
    ]
    (OUT / "news_japanese.md").write_text("\n".join(lines), encoding="utf-8")

    source_lines = [f"# {DAY} source_manifest", ""]
    for idx, item in enumerate(NEWS, 1):
        source_lines += [
            f"## {idx}. {item['title']}",
            "",
            f"- 分類：{item['section']}",
            f"- 機関：{item['org']}",
            f"- 日付：{item['date']}",
            f"- URL：{item['url']}",
            f"- 关键事实摘要：{'; '.join(item['points'])}",
            f"- 核实状态：{item['status']}",
            "",
        ]
    (OUT / "source_manifest.md").write_text("\n".join(source_lines), encoding="utf-8")

    fact_lines = [
        f"# {DAY} 確認メモ",
        "",
        "- GDP、CPI、日銀予定は公式ページの公表時刻と最新更新日を確認する。",
        "- TBS/JNN由来の見出しベース項目は本文または一次資料で二重確認する。",
        "- 外国人雇用・在留資格関連は、出入国在留管理庁の一次資料を最優先する。",
        "- 感染症、気象、防災、労働災害は専門機関・自治体・警察消防発表を確認する。",
        "- スポーツ日程は公式サイトで当日変更を確認する。",
    ]
    (OUT / "fact_check.md").write_text("\n".join(fact_lines), encoding="utf-8")

    for item in NEWS:
        path = SOURCES_DIR / f"{item['source_key']}.md"
        entry = dedent(
            f"""

            ## {DAY}

            - 原文タイトル：{item['title']}
            - 分類：{item['section']}
            - URL：{item['url']}
            - 引用位置：{DAY} 日本語ニュース摘録。
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
    row = f"| {DAY} | {len(NEWS)} | GDP公表予定；大和ハウス；原油調達；ストレスチェック；高温情報 | content_archive/{DAY}/daily_japanese_news.pdf | content_archive/{DAY}/ | 分類別20条・日本語版 |"
    text = index.read_text(encoding="utf-8") if index.exists() else ""
    if "## 日語ニュース摘録索引" not in text:
        text += "\n\n## 日語ニュース摘録索引\n\n| 日期 | 新闻数量 | 今日Top | PDF | 归档目录 | 备注 |\n| --- | ---: | --- | --- | --- | --- |\n"
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
        rightMargin=8 * mm,
        leftMargin=8 * mm,
        topMargin=8 * mm,
        bottomMargin=8 * mm,
    )
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="TitleJP", fontName=base, fontSize=13, leading=15, alignment=TA_CENTER, textColor=colors.HexColor("#111827")))
    styles.add(ParagraphStyle(name="Meta", fontName=base, fontSize=6.2, leading=7.2, textColor=colors.HexColor("#475569"), alignment=TA_CENTER))
    styles.add(ParagraphStyle(name="Section", fontName=base, fontSize=8, leading=9, textColor=colors.HexColor("#111827"), spaceBefore=2, spaceAfter=2))
    styles.add(ParagraphStyle(name="Small", fontName=base, fontSize=5.1, leading=5.9, textColor=colors.HexColor("#475569")))

    story = [
        Paragraph("日本生活経済観察｜毎日日本語ニュース摘録", styles["TitleJP"]),
        Paragraph(f"{DAY}｜分類別20条｜URL非表示", styles["Meta"]),
        Spacer(1, 3),
        Paragraph("今日の注目Top 5", styles["Section"]),
    ]
    top_table = [[Paragraph(title, styles["Small"]), Paragraph(reason, styles["Small"])] for title, reason in TOP5]
    table = Table(top_table, colWidths=[124 * mm, 51 * mm])
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.2, colors.HexColor("#d7dee8")),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 2),
                ("RIGHTPADDING", (0, 0), (-1, -1), 2),
                ("TOPPADDING", (0, 0), (-1, -1), 1.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
            ]
        )
    )
    story += [table, Spacer(1, 3)]

    for page_items, label in ((NEWS[:10], "ニュース摘録（1-10）"), (NEWS[10:], "ニュース摘録（11-20）")):
        story.append(Paragraph(label, styles["Section"]))
        rows = [["分類", "タイトル", "要点", "出典"]]
        for item in page_items:
            rows.append(
                [
                    Paragraph(str(item["section"]), styles["Small"]),
                    Paragraph(str(item["title"]), styles["Small"]),
                    Paragraph(str(item["points"][0]), styles["Small"]),
                    Paragraph(f"{item['org']}<br/>{item['date']}", styles["Small"]),
                ]
            )
        t = Table(rows, colWidths=[23 * mm, 45 * mm, 80 * mm, 27 * mm], repeatRows=1)
        t.setStyle(
            TableStyle(
                [
                    ("FONTNAME", (0, 0), (-1, -1), base),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111827")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.2, colors.HexColor("#d7dee8")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                    ("LEFTPADDING", (0, 0), (-1, -1), 1.2),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 1.2),
                    ("TOPPADDING", (0, 0), (-1, -1), 1),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
                ]
            )
        )
        story.append(t)
        if label.endswith("1-10）"):
            story.append(PageBreak())
        else:
            story.append(Spacer(1, 2.5))

    story.append(Paragraph("N1・N2語彙リスト", styles["Section"]))
    vocab_text = " / ".join(f"{word}（{kana}）" for word, kana, _, _ in VOCAB[:24])
    story.append(Paragraph(vocab_text, styles["Small"]))
    story.append(Spacer(1, 2))
    story.append(
        Paragraph(
            "確認メモ：GDP・CPIは公表予定。見出し一覧ベースの項目は本文または一次資料で再確認。制度・気象・スポーツ日程は公式発表の更新を確認。",
            styles["Small"],
        )
    )
    doc.build(story)


def main() -> None:
    write_markdown()
    make_pdf()


if __name__ == "__main__":
    main()
