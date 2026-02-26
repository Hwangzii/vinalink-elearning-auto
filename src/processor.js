const config = require('./config');

async function processRow(row, { performLogin }) {
  const user = row.get('ID')?.toString().trim();
  const pass = row.get('PASS')?.toString().trim();

  if (!user || !pass) {
    console.warn(`Dòng thiếu ID hoặc PASS → bỏ qua`);
    return;
  }

  // Không cần set processing nữa để tránh ghi đè Sheet liên tục
  const result = await performLogin(user, pass);

  if (result.success) {
    row.set('STATUS', 'success');
    row.set('FULLNAME', result.fullName);
    await row.save();
    console.log(`[${user}] Thành công → ${result.fullName}`);
  } else {
    // Tất cả lỗi (timeout, sai pass, mạng, captcha, v.v.) đều coi là sai thông tin
    row.set('STATUS', 'Sai ID/Mật khẩu');
    await row.save();
    console.log(`[${user}] Thất bại → ${result.error}`);
  }
}

module.exports = { processRow };