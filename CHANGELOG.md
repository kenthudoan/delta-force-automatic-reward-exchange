# Lịch sử thay đổi

Mọi thay đổi đáng chú ý của extension sẽ được ghi tại đây.
Format theo [Keep a Changelog](https://keepachangelog.com/vi-VN/1.1.0/),
phiên bản theo [Semantic Versioning](https://semver.org/lang/vi/).

## [1.2.1] — 2026-09-25

### Sửa lỗi
- **QR ủng hộ không quét được trên app ngân hàng**: chuỗi TLV VietQR nay khớp 100% chuẩn NAPAS
  (sub-tag `02 = QRIBFTTA` cho Techcombank, cấu trúc 3-cấp nested, `Tag 01 = 12` cho QR có amount,
  `Tag 62.08` cho nội dung CK). QR sinh ra giờ đọc được bởi Techcombank, MBBank, MoMo, Vietcombank,
  ZaloPay và các app hỗ trợ VietQR khác.
- Tăng kích thước QR lên 200px + quiet zone 4 modules để camera quét ổn định hơn.

### Dọn dẹp
- Bỏ select gợi ý số tiền trên tab Ủng hộ, trở về một ô input duy nhất cho đồng bộ layout.

## [1.2.0] — 2026-09-25

### Thêm mới
- **Delay riêng từng code**: cú pháp `CODE=GIÂY` trong ô nhập (vd: `DFREWARD=5`).
  Khoảng hợp lệ 0,5–60 giây. Code có delay ngoài khoảng sẽ giữ lại và dùng delay mặc định.
- **Ước tính thời gian chính xác**: popup tính tổng thời gian dựa trên delay thực tế
  của từng code (kể cả khi có delay riêng).
- **Thanh kéo delay mở rộng**: tối thiểu 1,5 giây (mặc định 3 giây), tối đa 10 giây.
  Trước đây tối thiểu là 3 giây.
- **Tab Lịch sử**: lưu 30 job gần nhất, có thể tải CSV hoặc đưa code lỗi về ô nhập để chạy lại.
- **Tab Ủng hộ**: QR Techcombank 397983 (chuẩn VietQR NAPAS), nhập số tiền tuỳ ý,
  QR tự cập nhật live. 100% offline.
- **Tải CSV**: xuất kết quả ra file `.csv` (UTF-8 BOM, mở đúng bằng Excel).
- **Nhập từ file**: nạp code từ `.txt` hoặc `.csv`.
- **Nạp code mẫu / Xoá ô nhập**: tiện ích debug/test nhanh.

### Cải thiện
- Giao diện rộng hơn: 380px → 440px.
- Bộ design token đầy đủ (spacing, radius, type scale, color).
- Dark mode chỉn chu hơn.
- Animation mượt (fade-in, slide-in, shimmer, shake).
- Stats pills có dot indicator màu, hover lift.
- Log area có scrollbar tinh tế hơn.
- Footer có border-top, tách bạch hơn.
- Shortcut `Ctrl/Cmd + Enter` để bắt đầu nhanh.
- ESC để tắt flash message.

### Sửa lỗi
- Không còn (chưa phát hiện regression với phiên bản 1.1.0).

### Bảo mật
- Không thay đổi CSP.
- QR generator nhúng sẵn trong extension, không phụ thuộc CDN.

## [1.1.0] — trước 2026-09-25

- Phiên bản đầu: đổi code hàng loạt, phát hiện ký tự Nga/Hy Lạp, retry lỗi mạng,
  pause/resume, lưu tiến trình qua reload trang.

[1.2.0]: #120--2026-09-25
[1.1.0]: #110--truoc-2026-09-25
