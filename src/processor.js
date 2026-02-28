// file: src/processor.js
const config = require('./config');

async function processRow(row, { performLoginAndGetProgress }) {
  const user = row.get('ID')?.toString().trim();
  const pass = row.get('PASS')?.toString().trim();

  if (!user || !pass) {
    console.warn(`Dòng thiếu ID hoặc PASS → bỏ qua`);
    return;
  }

  const result = await performLoginAndGetProgress(user, pass);

  if (result.success) {
    row.set('STATUS', 'success');
    row.set('FULLNAME', result.fullName);
    // Nếu muốn lưu tiến độ vào cột mới trong Sheet (tùy chọn)
    // row.set('PROGRESS', result.progress || 'Không xác định');
    await row.save();
    console.log(`[${user}] Xong ── ${result.fullName} ── Tiến độ: ${result.progress || 'Không xác định'}`);
  } else {
    row.set('STATUS', 'Sai ID/Mật khẩu');
    await row.save();
    console.log(`[${user}] Thất bại → ${result.error}`);
  }
}

module.exports = { processRow };