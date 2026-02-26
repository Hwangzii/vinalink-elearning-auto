const { chromium } = require('playwright');
const fs = require('fs');
const config = require('./config');

async function performLogin(username, password) {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-infobars',
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    if (fs.existsSync(config.TIMEHOOKER_PATH)) {
      const script = fs.readFileSync(config.TIMEHOOKER_PATH, 'utf8');
      await page.addInitScript(script);
    }

    await page.goto('http://elearning.vina-link.com.vn/login/index.php', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    await page.fill('#username', username);
    await page.fill('#password', password);
    await page.click('#loginbtn');

    await page.waitForURL(url => !url.href.includes('login/index.php'), { timeout: 20000 });
    await page.waitForSelector('.username', { timeout: 15000 });

    const fullName = (await page.innerText('.username')).trim();
    return { success: true, fullName };
  } catch (err) {
    return { success: false, error: err.message || 'Lỗi không xác định' };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { performLogin };