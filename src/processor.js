// file: src/processor.js
const { COL, STATUS, getCol, setCol } = require('./columns');
const config = require('./config');

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
    if (attempt === 1) {
      // Lần đầu: đánh dấu "đang học" ngay để tránh bot khác pick up
      // navigator.js sẽ ghi đè STATUS + fullName ngay sau khi đăng nhập thành công
      // → chỉ cần 1 lần save ở đây, không save lại ở đầu retry
      setCol(row, COL.status, STATUS.studying);
      await row.save();
      console.log(`[${user}] 🟡 Bắt đầu xử lý...`);
    } else {
      // Retry: chờ trước, không cần save lại (status đã là studying hoặc error từ attempt trước)
      console.log(`[${user}] 🔄 Thử lại lần ${attempt}/${maxAttempts}...`);
      await new Promise(r => setTimeout(r, config.RETRY_DELAY_MS || 5000));
    }

    const result = await performLoginAndGetProgress(user, pass, row);

    if (result.success) {
      // STATUS 'Chưa thi' và fullName đã được ghi bởi messenger.js / navigator.js
      // Chỉ cần save 1 lần để đồng bộ bất kỳ thay đổi pending nào
      await row.save();
      console.log(`[${user}] ✅ Hoàn thành ── ${result.fullName} ── Tiến độ: ${result.progress || 'Không xác định'}`);
      return;
    }

    const errMsg = result.error || 'Lỗi không xác định';

    const isWrongPass = ['invalid', 'password', 'username', 'sai', 'incorrect']
      .some(k => errMsg.toLowerCase().includes(k));

    if (isWrongPass) {
      setCol(row, COL.status, STATUS.failed);
      await row.save();
      console.log(`[${user}] ❌ Sai tài khoản/mật khẩu → ${errMsg}`);
      return;
    }

    if (isRetryable(errMsg) && attempt < maxAttempts) {
      console.log(`[${user}] ⚠ Lỗi tạm thời (lần ${attempt}): ${errMsg}`);
      console.log(`[${user}] → Sẽ thử lại sau ${config.RETRY_DELAY_MS / 1000}s...`);
      continue;
    }

    setCol(row, COL.status, STATUS.error);
    await row.save();
    console.log(`[${user}] ❌ Thất bại sau ${attempt} lần → ${errMsg}`);
  }
}

module.exports = { processRow };

// ─── Xử lý hàng thi (STATUS = 'Bắt đầu thi') ────────────────────────────────
const { runQuiz }   = require('./quizzer');
const { loginOnly } = require('./navigator');
const { chromium }  = require('playwright');

// Dùng lại CHROMIUM_ARGS từ browser.js thay vì khai báo lại
const CHROMIUM_ARGS = [
  '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
  '--disable-extensions', '--disable-background-networking', '--disable-sync',
  '--disable-translate', '--no-first-run', '--mute-audio',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--disable-background-timer-throttling',
];

async function processQuizRow(row, _deps) {
  const user = getCol(row, COL.username);
  const pass = getCol(row, COL.password);

  if (!user || !pass) {
    console.warn(`⚠ Dòng thiếu tài khoản hoặc mật khẩu → bỏ qua`);
    return;
  }

  console.log(`[${user}] 🎯 Bắt đầu quy trình thi...`);
  setCol(row, COL.status, STATUS.taking_exam);
  await row.save();

  let browser;
  try {
    browser = await chromium.launch({
      headless: process.env.NODE_ENV !== 'development',
      slowMo:   process.env.NODE_ENV === 'development' ? config.DEV_SLOW_MO : 0,
      args: CHROMIUM_ARGS,
    });
    const context = await browser.newContext({
      viewport:  { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    page.on('dialog', async d => { await d.dismiss().catch(() => {}); });

    const fullName = await loginOnly(page, user, pass);
    console.log(`[${user}] ✓ Đăng nhập → ${fullName}`);

    const result = await runQuiz(page, user, row);

    setCol(row, COL.fullname, fullName || '');
    await row.save();
    console.log(`[${user}] ✅ Thi xong | Điểm: ${result.score || 'N/A'}`);

  } catch (err) {
    console.error(`[${user}] ❌ Lỗi thi: ${err.message}`);
    setCol(row, COL.status, STATUS.error);
    await row.save();
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { processRow, processQuizRow };