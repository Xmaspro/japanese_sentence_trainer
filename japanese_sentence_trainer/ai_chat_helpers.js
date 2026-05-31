(function (root, factory) {
  const helpers = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = helpers;
  }
  root.JapaneseSentenceTrainerAiChat = helpers;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const correctiveMarkers = [
    "不自然",
    "不太",
    "有点",
    "不够",
    "不合适",
    "听起来",
    "更自然",
    "建议",
    "可以改",
    "应该",
    "请用",
    "最好",
    "礼貌",
    "敬语",
    "错误",
    "纠错",
    "改成",
    "换成",
    "说法是",
    "会显得",
    "直接",
  ];

  function isCorrectiveAiFeedback(feedback) {
    const text = String(feedback || "").trim();
    if (!text) return false;
    return correctiveMarkers.some((marker) => text.includes(marker));
  }

  function isAiChatReplyAccepted(aiReply) {
    const acceptedValue = aiReply?.accepted;
    const explicitlyAccepted = acceptedValue === true || String(acceptedValue).toLowerCase() === "true";
    return explicitlyAccepted && !isCorrectiveAiFeedback(aiReply?.feedback);
  }

  function buildAcceptedAiHistoryPayload(history) {
    return (history || [])
      .filter((msg) => msg.accepted !== false)
      .map((msg) => ({
        role: msg.role,
        text: msg.ja,
      }));
  }

  return {
    isCorrectiveAiFeedback,
    isAiChatReplyAccepted,
    buildAcceptedAiHistoryPayload,
  };
});
