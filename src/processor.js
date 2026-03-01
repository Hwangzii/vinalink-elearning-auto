// file: src/processor.js
const { COL, STATUS, getCol, setCol } = require('./columns');

async function processRow(row, { performLoginAndGetProgress }) {
  const user = getCol(row, COL.username);
  const pass = getCol(row, COL.password);

  if (!user || !pass) {
    const headers = row._worksheet?.headerValues || [];
    console.warn(`⚠ Dòng thiếu tài khoản hoặc mật khẩu → bỏ qua`);
    console.warn(`  Các cột hiện có: [${headers.join(' | ')}]`);
    console.warn(`  Tên cột cần thiết: ${JSON.stringify(COL.username)} hoặc ${JSON.stringify(COL.password)}`);
    return;
  }

  console.log(`[${user}] Bắt đầu xử lý...`);
  const result = await performLoginAndGetProgress(user, pass);

  if (result.success) {
    setCol(row, COL.status,   STATUS.success);
    setCol(row, COL.fullname, result.fullName || '');
    await row.save();
    console.log(`[${user}] ✅ Hoàn thành ── ${result.fullName} ── Tiến độ: ${result.progress || 'Không xác định'}`);
  } else {
    const errMsg = result.error || 'Lỗi không xác định';
    // Phân loại lỗi để ghi status phù hợp
    const isWrongPass = errMsg.toLowerCase().includes('login') ||
                        errMsg.toLowerCase().includes('invalid') ||
                        errMsg.toLowerCase().includes('password') ||
                        errMsg.toLowerCase().includes('username');
    setCol(row, COL.status, isWrongPass ? STATUS.failed : STATUS.error);
    await row.save();
    console.log(`[${user}] ❌ Thất bại → ${errMsg}`);
  }
}

module.exports = { processRow };