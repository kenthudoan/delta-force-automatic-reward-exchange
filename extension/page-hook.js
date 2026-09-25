/*
 * Chạy trong "MAIN world" của trang redeem.df.garena.sg, trước mọi script của trang.
 *
 * Việc DUY NHẤT: khi chính trang gửi request đổi code (RedeemCDKey), báo cho content.js
 * biết request đã được gửi và mã kết quả (code/msg) mà máy chủ Garena trả về, qua một
 * sự kiện DOM. Nhờ vậy nhật ký biết chính xác "đã dùng", "hết hạn", "không hợp lệ"...
 *
 * - Không tự gửi request nào, không sửa request hay phản hồi của trang.
 * - Không đọc cookie. URL của request có chứa openid/token đăng nhập nên chỉ lấy
 *   đúng tham số "cdkey"; phần còn lại không được đọc hay chuyển đi đâu.
 */
(() => {
  'use strict';

  const TARGET_PATH = '/CdkV2/RedeemCDKey';
  const EVENT_NAME = 'dfr:redeem-result';
  const PING_EVENT = 'dfr:hook-ping';
  const watched = new WeakMap(); // XMLHttpRequest -> cdkey

  const emit = (detail) => {
    document.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: JSON.stringify(detail) }));
  };

  // content.js hỏi "bộ đọc kết quả có hoạt động không?" (trả lời ngay, đồng bộ).
  document.addEventListener(PING_EVENT, () => emit({ phase: 'ready' }));

  const proto = XMLHttpRequest.prototype;
  const nativeOpen = proto.open;
  const nativeSend = proto.send;

  proto.open = function (_method, url) {
    watched.delete(this);
    try {
      const parsed = new URL(String(url), location.href);
      if (parsed.pathname.endsWith(TARGET_PATH)) {
        watched.set(this, parsed.searchParams.get('cdkey') || '');
      }
    } catch (_) {
      // URL lạ: bỏ qua, để trang chạy bình thường.
    }
    return nativeOpen.apply(this, arguments);
  };

  proto.send = function () {
    if (watched.has(this)) {
      const cdkey = watched.get(this);
      this.addEventListener('loadend', () => {
        let body = null;
        try {
          body = this.responseType === 'json' ? this.response : JSON.parse(this.responseText);
        } catch (_) {
          // Không phải JSON (lỗi mạng, bị chặn...): code = null.
        }
        const rawCode = body && body.code;
        emit({
          phase: 'done',
          cdkey,
          httpStatus: this.status,
          code: rawCode !== null && rawCode !== undefined && rawCode !== '' && Number.isFinite(Number(rawCode))
            ? Number(rawCode)
            : null,
          msg: body && typeof body.msg === 'string' ? body.msg.slice(0, 200) : '',
        });
      }, { once: true });
      emit({ phase: 'sent', cdkey });
    }
    return nativeSend.apply(this, arguments);
  };
})();
