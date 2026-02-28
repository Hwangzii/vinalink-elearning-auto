// file: src/browser.js
require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const config = require('./config');

const IS_DEV = process.env.NODE_ENV === 'development';

// Tổng slide mỗi bài (có thể khác nhau, nhưng dùng 220 làm mặc định cho bài 1)
const DEFAULT_TOTAL_SLIDES = 220;

// ─── Set speed TimeHooker (chờ ready) ───────────────────────────────────────
async function setSpeedIfOnPlayer(page, username) {
  if (!page.url().includes('player.php')) return;
  try {
    const success = await page.evaluate(async (rate) => {
      let attempts = 0;
      while (attempts < 15) {
        if (typeof $hookTimer !== 'undefined' && $hookTimer?.setSpeed) {
          $hookTimer.setSpeed(rate);
          console.log(`[TimeHooker] ✓ Set ${rate}x`);
          return true;
        }
        await new Promise(r => setTimeout(r, 800));
        attempts++;
      }
      console.log('[TimeHooker] ✗ Không ready');
      return false;
    }, config.SPEED_RATE);

    if (success) {
      console.log(`[${username}] Speed: ${config.SPEED_RATE}x`);
    }
  } catch (err) {
    console.log(`[${username}] Lỗi set speed`);
  }
}

// ─── forcePlayAndNext + auto dismiss popup nhanh ─────────────────────────────
async function forcePlayAndNext(page, username) {
  return page.evaluate(() => {
    let doc = document;
    const iframe = document.querySelector('#scorm_object') || document.querySelector('iframe');
    if (iframe?.contentDocument) doc = iframe.contentDocument;

    // PRIORITY 1: Dismiss Moodle popup "Kết nối internet..." (ngoài iframe)
    let dismissed = false;
    document.querySelectorAll(
      '.moodle-dialogue-wrap, .moodle-dialogue-base, .confirmation-dialogue'
    ).forEach(container => {
      if (container.offsetParent === null) return;

      const okBtn = container.querySelector('input.btn-primary[value="Ok"]');
      if (okBtn) {
        okBtn.click();
        dismissed = true;
        return;
      }

      const overlay = document.querySelector('.yui3-widget-mask, .moodle-dialogue-lightbox');
      if (overlay) {
        overlay.click();
        dismissed = true;
      }
    });
    if (dismissed) return { action: 'dismiss_moodle' };

    // PRIORITY 2: Dismiss message-box trong iframe
    const okButton = doc.querySelector('.message-box-buttons-panel__window-button');
    if (okButton) {
      const messageBox = doc.querySelector('.message-box[role="alertdialog"]');
      if (messageBox && messageBox.style.opacity !== '0' && messageBox.style.display !== 'none') {
        okButton.click();
        return { action: 'dismiss_popup' };
      }
    }

    // PRIORITY 3: Force Play
    const playBtn = doc.querySelector('.universal-control-panel__button_play-pause');
    if (playBtn && playBtn.getAttribute('aria-pressed') !== 'true') {
      playBtn.click();
      return { action: 'force_play' };
    }

    // PRIORITY 4: Auto Next Slide
    const nextBtn = doc.querySelector('.universal-control-panel__button_next:not([disabled])');
    if (nextBtn && nextBtn.offsetParent !== null) {
      nextBtn.click();
      return { action: 'next_slide' };
    }

    return { action: 'none' };
  }).catch(err => {
    console.log(`[${username}] Lỗi forcePlayAndNext: ${err.message}`);
    return { action: 'error' };
  });
}

// ─── Đọc tiến độ slide ───────────────────────────────────────────────────────
async function getSlideProgress(page) {
  return page.evaluate(() => {
    let doc = document;
    const iframe = document.querySelector('#scorm_object') || document.querySelector('iframe');
    if (iframe?.contentDocument) doc = iframe.contentDocument;

    const label = doc.querySelector('.progressbar__label');
    if (label) {
      const text = label.getAttribute('aria-label') || label.innerText || '';
      const m = text.match(/(\d+)\s*[\/|]\s*(\d+)/);
      if (m) return { current: parseInt(m[1]), total: parseInt(m[2]), raw: text.trim() };
    }
    return null;
  }).catch(() => null);
}

// ─── Tìm và click "Phần tiếp theo" nếu có ────────────────────────────────────
async function clickNextLesson(page, username) {
  try {
    const nextLink = page.locator('#next-activity-link, a.btn.btn-inverse.btn-sm[title*="tiếp theo"], a:has-text("Phần tiếp theo")').first();
    if (await nextLink.count() > 0 && await nextLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log(`[${username}] Tìm thấy "Phần tiếp theo" → click để chuyển bài`);
      await nextLink.click({ force: true });
      return true;
    }
    console.log(`[${username}] Không thấy "Phần tiếp theo" → có thể hết khóa`);
    return false;
  } catch (err) {
    console.log(`[${username}] Lỗi tìm "Phần tiếp theo": ${err.message}`);
    return false;
  }
}

// ─── Hàm chính ───────────────────────────────────────────────────────────────
async function performLoginAndGetProgress(username, password) {
  let browser;
  try {
    browser = await chromium.launch({
      headless: !IS_DEV,
      slowMo: IS_DEV ? 500 : 0,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-infobars',
      ],
    });

    if (IS_DEV) console.log(`[DEV] headless=false | slowMo=500ms`);

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    // Inject TimeHooker + auto set speed
    if (fs.existsSync(config.TIMEHOOKER_PATH)) {
      const script = fs.readFileSync(config.TIMEHOOKER_PATH, 'utf8');
      const autoSpeed = script + `
        (function(){
          var attempts = 0;
          var iv = setInterval(() => {
            if (typeof $hookTimer !== 'undefined' && $hookTimer?.setSpeed) {
              $hookTimer.setSpeed(${config.SPEED_RATE});
              console.log('[TimeHooker] Set ${config.SPEED_RATE}x');
              clearInterval(iv);
            }
            if (++attempts > 20) clearInterval(iv);
          }, 800);
        })();
      `;
      await context.addInitScript(autoSpeed);
      console.log(`[${username}] Inject TimeHooker + auto speed ${config.SPEED_RATE}x`);
    }

    const page = await context.newPage();
    page.on('dialog', async dialog => {
      console.log(`[${username}] Dialog: ${dialog.message()}`);
      await dialog.dismiss().catch(() => {});
    });

    // ── (1) Đăng nhập ────────────────────────────────────────────────────────
    console.log(`[${username}] Đăng nhập...`);
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
    console.log(`[${username}] ✓ Đăng nhập → ${fullName}`);

    // ── (2) Vào khóa học ─────────────────────────────────────────────────────
    console.log(`[${username}] Click "Đào tạo cơ bản"...`);
    const courseLink = page.locator(
      'a.font-weight-400.blue-grey-600.font-size-18[href*="course/view.php?id=10"]'
    ).first();
    await courseLink.waitFor({ state: 'visible', timeout: 10000 });
    await courseLink.click();
    await page.waitForURL('**/course/view.php?id=10**', { timeout: 15000 });
    console.log(`[${username}] ✓ Vào khóa học`);

    // ── Loop học tất cả bài ──────────────────────────────────────────────────
    let currentLesson = 1;
    let totalProgress = '';

    while (true) {
      console.log(`[${username}] Bắt đầu bài ${currentLesson}...`);

      // ── Click bài hiện tại (bài đầu tiên hoặc bài tiếp theo) ──────────────
      if (currentLesson === 1) {
        console.log(`[${username}] Click bài 1...`);
        const scormLink = page.locator('#module-69 a[href*="mod/scorm/view.php?id=69"]').first();
        await scormLink.waitFor({ state: 'visible', timeout: 10000 });
        await scormLink.click();
      }

      // Xử lý popup nhanh
      const popupWrapper = page.locator('.moodle-dialogue-wrap.moodle-dialogue-content').first();
      try {
        await popupWrapper.waitFor({ state: 'visible', timeout: 8000 });
        console.log(`[${username}] Popup gián đoạn → xử lý`);

        const okButton = popupWrapper.locator('input.btn-primary[value="Ok"]').first();
        if (await okButton.count() > 0) {
          await okButton.click({ force: true });
          console.log(`[${username}] Click OK popup`);
        } else {
          await page.evaluate(() => {
            const overlay = document.querySelector('.yui3-widget-mask, .moodle-dialogue-lightbox');
            if (overlay) overlay.click();
          });
          console.log(`[${username}] Click overlay đóng popup`);
        }

        await popupWrapper.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      } catch (e) {
        console.log(`[${username}] Không thấy popup`);
      }

      // Chờ vào player
      console.log(`[${username}] Chờ vào player bài ${currentLesson}...`);
      try {
        await page.waitForURL('**/player.php**', { timeout: 45000 });
        console.log(`[${username}] ✓ Vào player bài ${currentLesson} → ${page.url()}`);
      } catch (e) {
        console.log(`[${username}] Timeout chờ player`);
        console.log(`[${username}] URL hiện tại: ${page.url()}`);
        if (page.url().includes('player.php')) {
          console.log(`[${username}] Fallback: đã vào player`);
        } else {
          break; // không vào được → dừng
        }
      }

      // Set speed
      await page.waitForTimeout(4000);
      await setSpeedIfOnPlayer(page, username);

      // ── Vòng lặp học bài hiện tại ──────────────────────────────────────────
      console.log(`[${username}] Học bài ${currentLesson} (tua ${config.SPEED_RATE}x)...`);
      let lastSlide = 0;
      let stuckCount = 0;
      let loopCount = 0;

      while (true) {
        if (!page.url().includes('player.php')) {
          console.log(`[${username}] Rời player bài ${currentLesson}`);
          break;
        }

        const result = await forcePlayAndNext(page, username);

        if (result.action === 'next_slide' || loopCount % 5 === 0) {
          const prog = await getSlideProgress(page);
          if (prog) {
            console.log(`[${username}] Bài ${currentLesson} - Slide: ${prog.raw}`);
            if (prog.current >= DEFAULT_TOTAL_SLIDES || prog.current >= prog.total) {
              console.log(`[${username}] Hoàn thành bài ${currentLesson}!`);
              totalProgress += `Bài ${currentLesson}: ${prog.raw} `;
              break;
            }
            if (prog.current > lastSlide) {
              lastSlide = prog.current;
              stuckCount = 0;
            } else {
              stuckCount++;
            }
          } else {
            stuckCount++;
          }

          if (stuckCount >= 100) {
            console.log(`[${username}] Kẹt bài ${currentLesson} → chuyển bài`);
            break;
          }
        }

        loopCount++;
        await page.waitForTimeout(1000); // 1 giây/lần next
      }

      // ── Chuyển sang bài tiếp theo ──────────────────────────────────────────
      const hasNext = await clickNextLesson(page, username);
      if (!hasNext) {
        console.log(`[${username}] Không còn bài tiếp theo → kết thúc khóa`);
        break;
      }

      currentLesson++;
      await page.waitForTimeout(5000); // chờ chuyển bài
    }

    console.log(`[${username}] Hoàn thành toàn bộ khóa! Tiến độ: ${totalProgress || 'Không xác định'}`);
    return { success: true, fullName, progress: totalProgress || 'Hoàn thành' };

  } catch (err) {
    console.error(`[${username}] Lỗi: ${err.message}`);
    return { success: false, error: err.message || 'Lỗi không xác định' };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { performLoginAndGetProgress };