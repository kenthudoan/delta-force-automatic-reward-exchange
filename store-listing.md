# Mô tả chi tiết cho Chrome Web Store
> Dán toàn bộ khối bên dưới vào ô "Mô tả" trong trang Store Listing.
> Đếm ký tự: khoảng ~1.8 KB — dưới giới hạn 16.000.

---

## Auto Redeem Code Delta Force — Đổi Code Garena Tự Động

Đổi hàng loạt code Delta Force trên trang redeem.df.garena.sg chỉ với một cú nhấn. Dán danh sách code, bấm **Bắt đầu**, extension sẽ tự mở từng code trong trang đổi quà, chờ mỗi mã theo delay bạn chọn, ghi nhận kết quả và xuất CSV khi xong. **Hoàn toàn chạy trên máy bạn, không gửi dữ liệu ra ngoài.**

### Tính năng chính

**Đổi hàng loạt, một lần chạm**
- Nhập mỗi code một dòng, hoặc dán cả đống cách nhau bằng dấu cách, dấu phẩy, chấm phẩy, hai chấm, gạch đứng…
- Có sẵn nút **Nạp code mẫu** và **Nhập từ file** (.txt / .csv) để khỏi gõ tay.
- Bấm **Ctrl + Enter** trong popup để chạy nhanh.

**Delay riêng từng code**
- Slider chung đặt khoảng chờ mặc định (1,5 – 10 giây).
- Muốn chờ code nào lâu hơn, gõ `CODE=GIÂY` ngay trong danh sách, ví dụ `DFREWARD=5` → code đó chờ 5 giây; `DFGIFT=2.5` → chờ 2,5 giây. Khoảng cho phép 0,5 – 60 giây.
- Chờ lâu hơn giúp tránh máy chủ chặn khi chạy nhiều code liên tiếp.

**Phát hiện code lỗi / lẫn ký tự lạ**
- Khi copy code từ Facebook / Discord / YouTube, nhiều khi chữ Nga / Hy Lạp trông giống chữ Latin bị lẫn vào. Extension sẽ liệt kê các token đáng ngờ và **không tự gửi đi** — bạn quyết định sửa hay xoá.
- Bỏ qua luôn các từ ngắn hơn 6 ký tự, toàn số, hoặc chữ có dấu tiếng Việt (thường là rác khi copy).
- Tự động loại bỏ code trùng.

**Lịch sử & thống kê**
- Mỗi job hoàn tất sẽ được lưu lại — tối đa 30 job gần nhất, có tóm tắt số code **Thành công / Đã nhận trước đó / Không dùng được / Lỗi mạng / Hết phiên đăng nhập**, thời gian chạy và thời điểm hoàn tất.
- Tab **Lịch sử** xem lại bất kỳ lúc nào, xoá một nút.

**Xuất CSV**
- Nhật ký từng code đổi được có thể tải về file CSV (UTF-8, mở được bằng Excel / Google Sheets) hoặc sao chép vào clipboard.

**Tạm dừng / Tiếp tục / Thử lại**
- Chạy nửa chừng muốn dừng → bấm **Tạm dừng**. Job sẽ dừng an toàn ở ranh giới code.
- Sau khi hết phiên đăng nhập hoặc máy chủ lỗi, bấm **Thử lại code lỗi** để chạy lại đúng những mã bị fail mà không cần nhập lại danh sách.
- **Làm mới** xoá job hiện tại, đưa popup về trạng thái nền.

**Đổi an toàn, không phá trang**
- Content script chạy trong thế giới riêng (`world: "ISOLATED"`) và thao tác qua các helper ở thế giới MAIN — không ghi đè biến toàn cục của trang redeem.df.garena.sg, không inject UI lạ, không động vào DOM của Garena ngoài phạm vi cần thiết.
- Nếu đóng popup trong khi đang chạy, job vẫn tiếp tục — mở popup lại là thấy tiến độ cập nhật ngay.

**Ủng hộ tác giả bằng QR chuẩn VietQR**
- Tab **Ủng hộ** hiển thị QR Techcombank số tài khoản 397983, chuẩn NAPAS EMVCo — quét là app ngân hàng (Techcombank, MBBank, MoMo, Vietcombank, ZaloPay…) tự điền số tài khoản, tên chủ tài khoản, nội dung chuyển khoản, thậm chí **số tiền** nếu bạn nhập trước.
- Nút **Sao chép** số tài khoản và nội dung cho ai không muốn quét QR.

### Quyền & quyền riêng tư

Extension **chỉ** yêu cầu:

- Quyền `storage`: lưu lịch sử 30 job gần nhất và cài đặt delay trên máy bạn. Không đồng bộ đám mây, không gửi đi đâu hết.
- Host permission `https://redeem.df.garena.sg/*`: tiêm content script vào đúng trang đổi quà để extension hoạt động. Không vào bất kỳ trang nào khác.

Nội dung trang đổi quà bạn mở **không bao giờ** rời khỏi trình duyệt của bạn. Không có analytics, không có telemetry, không có server backend.

### Phím tắt

| Phím | Tác dụng |
|------|----------|
| `Ctrl + Enter` trong popup | Bắt đầu chạy job ngay |
| `Esc` (khi đang chạy) | Mở popup lại, bấm Tạm dừng |

### Câu hỏi thường gặp

**Tại sao extension yêu cầu truy cập redeem.df.garena.sg?**
Vì nó phải tương tác với form đổi quà trên trang đó. Nếu không có host permission, content script không thể chạy.

**Code có bị mã hoá / gửi về server nào không?**
Không. Mọi thứ xử lý trong trình duyệt. Bạn có thể mở DevTools → Network và chạy extension; chỉ thấy request đến `redeem.df.garena.sg` (chính trang đổi quà) — không có request nào khác.

**Job chạy lúc đóng popup có mất không?**
Không. Job chạy trong tab đổi quà, popup chỉ là giao diện theo dõi. Đóng popup = tắt màn hình, job vẫn tiếp tục tới khi xong danh sách.

**Đổi code có vi phạm điều khoản Garena?**
Mình không đại diện cho Garena. Hành vi của extension tương đương với việc bạn tự gõ code vào trang đổi quà — không có request nào lừa hệ thống, không can thiệp máy chủ. Bạn tự chịu trách nhiệm về việc sử dụng.

**Có lưu mật khẩu tài khoản Garena không?**
Không. Extension chỉ điền code vào form, hoàn toàn không đụng đến thông tin đăng nhập.

### Tác giả

Dylan Tran · facebook.com/whiteh4tfun

Nếu extension giúp ích cho bạn, một đánh giá 5 sao hoặc một ly cà phê (xem tab Ủng hộ) là động lực lớn để mình duy trì và cập nhật.
