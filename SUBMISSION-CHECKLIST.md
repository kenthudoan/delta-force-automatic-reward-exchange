# Chrome Web Store Submission Checklist — Auto Redeem Code DF v1.2.1

## 1. Package — Upload ZIP
- File: `auto-redeem-code-delta-force-1.2.1.zip` (~57 KB, 16 files)
- Status: ✓ validated (manifest JSON OK, locale JSON OK, forward-slash entries, no __MACOSX)

## 2. Store listing — Tiếng Việt (mặc định)

### Tên trong gói
```
Auto Redeem Code Delta Force - Đổi Code Garena Tự Động
```

### Thông tin tóm tắt trong gói (Summary — 132 chars max)
```
Tự động đổi code Delta Force. Delay riêng từng code, lưu lịch sử, xuất CSV, QR Techcombank. Offline, không gửi dữ liệu.
```
Đếm: **119 chars** ✓

### Mô tả (Description — 16000 chars max)
Mở file `store-listing.md`, copy phần từ `## Auto Redeem Code ...` đến hết (bỏ header dòng đầu).
Đếm: **~4.7 KB** ✓

### Danh mục
```
Tiện ích (Productivity)
```

## 3. Icon (Biểu tượng cửa hàng)
- File: `tests/store-small.png` nếu muốn tile riêng, nhưng icon chính là **`extension/icons/icon-128.png`** (đã có trong manifest).
- Kích thước: **128 × 128 PNG**, không alpha
- File: `extension/icons/icon-128.png` (6.9 KB) ✓

## 4. Ảnh chụp màn hình (Screenshots — cần ≥1, max 5)
Ảnh **1280×800 PNG**, 24-bit, không alpha. Đã tạo sẵn:

| # | File | Nội dung |
|---|------|----------|
| 1 | `tests/store-1-redeem-input.png` | Popup + 5 code đã dán, delay 3,5s |
| 2 | `tests/store-2-redeem-running.png` | Đang chạy 3/5 code, progress + stats + log |
| 3 | `tests/store-3-history.png` | Tab Lịch sử với 3 job gần nhất |
| 4 | `tests/store-4-donate.png` | Tab Ủng hộ với QR Techcombank 397983 |
| 5 | `tests/store-5-donate-amount.png` | QR có số tiền 50.000đ (dynamic) |

**Upload theo thứ tự 1 → 5** để story tự nhiên: nhập code → chạy → xem lịch sử → ủng hộ.

## 5. Tài sản hiển thị ở mọi ngôn ngữ (Optional)

### Ô quảng cáo nhỏ (Small tile)
- File: `tests/store-small.png` (440×280 PNG, 84 KB) ✓

### Ô quảng cáo marquee (Marquee tile)
- File: `tests/store-marquee.png` (1400×560 PNG, 322 KB) ✓

## 6. Các trường bổ sung

### URL trang chủ (Homepage URL)
```
https://github.com/<user>/delta-force-automatic-reward-exchange
```
*(Sửa user thật của bạn. Nếu chưa có repo public, có thể để trống — không bắt buộc)*

### URL hỗ trợ (Support URL)
```
https://github.com/<user>/delta-force-automatic-reward-exchange/issues
```
*(Cùng chỗ với homepage, trỏ vào tab Issues)*

### Nội dung người lớn (Adult content)
```
Không (No)
```

### Hỗ trợ về mục (Item support)
```
Bật (Enabled) — để người dùng liên hệ khi cần
```

## 7. Quyền riêng tư (Privacy)

Chrome Web Store yêu cầu khai báo **single purpose** và **permission justification**. Đã chuẩn trong manifest:
- `storage`: lưu lịch sử job + cài đặt delay (Chrome local, không sync)
- `host_permissions: ["https://redeem.df.garena.sg/*"]`: cần để inject content script tương tác form đổi quà

Khi Chrome hỏi, bạn xác nhận:
- Single purpose: "Tự động đổi hàng loạt code Delta Force trên trang redeem.df.garena.sg"
- Không thu thập dữ liệu cá nhân
- Không dùng cho mục đích quảng cáo

## 8. Bước submit
1. Vào https://chrome.google.com/webstore/devconsole/
2. Click vào item `bflkabakmcafnnlbmnifpdpolponabkn` (đang ở Bản nháp)
3. Tab **Package** → Upload `auto-redeem-code-delta-force-1.2.1.zip` → Save
4. Tab **Store listing** → copy-paste các trường ở mục 2
5. Tab **Store listing** → mục Graphic assets → upload 5 screenshots (mục 4) + icon (mục 3) + tiles (mục 5)
6. Tab **Privacy** → xác nhận "Single purpose" + "Permission justification" (mục 7)
7. Tab **Distribution** → để mặc định "Public"
8. Click **Submit for review** ở góc phải

## Lưu ý
- Lần đầu publish extension mới thường mất **1-3 ngày** review.
- Nếu bị reject, Chrome sẽ gửi email lý do cụ thể — fix rồi submit lại.
- File ZIP đã đạt chuẩn technical: 16 files, forward-slash, manifest MV3, no junk.
