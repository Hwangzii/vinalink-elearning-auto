// file: src/processor.js
const { COL, STATUS, getCol, setCol } = require('./columns');
const config = require('./config');

// Các lỗi do tải chậm/timeout → nên retry thay vì đánh dấu lỗi vĩnh viễn
const RETRYABLE_ERRORS = [
  'timeout', 'Timeout',
  'navigation', 'net::',
  'ERR_', 'ECONNRESET',
  'waitForURL', 'waitForSelector', 'waitFor',
];

function isRetryable(errMsg) {
  return RETRYABLE_ERRORS.some(keyword => errMsg.includes(keyword));
}

async function processRow(row, { performLoginAndGetProgress }) {
  const user = getCol(row, COL.username);
  const pass = getCol(row, COL.password);

  if (!user || !pass) {
    const headers = row._worksheet?.headerValues || [];
    console.warn(`⚠ Dòng thiếu tài khoản hoặc mật khẩu → bỏ qua`);
    console.warn(`  Các cột hiện có: [${headers.join(' | ')}]`);
    return;
  }

  const maxAttempts = config.MAX_ATTEMPTS || 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Đánh dấu "đang học" để tránh bot khác pick up cùng lúc
    setCol(row, COL.status, STATUS.studying);
    await row.save();

    if (attempt === 1) {
      console.log(`[${user}] 🟡 Bắt đầu xử lý...`);
    } else {
      console.log(`[${user}] 🔄 Thử lại lần ${attempt}/${maxAttempts}...`);
      // Chờ trước khi retry để giảm tải
      await new Promise(r => setTimeout(r, config.RETRY_DELAY_MS || 5000));
    }

    const result = await performLoginAndGetProgress(user, pass, row);

    if (result.success) {
      // STATUS 'Chưa thi' đã được set bởi messenger.js
      setCol(row, COL.fullname, result.fullName || '');
      await row.save();
      console.log(`[${user}] ✅ Hoàn thành ── ${result.fullName} ── Tiến độ: ${result.progress || 'Không xác định'}`);
      return; // xong, thoát
    }

    const errMsg = result.error || 'Lỗi không xác định';

    // Sai mật khẩu → không retry, đánh lỗi ngay
    const isWrongPass = ['invalid', 'password', 'username', 'sai', 'incorrect']
      .some(k => errMsg.toLowerCase().includes(k));

    if (isWrongPass) {
      setCol(row, COL.status, STATUS.failed);
      await row.save();
      console.log(`[${user}] ❌ Sai tài khoản/mật khẩu → ${errMsg}`);
      return;
    }

    // Lỗi timeout/mạng → retry nếu còn lượt
    if (isRetryable(errMsg) && attempt < maxAttempts) {
      console.log(`[${user}] ⚠ Lỗi tạm thời (lần ${attempt}): ${errMsg}`);
      console.log(`[${user}] → Sẽ thử lại sau ${config.RETRY_DELAY_MS / 1000}s...`);
      continue;
    }

    // Hết lượt retry hoặc lỗi không xác định → đánh lỗi
    setCol(row, COL.status, STATUS.error);
    await row.save();
    console.log(`[${user}] ❌ Thất bại sau ${attempt} lần → ${errMsg}`);
  }
}

module.exports = { processRow };