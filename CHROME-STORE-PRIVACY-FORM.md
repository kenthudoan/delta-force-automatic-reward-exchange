# Chrome Web Store — Nội dung điền (Privacy tab)

> Copy từng khối dán vào dashboard.
> Repo GitHub: kenthudoan/delta-force-automatic-reward-exchange
> Branch: main
> Sau khi push code lên GitHub và bật Pages (Settings → Pages → Source: `main`, `/root`),
> Privacy URL sẽ là: `https://kenthudoan.github.io/delta-force-automatic-reward-exchange/PRIVACY.html`
> (xem hướng dẫn bên dưới)

---

## 1. Mô tả mục đích duy nhất (Mục đích duy nhất)

Tự động đổi hàng loạt mã code Delta Force trên trang đổi quà chính thức redeem.df.garena.sg. Người dùng dán danh sách code vào popup, extension tự điền từng code vào form trên trang web và lưu lại kết quả. Mọi thao tác chạy trong trình duyệt, không kết nối máy chủ ngoài.

---

## 2. Lý do yêu cầu quyền `storage`

Lưu 3 nhóm dữ liệu **chỉ trên máy người dùng** qua `chrome.storage.local`:

- `dfr.settings` — cài đặt delay mặc định và bản nháp danh sách code (cho tới khi người dùng xoá).
- `dfr.job` — tiến trình job đang chạy để phục hồi khi đóng/mở popup.
- `dfr.history` — tối đa 30 job gần nhất với tóm tắt kết quả và nhật ký từng code.

Không đồng bộ đám mây, không gửi đi bất kỳ đâu. Người dùng xoá hết bằng nút "Xoá tất cả" trong tab Lịch sử, hoặc gỡ extension.

---

## 3. Lý do yêu cầu Quyền từ phía máy chủ (`host_permissions`)

Cần truy cập `https://redeem.df.garena.sg/*` để tiêm content script vào **đúng trang đổi quà chính thức** của Garena — nơi duy nhất extension thực hiện chức năng. Không can thiệp vào bất kỳ trang nào khác. Content script chỉ điền giá trị vào ô input và click nút submit trên DOM của trang, tương đương thao tác người dùng gõ tay.

---

## 4. Mã từ xa (Remote code)

**Không sử dụng Mã từ xa.** Không có `eval()`, `new Function()`, không có `<script src="https://...">`, không có `importScripts()` trỏ ra ngoài, không có thư viện nạp qua CDN. Toàn bộ JavaScript đều nằm trong gói extension. CSP trong `manifest.json` đã khóa `script-src 'self'` và `connect-src 'none'` để ngăn chặn mọi kết nối mạng từ extension pages.

Nếu Chrome yêu cầu lý do, chọn **"Có, tôi đang sử dụng Mã từ xa"** và dán:

> Không sử dụng. Mọi mã JavaScript đều đóng gói trong file `.js` của extension, không có `eval()`, không nạp script từ CDN. Content Security Policy trong manifest.json chỉ cho phép `script-src 'self'` và `connect-src 'none'`. Content script tương tác với trang redeem.df.garena.sg thông qua DOM (input/click), không qua API ngoài.

*(Thực tế KHÔNG dùng — chọn "Không" trên form.)*

---

## 5. URL Chính sách quyền riêng tư

```
https://kenthudoan.github.io/delta-force-automatic-reward-exchange/PRIVACY.html
```

Trước khi submit, đảm bảo GitHub Pages đã được bật và URL trả về 200 OK (xem hướng dẫn bên dưới).

---

# Hướng dẫn tạo Privacy URL trên GitHub Pages (3 phút)

## Bước 1 — Push code lên repo của anh

```powershell
# Trong thư mục dự án hiện tại
cd C:\Users\Admin\Downloads\delta-force-automatic-reward-exchange

# Đổi remote sang repo của anh
git remote set-url origin https://github.com/kenthudoan/delta-force-automatic-reward-exchange.git

# Push code lên (sẽ hỏi credentials theo cấu hình bên dưới)
git push -u origin main
```

## Bước 2 — Bật GitHub Pages

1. Vào `https://github.com/kenthudoan/delta-force-automatic-reward-exchange/settings/pages`
2. **Source**: chọn `Deploy from a branch`
3. **Branch**: chọn `main`, folder `/ (root)`
4. Bấm **Save**
5. Đợi 1-2 phút, GitHub build xong sẽ hiện URL:
   `https://kenthudoan.github.io/delta-force-automatic-reward-exchange/`

## Bước 3 — Tạo file PRIVACY.html ở root repo

Vì GitHub Pages render Markdown hơi xấu, tôi tạo file HTML đẹp hơn. Chạy lệnh sau (sau khi đã push code):

```powershell
# Tạo PRIVACY.html từ PRIVACY.md
# (anh có thể làm tay — copy nội dung PRIVACY.md vào file PRIVACY.html với format đẹp hơn)
```

URL cuối cùng:

```
https://kenthudoan.github.io/delta-force-automatic-reward-exchange/PRIVACY.html
```

---

# Checklist submit (Chrome Web Store Dashboard)

Sau khi điền 4 trường trên + push code + bật Pages:

- [ ] Tab **Privacy practices**:
  - [ ] Mục đích duy nhất — điền nội dung #1
  - [ ] Lý do `storage` — điền nội dung #2
  - [ ] Lý do host_permissions — điền nội dung #3
  - [ ] Mã từ xa — chọn **Không**
  - [ ] Dữ liệu thu thập — **không tick** mục nào (extension không thu thập)
  - [ ] Tick đủ 3 ô chứng nhận (Không bán / Không dùng ngoài mục đích / Không cho vay)
  - [ ] Privacy URL — điền URL GitHub Pages

- [ ] Tab **Account settings**:
  - [ ] Email liên hệ đã điền
  - [ ] Email đã xác minh (kiểm tra inbox có mail từ Google)

- [ ] Bấm **Save draft**
- [ ] Quay lại tab Store listing bấm **Submit for review**
