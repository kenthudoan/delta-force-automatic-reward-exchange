# Đổi Code Delta Force

> Chrome extension tự động đổi hàng loạt code Delta Force trên trang đổi quà Garena.
> Chạy hoàn toàn trên máy bạn — không gửi dữ liệu đi đâu.

[![Version](https://img.shields.io/badge/version-1.2.1-blue.svg)]()
[![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest%20V3-green.svg)]()
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Offline](https://img.shields.io/badge/network-offline-success.svg)]()

## Tính năng

- ⚡ **Đổi hàng loạt** — đổi nhiều code một lúc, không cần canh tay.
- 🎯 **Phát hiện ký tự giả mạo** — tự phát hiện chữ Nga / Hy Lạp trông giống chữ Latin
  (hay gặp khi copy code từ mạng xã hội), gợi ý bản sửa trước khi gửi.
- ⏱️ **Delay thông minh** — chỉnh delay mặc định cho cả danh sách, hoặc chỉnh riêng
  từng code bằng cú pháp `CODE=GIÂY`.
- 📊 **Nhật ký trực tiếp** — biết ngay code nào thành công, code nào đã đổi, code nào lỗi.
- 💾 **Lưu lịch sử** — xem lại 30 job gần nhất, xuất CSV để phân tích.
- 📤 **Import file / Export CSV** — nạp code từ `.txt`/`.csv`, xuất kết quả ra file.
- 💰 **Ủng hộ tác giả** — QR Techcombank ngay trong popup, 100% offline.
- 🌓 **Light / Dark mode** — theo hệ thống hoặc tự chọn.
- 🔒 **An toàn** — CSP khắt khe, không gọi API ngoài, không đọc cookie, không gửi
  bất kỳ dữ liệu nào ra ngoài máy bạn.

## Cài đặt (Chrome / Cốc Cốc / Edge)

1. Mở `chrome://extensions` (Cốc Cốc: `coccoc://extensions`, Edge: `edge://extensions`).
2. Bật **Chế độ dành cho nhà phát triển** (Developer mode).
3. Bấm **Tải tiện ích đã giải nén** (Load unpacked) và chọn thư mục `extension/`.
4. Ghim biểu tượng extension lên thanh công cụ.

> Lưu ý: extension không có trên Chrome Web Store — chỉ tải thủ công từ repo này.
> Đây là phần mềm tự do, bạn có toàn quyền xem mã nguồn và đóng góp.

## Sử dụng

1. Mở <https://redeem.df.garena.sg/vi/cdkgarena.html> và đăng nhập Garena.
2. Bấm biểu tượng extension, dán danh sách code vào ô nhập.
3. Chọn thời gian chờ mặc định (khuyến nghị **3 giây**).
4. Bấm **Bắt đầu** (hoặc nhấn `Ctrl + Enter`).
5. Theo dõi nhật ký. Có thể đóng popup, nhưng giữ tab đổi quà mở tới khi xong.

### Định dạng danh sách code

Mọi ký tự không phải chữ/số/`_`/`-` đều là dấu phân cách, nên bạn có thể dán:

```
DFREWARD2026
DFREWARD2026, DFGIFT666; DFPRO-2026
DFREWARD2026 | DFGIFT666
DFREWARD2026 / DFGIFT666 / DFPRO-2026
🎁DFREWARD2026🍕DFGIFT666
```

### Delay riêng cho từng code

Mỗi dòng có thể chỉ định delay riêng (giây), khoảng hợp lệ `0,5 – 60`:

```
DFREWARD=5
DFGIFT=2.5
DFPRO-2026         ← dùng delay mặc định (slider)
DELTA-VIP=10
```

Code có delay ngoài khoảng sẽ được giữ lại và dùng delay mặc định.

### Các nút khác

- **Tạm dừng / Tiếp tục** — dừng giữa chừng và chạy tiếp từ code đang dở.
- **Thử lại code lỗi** — chạy lại các code bị lỗi (network / lỗi server).
- **Sao chép / Tải CSV** — copy kết quả hoặc tải file CSV (UTF-8 BOM, Excel mở đúng TV).
- **Làm mới** — bấm 2 lần để xoá tiến trình (đã có confirm qua shake animation).
- **Lịch sử** — xem 30 job gần nhất, tải CSV hoặc nạp lại code lỗi.

## Xử lý sự cố

| Tình huống | Cách xử lý |
|---|---|
| Trang bị tải lại / hết phiên | Extension tự tạm dừng. Đăng nhập lại → bấm **Tiếp tục**. |
| "Trang chưa kết nối" | Tải lại trang đổi quà (`F5`). |
| Lỗi mạng nhiều lần | Extension tự tạm dừng sau 5 lần lỗi liên tiếp. Chờ vài phút → **Tiếp tục**. |
| Không nhận ra giao diện trang | Garena có thể đã đổi DOM. Báo lỗi tại <https://github.com/kenthudoan/delta-force-automatic-reward-exchange/issues>. |
| Code lỗi sau khi đổi | Mở tab **Lịch sử** → bấm **Thử lại** bên job đó. |

## Quyền hạn

Extension chỉ xin 2 quyền:

- **`storage`** — lưu cài đặt, lịch sử, tiến trình trên máy bạn.
- **`host_permissions: https://redeem.df.garena.sg/*`** — chỉ chạy content script trên
  trang đổi quà chính thức của Garena.

Extension **không** xin quyền `<all_urls>`, không đọc cookie, không gửi request ra
ngoài. Mọi thao tác mô phỏng click người dùng, không bypass API.

## Bảo mật & quyền riêng tư

- Mọi xử lý diễn ra trong trình duyệt của bạn. Không có server trung gian.
- Content Security Policy: `script-src 'self'; connect-src 'none'` — không tải script
  từ CDN, không gọi API ngoài.
- QR Donate tạo offline bằng thư viện nhúng sẵn (`qrcode-generator` của Kazuhiko Arase, MIT).
- Không thu thập, lưu trữ, hay truyền tải bất kỳ dữ liệu cá nhân nào.

Chi tiết: xem file [`PRIVACY.md`](PRIVACY.md).

## Đóng góp

Báo lỗi, góp ý, hoặc gửi Pull Request tại <https://github.com/kenthudoan/delta-force-automatic-reward-exchange/issues>.

Khi báo lỗi, vui lòng kèm:
- Phiên bản Chrome (`chrome://version`).
- Ảnh chụp màn hình trang đổi quà (nếu liên quan tới giao diện).
- Nhật ký lỗi trong popup (nếu có).

## Giấy phép

Mã nguồn extension: [MIT](LICENSE).

Thư viện bên thứ ba:
- [`qrcode-generator`](https://github.com/kazuhikoarase/qrcode-generator) của Kazuhiko Arase — MIT.
- `qrcode_UTF8.js` — MIT (cùng tác giả).

## Tác giả

Tự viết bởi fan Delta Force. Nếu extension giúp ích, một ly cà phê sẽ là động lực lớn — bấm tab **Ủng hộ** trong popup để quét QR Techcombank.
