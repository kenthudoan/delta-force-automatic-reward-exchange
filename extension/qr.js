/*
 * Tiện ích QR cho popup:
 *   - QR.toSVG(text, opts)             -> chuỗi SVG để nhúng vào DOM
 *   - QR.vietQR({...})                  -> chuỗi EMVCo VietQR (chuẩn NAPAS)
 *
 * File này phụ thuộc:
 *   qrcode.js       (qrcode-generator của Kazuhiko Arase, MIT)
 *   qrcode_UTF8.js  (thêm bảng UTF-8)
 *
 * Phải load theo thứ tự: qrcode.js -> qrcode_UTF8.js -> qr.js
 */
(function (root) {
  'use strict';

  // ---------- QR rendering ----------
  function toSVG(text, opts) {
    const o = opts || {};
    const size = Number.isFinite(o.size) ? o.size : 180;
    const margin = Number.isFinite(o.margin) ? o.margin : 2;
    const dark = o.dark || '#0e9b6c';
    const light = o.light || 'transparent';
    const ecc = o.ecc || 'M'; // L, M, Q, H
    const qr = root.qrcode(0, ecc);
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const total = n + margin * 2;
    const scale = size / total;
    let rects = '';
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (qr.isDark(y, x)) {
          const px = (x + margin) * scale;
          const py = (y + margin) * scale;
          rects += '<rect x="' + px.toFixed(2) + '" y="' + py.toFixed(2) + '"'
            + ' width="' + scale.toFixed(2) + '" height="' + scale.toFixed(2) + '"/>';
        }
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '"'
      + ' width="' + size + '" height="' + size + '" shape-rendering="crispEdges">'
      + '<rect width="' + size + '" height="' + size + '" fill="' + light + '"/>'
      + '<g fill="' + dark + '">' + rects + '</g></svg>';
  }

  // ---------- VietQR (NAPAS) ----------
  // Tạo chuỗi TLV (tag-length-value) cho EMVCo QR, dùng ASCII chuẩn.
  function tlv(id, value) {
    const s = String(value);
    const len = s.length.toString().padStart(2, '0');
    return id + len + s;
  }

  // CRC16-CCITT (polynomial 0x1021, init 0xFFFF, no reflect, no xorout).
  function crc16(buf) {
    let crc = 0xFFFF;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
        else crc = (crc << 1) & 0xFFFF;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  /**
   * Tạo chuỗi VietQR cho chuyển khoản ngân hàng (chuẩn NAPAS / EMVCo).
   * @param {object} o
   * @param {string} o.bankBin  - 6 số BIN ngân hàng (Techcombank = 970407)
   * @param {string} o.account  - Số tài khoản / số thẻ
   * @param {string} [o.name]   - Tên người nhận (ASCII in hoa, tối đa 25 ký tự)
   * @param {string} [o.city]   - Thành phố (ASCII in hoa, tối đa 15 ký tự)
   * @param {string} [o.amount] - Số tiền VND (số nguyên, không bắt buộc)
   * @param {string} [o.message]- Nội dung chuyển khoản (ASCII, tối đa 50 ký tự)
   * @param {string} [o.service]- Mã dịch vụ NAPAS: 'QRIBFTTA' cho Techcombank,
   *                               'QRPUSH' cho generic QR PUSH. Mặc định 'QRIBFTTA'.
   * @returns {string} chuỗi TLV, đã tính CRC, sẵn sàng nhúng vào QR
   */
  function vietQR(o) {
    const bankBin = String(o.bankBin || '');
    const account = String(o.account || '');
    if (!/^\d{6}$/.test(bankBin)) throw new Error('bankBin phải đúng 6 chữ số');
    if (!account) throw new Error('account bắt buộc');

    const isAscii = (s) => /^[\x20-\x7E]*$/.test(s);
    const name = (o.name || 'NGUOI NHAN').toUpperCase().slice(0, 25);
    const city = (o.city || 'HA NOI').toUpperCase().slice(0, 15);
    if (!isAscii(name)) throw new Error('Tên phải là ASCII (không dấu)');
    if (!isAscii(city)) throw new Error('Thành phố phải là ASCII (không dấu)');

    const amount = (o.amount && Number.isFinite(+o.amount) && +o.amount > 0)
      ? Math.round(+o.amount)
      : 0;

    // ----- Tag 38: Merchant Account Information (NAPAS, 3 cấp TLV) -----
    // Cấu trúc chuẩn Techcombank trên VietQR.io:
    //   38
    //   └─ 00 (10) A000000727           ← GUID NAPAS
    //   └─ 01 (20)                     ← "Bank info" wrapper
    //        ├─ 00 (06) <bankBin>      ← BIN ngân hàng
    //        └─ 01 (06) <account>      ← Số tài khoản
    //   └─ 02 (08) QRIBFTTA            ← Service code (NAPAS định danh dịch vụ)
    //
    // Một số app NH parse theo cấu trúc 3 cấp này → phải khớp từng sub-tag length.
    //   Service phổ biến: QRIBFTTA (TCB), QRBFTVCB (VCB), …; QRPUSH là generic.
    const guid = 'A000000727';
    const service = String(o.service || 'QRIBFTTA').toUpperCase().slice(0, 8);
    const bankInnerInfo = tlv('00', bankBin) + tlv('01', account);
    const bankInfo =
      tlv('00', guid) +
      tlv('01', bankInnerInfo) +
      tlv('02', service);

    // ----- Initiation Method -----
    // 11 = static QR (không có amount hoặc amount là gợi ý, người dùng tự sửa)
    // 12 = dynamic QR (amount cố định, mỗi lần quét là một giao dịch)
    // Khuyến nghị cho cá nhân: 12 (dynamic) khi có amount — đây là cách
    // VietQR.io mặc định sinh QR cho TCB 397983, mọi app NH đều đọc được.
    const initiation = amount > 0 ? '12' : '11';

    let payload =
      tlv('00', '01') +
      tlv('01', initiation) +
      tlv('38', bankInfo);

    if (amount > 0) {
      payload += tlv('54', String(amount));
    }
    payload += tlv('53', '704'); // VND (ISO 4217)
    payload += tlv('58', 'VN'); // Country (ISO 3166-1 alpha-2)
    payload += tlv('59', name);
    payload += tlv('60', city);

    if (o.message) {
      const msg = String(o.message).slice(0, 50);
      if (isAscii(msg)) {
        // Tag 62 - Additional Data Field Template (NAPAS định nghĩa sub-tag 08 = Bill Number).
        // Phải dùng sub-tag 08 để nội dung CK hiển thị đúng trên app NH.
        payload += tlv('62', tlv('08', msg));
      }
    }

    // CRC: tính trên chuỗi kết thúc bằng "6304" (Tag 63 + length "04")
    const withCrcHeader = payload + '6304';
    const crc = crc16(withCrcHeader);
    return payload + '6304' + crc;
  }

  root.DFRQR = { toSVG, vietQR };
})(globalThis);
