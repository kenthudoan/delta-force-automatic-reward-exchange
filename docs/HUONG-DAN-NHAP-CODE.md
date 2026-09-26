# 🎁 Hướng dẫn nhập code Delta Force từ A–Z (dành cho người mới)

> **Đọc xong bài này, bạn sẽ:**
> - Biết cách mở trang nhập code Garena trên **Chrome**
> - Nhập **hàng trăm code** cùng lúc thay vì gõ tay từng cái
> - Tự xử lý khi code báo lỗi mà không cần hỏi ai

---

## 1. Delta Force là gì, code ở đâu ra?

**Delta Force** là game bắn súng miễn phí của Garena. Để tặng thưởng người chơi mới hoặc mùa lễ, Garena phát hàng trăm **code đổi quà** (redeem code). Mỗi code chỉ dùng được **1 lần / 1 tài khoản**.

### Các nguồn code phổ biến
| Nguồn | Đặc điểm |
|---|---|
| Fanpage Facebook Delta Force VN | Code mỗi tuần, số lượng lớn |
| Streamer / YouTuber hợp tác | Code riêng của kênh |
| Sự kiện trong game | Vào mail trong game là có |
| Group Discord | Chia sẻ nhanh trong vài phút |

---

## 2. Trang nhập code chính thức

Mở Chrome, truy cập:

```
https://event.dff.garena.vn/redeem
```

Yêu cầu:
- ✅ Tài khoản Garena đã đăng nhập
- ✅ Đã chơi Delta Force ít nhất 1 trận (tạo nhân vật)
- ✅ Mạng ổn định (wifi hoặc 4G)

Sau khi đăng nhập, bạn sẽ thấy:
- **Ô trắng lớn** để paste danh sách code
- **Nút "Đổi"** (màu xanh/vàng tuỳ event)

> ⚠️ **Lưu ý quan trọng:** Trang này **không có nút "Đổi tất cả"**. Mỗi code phải bấm riêng. Nếu paste 100 code rồi bấm Đổi → chỉ đổi được **1 code đầu tiên**, 99 code còn lại bị bỏ qua. Đây chính là lúc bạn cần **extension Auto Redeem** ở bước 3.

---

## 3. Cài Extension Auto Redeem (miễn phí)

Extension này tự động:
- ✅ Điền từng code vào ô
- ✅ Bấm nút "Đổi" cho bạn
- ✅ Đợi server phản hồi
- ✅ Tự retry khi lỗi mạng
- ✅ Ghi lại log (thành công / lỗi / hết phiên)

### Cách cài

**Bước 1:** Truy cập Chrome Web Store (extension đã được duyệt):
```
https://chromewebstore.google.com/detail/auto-redeem-code-delta-fo/bflkabakmcafnnlbmnifpdpolponabkn
```

**Bước 2:** Bấm **"Thêm vào Chrome"** → **"Thêm tiện ích"**.

**Bước 3:** Mở trang `https://event.dff.garena.vn/redeem`, đăng nhập Garena.

**Bước 4:** Click biểu tượng extension (góc phải trên thanh Chrome) → popup hiện ra → extension đã sẵn sàng.

---

## 4. Cách dùng (screenshot minh hoạ bằng text)

### 4.1. Chuẩn bị danh sách code

Có 2 cách:

**Cách A — Paste danh sách thủ công:**
1. Click **"📋 Tải mẫu"** (Load sample) trong popup → extension tự điền ~5 code test.
2. Hoặc: copy danh sách code từ web, paste vào ô textarea lớn trong popup (mỗi code 1 dòng).

**Cách B — Import từ file `.txt`:**
1. Click **"📂 Chọn file"** (Import file).
2. Chọn file `.txt` chứa danh sách code (1 code / dòng).
3. File mẫu: download từ [GitHub repo](https://github.com/vietthongblogger/delta-force-automatic-reward-exchange) → `extension/codes/redeem-codes.txt` (348 code gom từ Garena).

### 4.2. Cấu hình delay

Kéo thanh **"Delay giữa các code"**:
- **Mặc định 2 giây** — an toàn cho tài khoản thường
- **1 giây** — nhanh hơn nhưng dễ bị rate limit (mã 51)
- **3–5 giây** — khuyến nghị nếu tài khoản bạn mới đăng nhập

### 4.3. Bấm chạy

1. **Kiểm tra lại** — popup báo "Trang đã sẵn sàng" màu xanh.
2. Click **"▶ Bắt đầu"**.
3. Extension tự điền và đổi từng code.
4. Theo dõi thanh tiến trình + log bên dưới.

### 4.4. Kết quả

Sau khi xong, popup hiện:
- ✅ **Thành công** — code đã đổi, quà vào trong game
- ⚠️ **Không dùng được** — code không hợp lệ (đã dùng / hết hạn / sai)
- ⚠️ **Hết phiên** — bạn cần đăng nhập lại
- ❌ **Lỗi** — lỗi mạng hoặc server (sẽ tự retry)

---

## 5. Xử lý 4 lỗi thường gặp

### Lỗi 1: "Không thấy ô nhập code"

**Nguyên nhân:** Trang Garena đang load hoặc bạn chưa đăng nhập.

**Cách xử:**
1. F5 (reload) trang `event.dff.garena.vn/redeem`.
2. Đăng nhập Garena bằng tài khoản đã chơi Delta Force.
3. Đợi 5 giây → mở lại popup extension.

### Lỗi 2: "Hết phiên / Phiên đã hết"

**Nguyên nhân:** Garena session timeout (đăng nhập quá lâu).

**Cách xử:**
1. Click **"Đăng nhập lại"** trên trang redeem.
2. Đăng nhập xong → click **"Tiếp tục"** trong popup extension.

### Lỗi 3: "Máy chủ trả mã 51: system error"

**Nguyên nhân:** Server Garena đang quá tải (nhiều người đổi code cùng lúc).

**Cách xử:**
1. Đợi **5–10 phút**.
2. Click **"🔁 Thử lại code lỗi"** trong popup.
3. Tăng delay lên **3–5 giây** trước khi retry.

> 💡 Mã 51 là lỗi server, không phải lỗi code. Retry là đúng cách.

### Lỗi 4: "Code không hợp lệ"

**Nguyên nhân:** Code đã dùng / hết hạn / typo.

**Cách xử:**
- **Không cần retry** — code này thật sự hết hiệu lực.
- Bỏ qua, tiếp tục code tiếp theo.

---

## 6. Mẹo nâng cao

### Mẹo 1: Chạy theo batch (đợt)
Không paste 348 code 1 lần. Chia **2–3 đợt** để tránh tải nặng server:
- Đợt 1: 100 code đầu
- Đợt 2: 100 code tiếp
- Đợt 3: phần còn lại

### Mẹo 2: Dùng delay thấp ban đêm
Từ 1h–7h sáng ít người dùng → có thể giảm delay xuống 1.5–2 giây.

### Mẹo 3: Tận dụng tab "Lịch sử"
Sau mỗi đợt chạy, click tab **"📜 Lịch sử"** để xem các job trước. Có thể **export CSV** để lưu vào Excel.

### Mẹo 4: Tự thêm code mới
Khi có code mới từ fanpage / streamer:
1. Click **"➕ Import file"**.
2. Paste code vào file `.txt`.
3. Re-run.

---

## 7. Câu hỏi thường gặp (FAQ)

**Hỏi: Extension này có an toàn không?**
> ✅ Có. Source code công khai trên GitHub. Extension chỉ chạy trên trang `event.dff.garena.vn/redeem`, không gửi dữ liệu đi đâu. Không cần quyền admin, không đọc mật khẩu.

**Hỏi: Bị Chrome từ chối cài?**
> Đợi 5 phút rồi thử lại. Chrome đôi khi delay review extension mới.

**Hỏi: Code đổi xong quà ở đâu?**
> Vào game → **Hòm thư** (Mailbox) → nhận quà. Một số quà tự động cộng vào tài khoản.

**Hỏi: Tài khoản có bị khóa vì dùng extension không?**
> ❌ Không. Extension chỉ tự động thao tác trên trang redeem — tương đương bạn gõ tay nhanh hơn. Garena không cấm auto-redeem.

**Hỏi: Có cần VPN không?**
> ❌ Không. Chạy bình thường trong Việt Nam.

---

## 8. Liên hệ / Hỗ trợ

- **GitHub repo**: https://github.com/vietthongblogger/delta-force-automatic-reward-exchange
- **Tác giả**: vietthongblogger
- **Donate**: mở extension → tab "☕ Donate" → quét QR Techcombank

---

> **Chúc bạn săn được nhiều quà! 🎁**
