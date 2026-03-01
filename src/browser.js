// file: src/browser.js
// Trách nhiệm: khởi tạo Chrome + context + inject TimeHooker
// Không chứa logic điều hướng hay học — uỷ quyền cho navigator.js
require('dotenv').config();
const { chromium } = require('playwright');
const fs   = require('fs');
const config = require('./config');
const { navigate } = require('./navigator');

const IS_DEV = process.env.NODE_ENV === 'development';

async function performLoginAndGetProgress(username, password, row) {
  let browser;
  try {
    browser = await chromium.launch({
      headless: !IS_DEV,
      slowMo:   IS_DEV ? config.DEV_SLOW_MO : 0,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-infobars',
      ],
    });

    if (IS_DEV) console.log(`[DEV] headless=false | slowMo=${config.DEV_SLOW_MO}ms`);

    const context = await browser.newContext({
      viewport:  { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                 '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    // Inject TimeHooker vào MỌI frame kể cả iframe SCORM (context-level)
    // Polling 50ms đến khi $hookTimer sẵn sàng thì set speed
    if (fs.existsSync(config.TIMEHOOKER_PATH)) {
      const hookerScript = fs.readFileSync(config.TIMEHOOKER_PATH, 'utf8');
      await context.addInitScript(hookerScript + `
(function(){
  var _t = 0;
  var _iv = setInterval(function() {
    if (typeof $hookTimer !== 'undefined' && $hookTimer && $hookTimer.setSpeed) {
      $hookTimer.setSpeed(${config.SPEED_RATE});
      clearInterval(_iv);
    } else if (++_t > 50) clearInterval(_iv);
  }, 50);
})();
`);
      console.log(`[${username}] TimeHooker sẵn sàng | speed=${config.SPEED_RATE}x`);
    }

    const page = await context.newPage();
    page.on('dialog', async d => { await d.dismiss().catch(() => {}); });

    // Uỷ quyền toàn bộ điều hướng + học cho navigator
    return await navigate(page, username, password, row);

  } catch (err) {
    console.error(`[${username}] Lỗi: ${err.message}`);
    return { success: false, error: err.message || 'Lỗi không xác định' };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { performLoginAndGetProgress };