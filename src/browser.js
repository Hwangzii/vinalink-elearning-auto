// file: src/browser.js
const { chromium } = require('playwright');
const fs = require('fs');
const config = require('./config');

async function performLoginAndGetProgress(username, password) {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,           // đổi thành false khi debug để xem click có đúng không
      // slowMo: 800,           // uncomment khi debug để xem chậm
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

    console.log(`[${username}] Bắt đầu đăng nhập...`);

    // 1. Đăng nhập
    await page.goto('http://elearning.vina-link.com.vn/login/index.php', {
      waitUntil: 'networkidle',
      timeout: 20000,
    });

    await page.fill('#username', username);
    await page.fill('#password', password);
    await page.click('#loginbtn');

    await page.waitForURL(url => !url.href.includes('/login/'), { timeout: 15000 });
    await page.waitForSelector('.username', { timeout: 10000 });

    const fullName = (await page.innerText('.username')).trim();
    console.log(`[${username}] Đăng nhập thành công → ${fullName}`);
    console.log(`[${username}] URL hiện tại: ${page.url()}`);

    // 2. Về trang chính (nếu cần) rồi click vào khóa học "Đào tạo cơ bản"
    await page.goto('http://elearning.vina-link.com.vn/', { waitUntil: 'networkidle', timeout: 15000 });
    console.log(`[${username}] Đã vào trang chính → URL: ${page.url()}`);

    // Click link khóa học (dùng text chính xác + selector an toàn)
    const courseLinkLocator = page.getByRole('link', { name: 'Đào tạo cơ bản' }).first();
    await courseLinkLocator.waitFor({ state: 'visible', timeout: 10000 });
    await courseLinkLocator.click();
    await page.waitForURL('**/course/view.php?id=10**', { timeout: 15000 });
    console.log(`[${username}] Đã vào trang khóa học → URL: ${page.url()}`);

    // 3. Click vào SCORM "1. Pháp luật về bán hàng đa cấp"
    const scormLinkLocator = page.getByRole('link', { name: '1. Pháp luật về bán hàng đa cấp' }).first();
    await scormLinkLocator.waitFor({ state: 'visible', timeout: 10000 });
    await scormLinkLocator.click();

    // Chờ chuyển đến trang view.php hoặc trực tiếp player
    await page.waitForURL(url => url.href.includes('/mod/scorm/'), { timeout: 20000 });
    console.log(`[${username}] Đã click vào SCORM → URL: ${page.url()}`);

    // 4. Nếu đang ở trang view.php (thường có nút "Enter" hoặc tự load player)
    // Thử click nút launch nếu tồn tại (thường là button hoặc link có text "Enter" / "Bắt đầu")
    const launchButton = page.getByRole('button', { name: /Enter|Bắt đầu|Xem|Launch/i }).first();
    if (await launchButton.isVisible({ timeout: 8000 }).catch(() => false)) {
      await launchButton.click();
      console.log(`[${username}] Đã click nút launch trên trang view.php`);
    }

    // Chờ chuyển sang player thật sự
    await page.waitForURL('**/player.php**', { timeout: 30000 });
    console.log(`[${username}] Đã vào trang player SCORM → URL: ${page.url()}`);

    // 5. Chờ iframe và control panel trong iframe
    const iframeLocator = page.frameLocator('#scorm_object');
    await iframeLocator.locator('body').waitFor({ state: 'visible', timeout: 20000 }).catch(() => {
      console.log(`[${username}] Không thấy iframe #scorm_object`);
    });

    await page.waitForTimeout(6000); // chờ player JS render control bar

    let progress = 'Không xác định';

    // Tìm label tiến độ slide trong iframe
    const slideLabelLocator = iframeLocator.locator('.progressbar__label:not(.progressbar__label_type_time)');

    if (await slideLabelLocator.count() > 0) {
      const ariaLabel = await slideLabelLocator.first().getAttribute('aria-label');
      if (ariaLabel && ariaLabel.includes('/')) {
        progress = ariaLabel.trim();
      } else {
        progress = await slideLabelLocator.first().innerText();
      }
      console.log(`[${username}] Tiến độ slide: ${progress}`);
    } else {
      console.log(`[${username}] Không tìm thấy .progressbar__label trong iframe`);
      // Fallback regex toàn bộ text iframe
      const iframeText = await iframeLocator.locator('body').innerText();
      const match = iframeText.match(/(\d{1,3})\s*\/\s*220/);
      if (match) {
        progress = match[0];
        console.log(`[${username}] Tiến độ (regex fallback): ${progress}`);
      }
    }

    return { success: true, fullName, progress };

  } catch (err) {
    console.error(`[${username}] Lỗi: ${err.message}`);
    return { success: false, error: err.message || 'Lỗi không xác định' };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { performLoginAndGetProgress };