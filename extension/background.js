/*
 * Service worker tối giản, chỉ làm 2 việc cho content.js:
 * 1. Đếm giờ chờ giữa các code. Chrome làm chậm setTimeout của tab chạy nền
 *    (có khi chỉ chạy 1 lần/phút), còn service worker thì không bị.
 * 2. Cho content.js biết nó đang ở tab nào, để nhận ra khi trang bị tải lại.
 * Không truy cập mạng, không đọc dữ liệu trang.
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || sender.id !== chrome.runtime.id || !sender.tab) return undefined;

  if (msg.type === 'dfr:sleep') {
    const ms = Math.min(Math.max(Number(msg.ms) || 0, 0), 30000);
    setTimeout(() => sendResponse({ ok: true }), ms);
    return true; // giữ kênh trả lời mở cho tới khi hết giờ
  }

  if (msg.type === 'dfr:whoami') {
    sendResponse({ tabId: sender.tab.id });
  }
  return undefined;
});
