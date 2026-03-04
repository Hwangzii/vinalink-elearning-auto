// file: src/browser.js
// Trách nhiệm: khởi tạo Chrome + context + inject TimeHooker
// Không chứa logic điều hướng hay học — uỷ quyền cho navigator.js
require('dotenv').config();
const { chromium } = require('playwright');
const fs     = require('fs');
const config = require('./config');
const { navigate } = require('./navigator');

const IS_DEV = process.env.NODE_ENV === 'development';

// Args dùng chung cho mọi lần launch
// Tách ra ngoài để không tạo array mới mỗi lần gọi performLoginAndGetProgress
const CHROMIUM_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',       // dùng /tmp thay vì /dev/shm → tránh OOM trên Docker/Linux
  '--disable-gpu',
  '--disable-extensions',
  '--disable-infobars',
  '--disable-background-networking',   // tắt update check, safe-browsing ping ngầm
  '--disable-default-apps',
  '--disable-sync',                    // không sync profile → giảm RAM
  '--disable-translate',
  '--metrics-recording-only',          // không gửi metrics về Google
  '--no-first-run',
  '--mute-audio',                      // tắt audio → bớt 1 thread audio process
  '--hide-scrollbars',
  // Tắt renderer process throttling khi tab background
  // (quan trọng cho headless: đảm bảo JS timer chạy đúng tốc độ)
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--disable-background-timer-throttling',
];

// TimeHooker script được đọc 1 lần khi module load, không đọc lại mỗi lần launch
let _hookerScript = null;
function getHookerScript() {
  if (_hookerScript !== null) return _hookerScript; // cache hit
  if (fs.existsSync(config.TIMEHOOKER_PATH)) {
    _hookerScript = fs.readFileSync(config.TIMEHOOKER_PATH, 'utf8');
  } else {
    _hookerScript = ''; // không có file → trả về empty string
  }
  return _hookerScript;
}

// Polling snippet inject kèm hooker — tạo 1 lần
const SPEED_SNIPPET = `
(function(){
  var _t = 0;
  var _iv = setInterval(function() {
    if (typeof $hookTimer !== 'undefined' && $hookTimer && $hookTimer.setSpeed) {
      $hookTimer.setSpeed(${config.SPEED_RATE});
      clearInterval(_iv);
    } else if (++_t > 50) clearInterval(_iv);
  }, 50);
})();
`;

async function performLoginAndGetProgress(username, password, row) {
  let browser;
  try {
    browser = await chromium.launch({
      headless: !IS_DEV,
      slowMo:   IS_DEV ? config.DEV_SLOW_MO : 0,
      args: CHROMIUM_ARGS,
    });

    if (IS_DEV) console.log(`[DEV] headless=false | slowMo=${config.DEV_SLOW_MO}ms`);

    const context = await browser.newContext({
      viewport:  { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                 '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const hookerScript = getHookerScript();
    if (hookerScript) {
      await context.addInitScript(hookerScript + SPEED_SNIPPET);
      console.log(`[${username}] TimeHooker sẵn sàng | speed=${config.SPEED_RATE}x`);
    }

    const page = await context.newPage();
    page.on('dialog', async d => { await d.dismiss().catch(() => {}); });

    return await navigate(page, username, password, row);

  } catch (err) {
    console.error(`[${username}] Lỗi: ${err.message}`);
    return { success: false, error: err.message || 'Lỗi không xác định' };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { performLoginAndGetProgress };