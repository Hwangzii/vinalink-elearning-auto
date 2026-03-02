// file: src/columns.js
// ─────────────────────────────────────────────────────────────────────────────
// Bảng map tên cột Google Sheet (tiếng Việt) sang key nội bộ (tiếng Anh)
// Khi Google Form đổi tên câu hỏi → chỉ sửa file này, không đụng code khác
// ─────────────────────────────────────────────────────────────────────────────

const COL = {
  // ── Đọc vào ──────────────────────────────────────────────────────────────
  username: ['ID TÀI KHOẢN', 'ID', 'Tài khoản', 'Username'],   // cột chứa mã học viên
  password: ['MẬT KHẨU', 'PASS', 'Mật khẩu', 'Password'],      // cột chứa mật khẩu
  status:   ['STATUS', 'TRẠNG THÁI'],                            // cột trạng thái xử lý

  // ── Ghi ra ───────────────────────────────────────────────────────────────
  fullname: ['HỌ VÀ TÊN', 'FULLNAME', 'Họ và tên'],             // cột ghi tên thật
};

// Giá trị STATUS dùng trong sheet
// ── Người dùng set ──────────────────────────────────────────────────────────
//   'đăng nhập'  → bot phát hiện và bắt đầu xử lý tài khoản đó
// ── Bot tự set ──────────────────────────────────────────────────────────────
//   'studying'   → đăng nhập thành công, đang học (hiển thị 'đang học...')
//   'Chưa thi'   → học xong + gửi tin nhắn xong, chờ thi
//   'Sai ID/Mật khẩu' → đăng nhập thất bại
//   'Lỗi'        → lỗi không xác định
const STATUS = {
  // ── Người dùng set ────────────────────────────────────────────────────────
  pending:      'Đăng nhập',    // 🔵 → bot học tự động
  exam_pending: 'Bắt đầu thi', // 🔵 → bot thi tự động

  // ── Bot tự set ────────────────────────────────────────────────────────────
  studying:     'Đang học...',     // 🟡 đang học
  taking_exam:  'Đang thi...',  // 🟡 đang làm bài thi
  done:         'Chưa thi',     // ✅ học xong + nhắn tin → chờ thi
  exam_done:    'Đã thi xong',  // ✅ thi xong + bản cam kết
  failed:       'Sai ID/Mật khẩu', // ❌ sai tài khoản
  error:        'Lỗi',          // ❌ lỗi khác
};

// ─── Helper: đọc giá trị từ row theo danh sách tên cột ──────────────────────
function getCol(row, keys) {
  for (const key of keys) {
    const val = row.get(key);
    if (val !== undefined && val !== null && val.toString().trim() !== '') {
      return val.toString().trim();
    }
  }
  return '';
}

// ─── Helper: ghi giá trị vào row theo danh sách tên cột (cái nào tồn tại thì ghi) ─
function setCol(row, keys, value) {
  const headers = row._worksheet?.headerValues || [];
  for (const key of keys) {
    if (headers.includes(key)) {
      row.set(key, value);
      return; // ghi vào cột đầu tiên tìm thấy là đủ
    }
  }
  // Fallback: thử set cột đầu tiên trong list dù không chắc tồn tại
  try { row.set(keys[0], value); } catch (_) {}
}

module.exports = { COL, STATUS, getCol, setCol };