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
from reportlab.platypus import KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path("/Users/user/Documents/New project")
DAY = "2026-05-18"
OUT = ROOT / "content_archive" / DAY
SOURCES_DIR = ROOT / "content_archive" / "sources"


NEWS = [
    {
        "section": "経済・物価",
        "source_key": "esri_cao",
        "title": "1-3月期GDP一次速報、19日8時50分に公表予定",
        "org": "内閣府経済社会総合研究所 / e-Stat",
        "date": "2026-05-19予定",
        "url": "https://www.esri.cao.go.jp/jp/sna/kouhyou/kouhyou_top.html",
        "status": "確認済み。現時点では公表予定であり、結果ではない。",
        "points": [
            "内閣府は、2026年1-3月期の四半期別GDP速報一次速報を5月19日8時50分に公表する予定。",
            "GDPは個人消費、設備投資、輸出入などを総合して景気の大きな方向を確認する統計で、生活実感とのずれも見られやすい。",
            "民間予測ではプラス成長を見込む見方が出ているが、公式値の公表前なので予測と実績を混同しない必要がある。",
            "留学生の生活費には直接の数値ではないが、景気判断、賃金、物価政策を読む前提になる。",
        ],
    },
    {
        "section": "経済・物価",
        "source_key": "stat_go_jp",
        "title": "4月全国CPI、22日に公表予定",
        "org": "総務省統計局",
        "date": "2026-05-22予定",
        "url": "https://www.stat.go.jp/info/t-news/pdf/2604.pdf",
        "status": "確認済み。数値は未公表のため、予測や結果として扱わない。",
        "points": [
            "総務省統計局の統計調査ニュースでは、全国の2026年4月分消費者物価指数が5月22日に公表予定とされている。",
            "同じ日には小売物価統計調査の全国2026年4月分も公表予定で、食料、光熱、サービス価格の確認材料になる。",
            "物価指数は家計の実感と完全には一致しないが、家賃、食費、交通費を考える留学生にとって重要な背景指標。",
            "発表前の段階では、SNS上の予想値や切り抜き情報を公式結果として扱わない。",
        ],
    },
    {
        "section": "経済・物価",
        "source_key": "boj",
        "title": "日銀、債券市場サーベイなどを今週公表予定",
        "org": "日本銀行",
        "date": "2026-05-18 / 2026-05-20予定",
        "url": "https://www.boj.or.jp/about/calendar/index.htm",
        "status": "確認済み。公表予定表に基づく。",
        "points": [
            "日本銀行の公表予定では、5月18日に業態別の日銀当座預金残高、5月20日に債券市場サーベイが掲載予定。",
            "債券市場サーベイは市場参加者の国債市場に対する見方を把握する資料で、長期金利や住宅ローン金利の観察材料になる。",
            "5月22日には日本銀行が保有する国債の銘柄別残高なども公表予定で、金融政策の出口を考える材料になる。",
            "学生生活には遠く見えるが、金利上昇は家賃、企業の資金調達、就職市場の空気にも波及し得る。",
        ],
    },
    {
        "section": "経済・物価",
        "source_key": "tbs_news_dig",
        "title": "食品パッケージから色が消える動き、ナフサ調達不安が背景に",
        "org": "TBS NEWS DIG",
        "date": "2026-05-15",
        "url": "https://newsdig.tbs.co.jp/articles/-/2664993?display=1",
        "status": "確認済み。政府説明と業界団体コメントを併記して読む。",
        "points": [
            "中東情勢の影響でインク原料のナフサ調達が不安定になり、食品パッケージの色数を減らす動きが報じられた。",
            "農水大臣は、供給不安に備えた企業判断との認識を示し、溶剤については平時と同様に必要量を供給できていると説明した。",
            "日本化学工業協会は、ナフサや原油価格がホルムズ海峡封鎖以前より高騰しているとし、価格転嫁もやむを得ないとの見方を示した。",
            "店頭価格だけでなく、包装、物流、販促デザインにも国際情勢が入り込む例として観察できる。",
        ],
    },
    {
        "section": "経済・物価",
        "source_key": "tbs_news_dig",
        "title": "大王製紙、家庭用・業務用全製品を15%以上値上げへ",
        "org": "TBS NEWS DIG",
        "date": "2026-05-15",
        "url": "https://newsdig.tbs.co.jp/articles/-/2664735?display=1",
        "status": "確認済み。発表内容を企業リリースで再確認するとより安全。",
        "points": [
            "大王製紙は、ティッシュペーパーやトイレットペーパーなど家庭用・業務用の全製品を値上げすると発表した。",
            "対象はエリエールブランドを含む家庭用・業務用製品で、8月1日納品分から現在価格より15%以上の値上げを行う。",
            "原材料や資材の調達価格、包装資材、パッケージ用インクの価格上昇が理由とされている。",
            "日用品の値上げは留学生の固定的な生活費に直結し、まとめ買い、PB商品、ドラッグストア価格の比較が必要になる。",
        ],
    },
    {
        "section": "経済・物価",
        "source_key": "tbs_news_dig",
        "title": "肥料価格、尿素で最大14.5%上昇",
        "org": "TBS NEWS DIG",
        "date": "2026-05-15",
        "url": "https://newsdig.tbs.co.jp/articles/-/2664399?display=1",
        "status": "確認済み。JA全農の発表値を追加確認するとより安全。",
        "points": [
            "JA全農が販売する肥料価格について、来月から10月にかけて販売する分の尿素が前期比14.5%値上がりする。",
            "尿素は日本がほぼ全量を輸入に頼る肥料で、中東情勢の緊迫化による市場価格上昇と円安傾向が影響したとされる。",
            "2022年以降で最大の上げ幅とされ、農家の生産コストや今後の食品価格に波及する可能性がある。",
            "食料品価格を読むときは、小売価格だけでなく肥料、燃料、輸送費の上流コストを見る必要がある。",
        ],
    },
    {
        "section": "経済・物価",
        "source_key": "tbs_news_dig",
        "title": "コメ平均価格、3700円台前半で3週連続下落",
        "org": "TBS NEWS DIG",
        "date": "2026-05-15",
        "url": "https://newsdig.tbs.co.jp/list/genre/%E7%B5%8C%E6%B8%88",
        "status": "要確認。見出し一覧ベースのため、本文と農水省データで確認が必要。",
        "points": [
            "TBSの経済ニュース一覧では、コメの平均価格が3700円台前半となり、3週連続で下落したと報じられている。",
            "見出しでは、民間在庫の高止まりが下落基調の背景として示されている。",
            "米価は自炊中心の学生にとって影響が大きく、短期の下落と長期の需給を分けて見る必要がある。",
            "正式利用前には農林水産省の米関連統計、スーパー店頭価格、地域差を追加確認する。",
        ],
    },
    {
        "section": "企業・消費",
        "source_key": "tbs_news_dig",
        "title": "3メガ銀行、2026年3月期の純利益が合計5兆円超",
        "org": "TBS NEWS DIG",
        "date": "2026-05-15",
        "url": "https://newsdig.tbs.co.jp/articles/-/2664932?display=1",
        "status": "確認済み。各社決算短信で最終確認するとより安全。",
        "points": [
            "三菱UFJ、三井住友、みずほの大手銀行3グループは、金利上昇を追い風に純利益がいずれも過去最高となった。",
            "三菱UFJは2兆4272億円、三井住友は1兆5830億円、みずほは1兆2486億円の純利益と報じられている。",
            "3社合計では5兆円を超え、金利上昇が銀行の利ざや改善につながっていることが分かる。",
            "一方で中東情勢の不確実性への警戒も示されており、金融業績と家計負担の両面を見る必要がある。",
        ],
    },
    {
        "section": "企業・消費",
        "source_key": "tbs_news_dig",
        "title": "日本郵政、郵便料金のさらなる値上げを検討",
        "org": "TBS NEWS DIG",
        "date": "2026-05-15",
        "url": "https://newsdig.tbs.co.jp/articles/-/2664627?display=1",
        "status": "確認済み。制度変更は総務省手続きも確認する。",
        "points": [
            "日本郵政グループは、日本郵便の郵便料金について、早ければ来年度中にもさらなる値上げを検討していると明らかにした。",
            "郵便・物流事業は通期で118億円の赤字となり、デジタル化による郵便数減少と人件費高騰が背景とされる。",
            "構造改革として、人口減少が進む地方で集配拠点を約500か所減らし、AI活用で約1万人の人員削減を目指すとしている。",
            "行政手続き、書類郵送、フリマ発送など、生活の細かいコストに影響する可能性がある。",
        ],
    },
    {
        "section": "企業・消費",
        "source_key": "tbs_news_dig",
        "title": "キオクシア、AI需要で最終利益5544億円",
        "org": "TBS NEWS DIG",
        "date": "2026-05-15",
        "url": "https://newsdig.tbs.co.jp/list/genre/%E7%B5%8C%E6%B8%88",
        "status": "要確認。見出し一覧ベースのため、決算資料で確認が必要。",
        "points": [
            "TBSの経済ニュース一覧では、キオクシアの最終利益が5544億円の黒字となり、AI向け半導体メモリー需要が背景とされている。",
            "AIデータセンター投資の拡大は、日本企業の半導体、電力、設備投資に影響する。",
            "就職活動の視点では、AIブームがIT企業だけでなく素材、部品、電力、物流にも広がる点が重要。",
            "正式な数字はキオクシアの決算資料または上場関連開示で再確認する。",
        ],
    },
    {
        "section": "政治・政策",
        "source_key": "tbs_news_dig",
        "title": "高市総理、19日から韓国訪問へ",
        "org": "TBS NEWS DIG",
        "date": "2026-05-17",
        "url": "https://newsdig.tbs.co.jp/articles/-/2666419?display=1",
        "status": "確認済み。首脳会談後の共同発表で内容確認が必要。",
        "points": [
            "韓国大統領府は、高市総理の5月19日からの訪韓について、国賓に準じた待遇で歓迎すると発表した。",
            "高市総理は1泊2日の日程で、シャトル外交の一環として李在明大統領と首脳会談を行う予定。",
            "会談場所では儀仗隊と音楽隊が出迎え、晩さん会や世界遺産の河回村訪問も予定されている。",
            "日韓関係は観光、留学、就職、地域経済に影響しやすく、会談後の経済・人的交流の言及を確認したい。",
        ],
    },
    {
        "section": "政治・政策",
        "source_key": "mhlw",
        "title": "厚労省、中東情勢を受けた医薬品等確保対策本部を開催",
        "org": "厚生労働省",
        "date": "2026-05-15",
        "url": "https://www.mhlw.go.jp/stf/houdou/houdou_list_202605.html",
        "status": "確認済み。会議資料の中身は別途確認が必要。",
        "points": [
            "厚生労働省は5月15日、第5回「中東情勢の影響を受ける医薬品、医療機器、医療物資等の確保対策本部」を報道発表資料に掲載した。",
            "中東情勢はエネルギー価格だけでなく、医薬品、医療機器、医療物資の調達にも影響する可能性がある。",
            "生活者目線では、薬局での在庫、医療費、災害時備蓄への意識につながる政策テーマ。",
            "公開資料の詳細を確認し、具体的な不足品目や対応策が示されているかを追跡する。",
        ],
    },
    {
        "section": "社会・生活",
        "source_key": "tbs_news_dig",
        "title": "擁壁崩落が各地で問題化、住宅地の安全点検に注目",
        "org": "TBS NEWS DIG / 毎日放送",
        "date": "2026-05-17",
        "url": "https://newsdig.tbs.co.jp/articles/-/2664569?display=1",
        "status": "確認済み。個別事例と全国傾向を分けて読む。",
        "points": [
            "高低差のある土地で土をせき止める擁壁の崩落が全国で相次いでいると報じられた。",
            "大阪府吹田市の住宅地では、擁壁が崩落し住宅の基礎が宙に浮いているように見えるトラブルが紹介された。",
            "大雨、老朽化、施工状態、所有者責任が絡むため、賃貸住宅や中古住宅を選ぶ際にも周辺地形の確認が重要になる。",
            "留学生が部屋を借りる場合でも、家賃や駅距離だけでなく、ハザードマップや斜面地の有無を確認したい。",
        ],
    },
    {
        "section": "社会・生活",
        "source_key": "tbs_news_dig",
        "title": "東京・奥多摩で登山中の男性がクマに襲われ重傷",
        "org": "TBS NEWS DIG",
        "date": "2026-05-17",
        "url": "https://newsdig.tbs.co.jp/articles/-/2666129?display=1",
        "status": "確認済み。警視庁・自治体発表で追加確認が望ましい。",
        "points": [
            "5月17日正午ごろ、東京・奥多摩町の六ツ石山で登山中のロシア国籍の30代男性がクマに襲われた。",
            "男性は腕や頭などをけがし、消防ヘリで病院に搬送されたが重傷と報じられている。",
            "奥多摩町は捕獲用の檻を設置し、警視庁と警戒にあたっている。",
            "都市部から近い山でも野生動物リスクがあり、登山時は熊鈴やラジオの携行、自治体情報の確認が必要。",
        ],
    },
    {
        "section": "社会・生活",
        "source_key": "tbs_news_dig",
        "title": "5月28日から防災気象情報の提供方法が変更へ",
        "org": "TBS NEWS DIG / 北海道放送",
        "date": "2026-05-14",
        "url": "https://newsdig.tbs.co.jp/articles/-/2661996?display=1",
        "status": "確認済み。気象庁資料で制度名と色分けを再確認する。",
        "points": [
            "5月28日から新たな防災気象情報、注意報・警報の提供が始まると報じられた。",
            "大雨や洪水時の逃げ遅れを防ぐため、色分けや警戒レベルの理解が重要になる。",
            "日本語の防災情報は表現が難しく、外国人住民や留学生には早めの確認が必要な分野。",
            "住んでいる自治体の防災アプリ、避難場所、警戒レベルの意味を一度整理しておくとよい。",
        ],
    },
    {
        "section": "社会・生活",
        "source_key": "tbs_news_dig",
        "title": "20日ごろから広い範囲で10年に1度程度の高温可能性",
        "org": "TBS NEWS DIG / チューリップテレビ",
        "date": "2026-05-15",
        "url": "https://newsdig.tbs.co.jp/articles/-/2662423?display=1",
        "status": "確認済み。気象庁の早期天候情報を併読する。",
        "points": [
            "気象庁は5月14日、高温に関する早期天候情報を発表した。",
            "5月20日ごろから28日ごろにかけて、北海道を除く各地方でこの時期としては10年に1度程度の著しい高温となる可能性がある。",
            "関東甲信以南では熱中症警戒アラートのおそれもあり、5月でも水分補給や冷房準備が必要になる。",
            "電気代、通学時の体調管理、食品の保存など、生活コストと健康管理の両方に関わるニュース。",
        ],
    },
    {
        "section": "教育・留学",
        "source_key": "moj_isa",
        "title": "外国人支援者向け在留資格セミナー、21日に開催予定",
        "org": "出入国在留管理庁",
        "date": "2026-05-21予定",
        "url": "https://www.moj.go.jp/isa/support/fresc/fresc01.html?hl=km",
        "status": "確認済み。対象者と参加方法は公式ページで要確認。",
        "points": [
            "外国人在留支援センターは、外国人支援者向けセミナー基礎編「支援に役立つ在留資格の基礎知識」を5月21日に開催予定としている。",
            "在留資格の基礎知識は、留学から就労への変更、資格外活動、更新手続きなどに関わる。",
            "留学生本人向けの直接イベントではない可能性があるが、支援者向け情報は制度変更を読む入口になる。",
            "参加対象、言語、資料公開の有無を確認し、留学生に使える情報があれば保存しておく。",
        ],
    },
    {
        "section": "雇用・賃金",
        "source_key": "livedoor_news",
        "title": "外食分野の特定技能、新規受け入れ停止で企業が苦慮",
        "org": "ライブドアニュース / 読売新聞系記事",
        "date": "2026-05-17",
        "url": "https://news.livedoor.com/article/detail/31293948/",
        "status": "要確認。一次情報として出入国在留管理庁の告知確認が必要。",
        "points": [
            "外食業で在留資格「特定技能1号」の新たな受け入れが4月13日から原則停止されたと報じられている。",
            "背景には、外食分野の受け入れ人数が上限に近づいたことがあるとされる。",
            "外食、介護、宿泊などは留学生のアルバイトや卒業後の就職先とも関係が深い。",
            "制度の停止は既に働いている人、更新、転職、新規入国で扱いが異なる可能性があるため、公式情報で確認する必要がある。",
        ],
    },
    {
        "section": "テクノロジー",
        "source_key": "tbs_news_dig",
        "title": "北九州で廃液からSAF原料を精製する実証実験",
        "org": "TBS NEWS DIG / RKB毎日放送",
        "date": "2026-05-16",
        "url": "https://newsdig.tbs.co.jp/articles/-/2665358?display=1",
        "status": "確認済み。実証実験の主体と期間を追加確認するとよい。",
        "points": [
            "北九州市の工場で、飲食店から出る廃液から次世代航空燃料SAFの原料を精製する実証実験が始まった。",
            "SAFは石油由来燃料に比べ、二酸化炭素排出を最大8割削減できるとされる。",
            "政府は2030年時点で国内航空会社の航空燃料の10%をSAFに置き換える目標を掲げている。",
            "飲食店の廃棄物がエネルギー資源になる例で、環境政策、航空運賃、地域産業の接点として見られる。",
        ],
    },
    {
        "section": "スポーツ",
        "source_key": "jfa",
        "title": "サッカー日本代表、W杯メンバー26人を発表",
        "org": "日本サッカー協会",
        "date": "2026-05-16",
        "url": "https://www.jfa.jp/samuraiblue/worldcup_2026/news/00036341/",
        "status": "確認済み。公式発表に基づく。",
        "points": [
            "日本サッカー協会は、FIFAワールドカップ2026に臨むSAMURAI BLUEのメンバー26人を発表した。",
            "遠藤航、冨安健洋、5大会連続選出の長友佑都、塩貝健人らが名を連ねた。",
            "日本は8大会連続8度目の出場で、グループステージではオランダ、チュニジア、スウェーデンと対戦する。",
            "スポーツイベントは飲食、テレビ視聴、広告、グッズ消費にも波及し、若者の話題としても強い。",
        ],
    },
    {
        "section": "スポーツ",
        "source_key": "npb",
        "title": "プロ野球、18日は試合なし、19日から各地で公式戦",
        "org": "スポーツナビ / NPB",
        "date": "2026-05-18 / 2026-05-19予定",
        "url": "https://baseball.yahoo.co.jp/npb/schedule/first/all?date=2026-05-18",
        "status": "確認済み。試合日程は変更の可能性がある。",
        "points": [
            "スポーツナビの日程では、5月18日のプロ野球公式戦は試合なしと表示されている。",
            "5月19日にはヤクルト対巨人、阪神対中日、広島対DeNA、日本ハム対楽天などが18時開始予定。",
            "地方球場や地方開催もあり、スポーツ興行は地域消費や交通需要にも関係する。",
            "試合日程は天候や運営事情で変更される可能性があるため、観戦前には公式情報を確認する。",
        ],
    },
    {
        "section": "文化・エンタメ",
        "source_key": "tbs_news_dig",
        "title": "マクドナルド、ちいかわハッピーセットに購入制限を導入",
        "org": "TBS NEWS DIG",
        "date": "2026-05-15",
        "url": "https://newsdig.tbs.co.jp/list/genre/%E7%B5%8C%E6%B8%88",
        "status": "要確認。見出し一覧ベースのため、本文確認が必要。",
        "points": [
            "TBSの経済ニュース一覧では、マクドナルドがちいかわハッピーセット発売にあたり、4個の数量制限と購入券制度を導入したと報じられている。",
            "昨年の転売問題を受けた対応とされ、人気キャラクター商品で販売方法が変わる例になる。",
            "キャラクター消費は若者文化だけでなく、転売対策、在庫管理、店舗オペレーションの問題でもある。",
            "正式利用前には日本マクドナルドの告知や販売条件を確認する。",
        ],
    },
]


VOCAB = [
    ("四半期別GDP速報", "しはんきべつジーディーピーそくほう", "推定N1", "一定期間の国内総生産を早く示す統計。"),
    ("公表予定", "こうひょうよてい", "N2", "広く発表される予定。"),
    ("消費者物価指数", "しょうひしゃぶっかしすう", "推定N2", "消費者が買う商品やサービスの価格動向を示す指数。"),
    ("小売物価", "こうりぶっか", "推定N2", "店頭で消費者に販売される商品の価格。"),
    ("債券市場", "さいけんしじょう", "推定N2", "国債や社債などが取引される市場。"),
    ("長期金利", "ちょうききんり", "推定N2", "期間の長い資金にかかる金利。"),
    ("波及", "はきゅう", "N1", "影響が次第に広がること。"),
    ("調達", "ちょうたつ", "N1", "必要な物や資金を集めること。"),
    ("高騰", "こうとう", "N1", "価格などが急に大きく上がること。"),
    ("価格転嫁", "かかくてんか", "推定N1", "上がったコストを販売価格に反映すること。"),
    ("納品分", "のうひんぶん", "推定N2", "納められる商品の分。"),
    ("原材料", "げんざいりょう", "N2", "製品を作るもとになる材料。"),
    ("肥料", "ひりょう", "N2", "農作物を育てるため土などに与えるもの。"),
    ("尿素", "にょうそ", "推定N1", "肥料や化学製品に使われる物質。"),
    ("在庫", "ざいこ", "N2", "保管されている商品や材料。"),
    ("利ざや", "りざや", "推定N1", "貸出金利と調達金利などの差から生じる利益。"),
    ("純利益", "じゅんりえき", "推定N2", "最終的に残る利益。"),
    ("構造改革", "こうぞうかいかく", "N1", "仕組みそのものを変える改革。"),
    ("集配拠点", "しゅうはいきょてん", "推定N1", "郵便物などを集め配るための拠点。"),
    ("首脳会談", "しゅのうかいだん", "N2", "国の代表者同士の会談。"),
    ("国賓", "こくひん", "N1", "国が公式に迎える重要な客。"),
    ("医療物資", "いりょうぶっし", "推定N2", "医療に必要な物資。"),
    ("確保対策", "かくほたいさく", "推定N2", "必要量を保つための対策。"),
    ("擁壁", "ようへき", "推定N1", "土が崩れないように支える壁。"),
    ("崩落", "ほうらく", "N1", "崩れて落ちること。"),
    ("老朽化", "ろうきゅうか", "N2", "古くなって機能が低下すること。"),
    ("警戒", "けいかい", "N2", "危険に備えて注意すること。"),
    ("早期天候情報", "そうきてんこうじょうほう", "推定N1", "通常より早く注意を促す気象情報。"),
    ("著しい", "いちじるしい", "N2", "程度がはっきり大きい。"),
    ("在留資格", "ざいりゅうしかく", "推定N2", "外国人が日本に滞在するための資格。"),
    ("資格外活動", "しかくがいかつどう", "推定N1", "在留資格で認められた範囲外の活動。"),
    ("特定技能", "とくていぎのう", "推定N1", "一定の技能を持つ外国人向けの在留資格。"),
    ("受け入れ停止", "うけいれていし", "推定N2", "新たに受け入れることを止めること。"),
    ("実証実験", "じっしょうじっけん", "N1", "実際の条件で有効性を確かめる試験。"),
    ("持続可能", "じぞくかのう", "N2", "長く続けることができる。"),
    ("脱炭素化", "だつたんそか", "推定N1", "二酸化炭素の排出を減らす方向に変えること。"),
    ("選出", "せんしゅつ", "N2", "選んで出すこと。"),
    ("興行", "こうぎょう", "N1", "観客を集めて行う催しや事業。"),
    ("転売対策", "てんばいたいさく", "推定N2", "買い占めて高く売る行為を防ぐ対策。"),
    ("数量制限", "すうりょうせいげん", "推定N2", "買える数を制限すること。"),
]


TOP5 = [
    ("大王製紙、家庭用・業務用全製品を15%以上値上げへ", "日用品価格に直接つながるため。"),
    ("肥料価格、尿素で最大14.5%上昇", "食品価格の上流コストを示すため。"),
    ("1-3月期GDP一次速報、19日8時50分に公表予定", "今週の景気判断の基礎になるため。"),
    ("外食分野の特定技能、新規受け入れ停止で企業が苦慮", "外国人雇用と留学生の進路に関係するため。"),
    ("20日ごろから広い範囲で10年に1度程度の高温可能性", "通学、健康管理、電気代に影響するため。"),
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
        "- GDPとCPIは現時点では公表予定であり、結果として扱わない。",
        "- コメ価格、キオクシア決算、ちいかわハッピーセットは見出し一覧ベースのため、本文または一次資料で再確認する。",
        "- 特定技能の外食分野停止は、報道だけでなく出入国在留管理庁の告知で制度対象を確認する。",
        "- 日用品、肥料、郵便料金の値上げは、企業発表・行政手続き・適用開始日を再確認する。",
        "- 気象、防災、登山関連は気象庁、自治体、警察・消防発表を併読する。",
    ]
    (OUT / "news_japanese.md").write_text("\n".join(lines), encoding="utf-8")

    source_lines = [f"# {DAY} source_manifest", ""]
    fact_lines = [f"# {DAY} 確認メモ", ""]
    for idx, item in enumerate(NEWS, 1):
        source_lines += [
            f"## {idx}. {item['title']}",
            "",
            f"- 板块：{item['section']}",
            f"- 机构：{item['org']}",
            f"- 日期：{item['date']}",
            f"- URL：{item['url']}",
            f"- 关键事实摘要：{'; '.join(item['points'])}",
            f"- 核实状态：{item['status']}",
            "",
        ]
    (OUT / "source_manifest.md").write_text("\n".join(source_lines), encoding="utf-8")
    (OUT / "fact_check.md").write_text(
        "\n".join(
            fact_lines
            + [
                "- GDP、CPI、日銀予定は公式ページの公表時刻と最新更新日を確認する。",
                "- TBS/JNN由来の企業・生活ニュースは、可能な限り企業リリースや行政資料で二重確認する。",
                "- 見出し一覧のみで採用した項目は、公開本文が読めるまで「要確認」とする。",
                "- 外国人雇用・在留資格関連は、出入国在留管理庁の一次資料を最優先する。",
                "- スポーツ日程は公式サイトで当日変更を確認する。",
            ]
        ),
        encoding="utf-8",
    )

    for item in NEWS:
        path = SOURCES_DIR / f"{item['source_key']}.md"
        entry = dedent(
            f"""

            ## {DAY}

            - 原文タイトル：{item['title']}
            - 板块：{item['section']}
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
    row = f"| {DAY} | {len(NEWS)} | 大王製紙値上げ；肥料価格；GDP公表予定；特定技能；高温情報 | content_archive/{DAY}/daily_japanese_news.pdf | content_archive/{DAY}/ | 板块別20条・日本語版 |"
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

    first_half = NEWS[:10]
    second_half = NEWS[10:]
    for page_items, label in ((first_half, "ニュース摘録（1-10）"), (second_half, "ニュース摘録（11-20）")):
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
