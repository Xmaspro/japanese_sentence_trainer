/**
 * Phase 1 typical life scenes — aligned with daily_routine.md S01〜S09.
 * Used for one-click scene selection and JDD retrieval hints.
 */

const SCENE_PRESETS = [
  {
    id: "S01",
    label: "起床・晨间",
    icon: "🌅",
    description: "早上起床、看窗外天气、洗漱、准备出门、今天有什么安排",
    keywords: ["おはよう", "朝", "起床", "天気", "眠い", "シャワー", "準備"],
    topicIds: [1],
    jddHints: ["morning", "weather", "breakfast"],
  },
  {
    id: "S02",
    label: "通勤・通学",
    icon: "🚇",
    description: "在车站等车、上车、看站名、换乘、电车晚点",
    keywords: ["電車", "駅", "通勤", "通学", "乗り換え", "遅れ", "混んで"],
    topicIds: [1, 3],
    jddHints: ["train", "station", "commute"],
  },
  {
    id: "S03",
    label: "便利店",
    icon: "🏪",
    description: "在便利店选商品、结账、要袋子、加热便当、问价格",
    keywords: ["コンビニ", "レジ", "袋", "お弁当", "温め", "払", "ください"],
    topicIds: [1],
    jddHints: ["convenience", "checkout", "bento"],
  },
  {
    id: "S04",
    label: "点餐・外食",
    icon: "🍱",
    description: "进餐厅看菜单、点单、等餐、评价味道、结账打包",
    keywords: ["レストラン", "ランチ", "注文", "メニュー", "食べ", "おいしい", "会計"],
    topicIds: [1],
    jddHints: ["lunch", "restaurant", "order"],
  },
  {
    id: "S05",
    label: "寒暄・闲聊",
    icon: "💬",
    description: "电梯里碰面、好久不见、聊最近怎样、天气和周末计划",
    keywords: ["久しぶり", "元気", "最近", "天気", "週末", "お疲れ"],
    topicIds: [1, 5],
    jddHints: ["greeting", "smalltalk"],
  },
  {
    id: "S06",
    label: "电话・预约",
    icon: "📞",
    description: "打电话给店或医院、说明来意、约时间、改期",
    keywords: ["電話", "予約", "お願い", "時間", "変更", "かけ直"],
    topicIds: [1, 3, 4],
    jddHints: ["phone", "reservation"],
  },
  {
    id: "S07",
    label: "家居・房间",
    icon: "🏠",
    description: "在家做饭、打扫、设备坏了、联系房东、垃圾分类",
    keywords: ["掃除", "料理", "洗濯", "壊れ", "ゴミ", "部屋", "蛇口"],
    topicIds: [1],
    jddHints: ["home", "cooking", "cleaning"],
  },
  {
    id: "S08",
    label: "天气・出行",
    icon: "🌤️",
    description: "看天气预报、下雨带伞、太热取消户外、改室内计划",
    keywords: ["天気", "雨", "傘", "暑", "寒", "台風", "予定"],
    topicIds: [1],
    jddHints: ["weather", "plan"],
  },
  {
    id: "S09",
    label: "晚间・回顾",
    icon: "🌙",
    description: "睡前回顾今天、累、明天准备、简单反省",
    keywords: ["おやすみ", "今日", "一日", "疲れ", "明日", "振り返"],
    topicIds: [1],
    jddHints: ["evening", "review", "tired"],
  },
];

function getScenePreset(presetId) {
  const id = String(presetId || "").trim();
  return SCENE_PRESETS.find((item) => item.id === id) || null;
}

function listScenePresets() {
  return SCENE_PRESETS.map((item) => ({
    id: item.id,
    label: item.label,
    icon: item.icon,
    description: item.description,
  }));
}

function resolveSceneInput(options = {}) {
  const presetId = String(options.presetId || "").trim();
  const customDescription = String(options.sceneDescription || options.description || "").trim();

  if (presetId) {
    const preset = getScenePreset(presetId);
    if (!preset) {
      throw new Error(`未知典型场景：${presetId}`);
    }
    return {
      presetId: preset.id,
      label: preset.label,
      sceneDescription: customDescription || preset.description,
      keywords: preset.keywords,
      topicIds: preset.topicIds,
      source: "preset",
    };
  }

  if (!customDescription) {
    throw new Error("请选择一个典型场景，或输入自定义场景说明。");
  }

  return {
    presetId: "",
    label: "自定义场景",
    sceneDescription: customDescription,
    keywords: [],
    topicIds: [1, 2, 3, 4, 5],
    source: "custom",
  };
}

module.exports = {
  SCENE_PRESETS,
  getScenePreset,
  listScenePresets,
  resolveSceneInput,
};