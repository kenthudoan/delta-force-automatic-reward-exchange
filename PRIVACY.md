# Chính sách quyền riêng tư

> Tóm tắt một dòng: extension **không thu thập, không lưu trữ trên server,
> không truyền tải** bất kỳ dữ liệu nào ra ngoài máy của bạn.

## Dữ liệu extension thu thập

**Không có.** Extension không có máy chủ backend, không có analytics, không có
telemetry, không có crash report tự động.

## Dữ liệu extension lưu trên máy bạn

Extension dùng `chrome.storage.local` để lưu các thông tin sau, **chỉ trên máy bạn**:

| Khoá | Nội dung | Thời gian lưu |
|---|---|---|
| `dfr.settings` | Thời gian chờ mặc định, nháp code chưa gửi | Cho tới khi bạn xoá |
| `dfr.job` | Tiến trình đang chạy (code, trạng thái, log) | Cho tới khi bấm "Làm mới" |
| `dfr.history` | 30 job gần nhất (tóm tắt + items) | Cho tới khi bấm "Xoá tất cả" |

Bạn có thể xoá mọi dữ liệu bằng cách gỡ extension, hoặc dùng nút **Xoá tất cả**
trong tab **Lịch sử**.

## Quyền truy cập

Extension xin 2 quyền trong `manifest.json`:

- **`storage`** — để lưu cài đặt và lịch sử trên máy bạn (xem bảng trên).
- **`host_permissions: ["https://redeem.df.garena.sg/*"]`** — để chỉ chạy
  content script trên trang đổi quà chính thức của Garena. Extension **không**
  hoạt động trên bất kỳ trang web nào khác.

## Truy cập mạng

Extension **không gọi** bất kỳ API bên ngoài nào:

- Content script mô phỏng thao tác người dùng (điền ô input, click nút) trên
  trang đổi quà — không bypass API.
- Service worker chỉ đếm giờ (`setTimeout`), không có `fetch`.
- QR Donate tạo bằng thư viện JavaScript nhúng sẵn, không gọi API tạo QR.
- CSP `connect-src 'none'` chặn mọi kết nối mạng từ extension pages.

## Cookie và mật khẩu

Extension **không đọc** cookie, session token, hay bất kỳ thông tin đăng nhập nào.
Bạn đăng nhập Garena trực tiếp trên trang đổi quà — extension không can thiệp.

## Trẻ em

Extension không hướng tới trẻ em dưới 13 tuổi và không thu thập bất kỳ dữ liệu
nào của trẻ em.

## Thay đổi chính sách

Nếu chính sách thay đổi, bạn sẽ thấy trong file [`CHANGELOG.md`](CHANGELOG.md).
Phiên bản mới sẽ giữ nguyên triết lý "không gửi dữ liệu ra ngoài".

## Liên hệ

Mọi câu hỏi về quyền riêng tư, vui lòng mở issue tại GitHub repo.
