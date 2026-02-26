const config = require('./config');

async function processRow(row, { performLogin }) {
  const user = row.get('ID')?.toString().trim();
  const pass = row.get('PASS')?.toString().trim();

  if (!user || !pass) {
    console.warn(`Dòng thiếu ID hoặc PASS → bỏ qua`);
    return;
  }

  for (let attempt = 1; attempt <= config.MAX_ATTEMPTS; attempt++) {
    row.set('STATUS', `processing... (thử ${attempt})`);
    await row.save();

    const result = await performLogin(user, pass);

    if (result.success) {
      row.set('STATUS', 'success');
      row.set('FULLNAME', result.fullName);
      await row.save();
      console.log(`[${user}] Thành công → ${result.fullName}`);
      return;
    }

    console.log(`[${user}] Thất bại (thử ${attempt}): ${result.error}`);

    if (attempt < config.MAX_ATTEMPTS) {
      await new Promise(r => setTimeout(r, config.RETRY_DELAY_MS));
    } else {
      row.set('STATUS', 'error');
      await row.save();
    }
  }
}

module.exports = { processRow };