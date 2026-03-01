// file: src/browser.js
require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const config = require('./config');

const IS_DEV = process.env.NODE_ENV === 'development';
const DEFAULT_TOTAL_SLIDES = 220;

// ─── Set speed TimeHooker ────────────────────────────────────────────────────
async function setSpeedIfOnPlayer(page, username) {
  if (!page.url().includes('player.php')) return;
  try {
    const success = await page.evaluate(async (rate) => {
      let attempts = 0;
      while (attempts < 15) {
        if (typeof $hookTimer !== 'undefined' && $hookTimer?.setSpeed) {
          $hookTimer.setSpeed(rate);
          return true;
        }
        await new Promise(r => setTimeout(r, 800));
        attempts++;
      }
      return false;
    }, config.SPEED_RATE);
    if (success) console.log(`[${username}] ⚡ Speed: ${config.SPEED_RATE}x`);
    else console.log(`[${username}] TimeHooker chưa ready`);
  } catch (_) {}
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

// ─── Tìm và click "Phần tiếp theo" ──────────────────────────────────────────
async function clickNextLesson(page, username) {
  try {
    const nextLink = page.locator(
      '#next-activity-link, a.btn.btn-inverse.btn-sm[title*="tiếp theo"], a:has-text("Phần tiếp theo")'
    ).first();
    if (await nextLink.count() > 0 && await nextLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log(`[${username}] Tìm thấy "Phần tiếp theo" → click`);
      await nextLink.click({ force: true });
      return true;
    }
    console.log(`[${username}] Không thấy "Phần tiếp theo" → hết khóa`);
    return false;
  } catch (_) {
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

    // Inject TimeHooker + auto set speed vào mọi frame
    if (fs.existsSync(config.TIMEHOOKER_PATH)) {
      const script = fs.readFileSync(config.TIMEHOOKER_PATH, 'utf8');
      const speedRate = config.SPEED_RATE;
      const autoSpeed = script + `
(function(){
  var _t = 0;
  var _iv = setInterval(function() {
    if (typeof $hookTimer !== 'undefined' && $hookTimer && $hookTimer.setSpeed) {
      $hookTimer.setSpeed(${speedRate});
      clearInterval(_iv);
    } else if (++_t > 50) clearInterval(_iv);
  }, 300);
})();
`;
      await context.addInitScript(autoSpeed);
      console.log(`[${username}] Inject TimeHooker + auto speed ${config.SPEED_RATE}x`);
    }

    const page = await context.newPage();
    page.on('dialog', async dialog => { await dialog.dismiss().catch(() => {}); });

    // ── (1) Đăng nhập ────────────────────────────────────────────────────────
    console.log(`[${username}] Đăng nhập...`);
    await page.goto('http://elearning.vina-link.com.vn/login/index.php', {
      waitUntil: 'networkidle', timeout: 20000,
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
      console.log(`[${username}] === Bài ${currentLesson} ===`);

      // Click bài đầu tiên
      if (currentLesson === 1) {
        const scormLink = page.locator('#module-69 a[href*="mod/scorm/view.php?id=69"]').first();
        await scormLink.waitFor({ state: 'visible', timeout: 10000 });
        await scormLink.click();
      }

      // Xử lý popup gián đoạn nếu có
      try {
        const popupWrapper = page.locator('.moodle-dialogue-wrap.moodle-dialogue-content').first();
        await popupWrapper.waitFor({ state: 'visible', timeout: 8000 });
        const okButton = popupWrapper.locator('input.btn-primary[value="Ok"]').first();
        if (await okButton.count() > 0) {
          await okButton.click({ force: true });
          console.log(`[${username}] Click OK popup gián đoạn`);
        }
        await popupWrapper.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      } catch (_) {}

      // Chờ vào player
      try {
        await page.waitForURL('**/player.php**', { timeout: 45000 });
        console.log(`[${username}] ✓ Vào player bài ${currentLesson}`);
      } catch (_) {
        if (!page.url().includes('player.php')) break;
      }

      // Set speed
      await page.waitForTimeout(4000);
      await setSpeedIfOnPlayer(page, username);

      // ── Vòng lặp học bài hiện tại ────────────────────────────────────────
      // Nhịp 700ms: dismiss popup + force play
      // Nhịp 1500ms: luôn click TIẾP THEO không chờ slide tải xong
      console.log(`[${username}] 🚀 Học bài ${currentLesson} | ${config.SPEED_RATE}x | next mỗi 1.5s`);
      let lastSlide  = 0;
      let stuckCount = 0;
      let loopCount  = 0;
      let lastNextMs = 0;

      while (true) {
        if (!page.url().includes('player.php')) {
          console.log(`[${username}] Rời player bài ${currentLesson}`);
          break;
        }

        const now    = Date.now();
        const doNext = (now - lastNextMs) >= 1500;

        const result = await page.evaluate((shouldNext) => {
          let doc = document;
          const iframe = document.querySelector('#scorm_object') || document.querySelector('iframe');
          if (iframe?.contentDocument) doc = iframe.contentDocument;

          // P1: Dismiss moodle dialog "Kết nối internet" (ngoài iframe)
          let dismissed = false;
          document.querySelectorAll('.moodle-dialogue-bd .confirmation-buttons .btn-primary').forEach(el => {
            const widget = el.closest('.yui3-widget');
            if (!widget || widget.getAttribute('aria-hidden') !== 'true') {
              el.click();
              dismissed = true;
            }
          });
          if (dismissed) return { action: 'dismiss_moodle' };

          // P2: Dismiss message-box trong iframe
          const okBtn = doc.querySelector('.message-box-buttons-panel__window-button');
          if (okBtn) {
            const mb = doc.querySelector('.message-box[role="alertdialog"]');
            if (mb && mb.style.opacity !== '0' && mb.style.display !== 'none') {
              okBtn.click();
              ['mousedown', 'mouseup', 'click'].forEach(type =>
                okBtn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, detail: 1 }))
              );
              return { action: 'dismiss_popup' };
            }
          }

          // P3: Force play — aria-pressed="true" = đang chạy (label "pause")
          const playBtn = doc.querySelector('.universal-control-panel__button_play-pause');
          if (playBtn && playBtn.getAttribute('aria-pressed') !== 'true') {
            playBtn.setAttribute('aria-pressed', 'true');
            playBtn.click();
            return { action: 'force_play' };
          }

          // P4: Click TIẾP THEO — mỗi 1.5s, liên tục, không chờ
          if (shouldNext) {
            const nextBtn = doc.querySelector(
              'button.universal-control-panel__button_next[aria-label="next slide"],' +
              'button.universal-control-panel__button_next'
            );
            if (nextBtn && !nextBtn.disabled && !nextBtn.hasAttribute('disabled') && nextBtn.offsetParent !== null) {
              nextBtn.click();
              ['mousedown', 'mouseup', 'click'].forEach(type =>
                nextBtn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, detail: 1 }))
              );
              return { action: 'next_slide' };
            }
          }

          return { action: 'none' };
        }, doNext).catch(() => ({ action: 'error' }));

        if (doNext) lastNextMs = now;

        if (IS_DEV && result.action !== 'none' && result.action !== 'error') {
          console.log(`[${username}] [DEV] ${result.action} | loop=${loopCount}`);
        }

        // Đọc tiến độ mỗi 10 vòng (~7s) hoặc khi next_slide
        if (result.action === 'next_slide' || loopCount % 10 === 0) {
          const prog = await getSlideProgress(page);
          if (prog) {
            console.log(`[${username}] Bài ${currentLesson} - Slide: ${prog.raw}`);
            if (prog.current >= DEFAULT_TOTAL_SLIDES || prog.current >= prog.total) {
              console.log(`[${username}] ✅ Hoàn thành bài ${currentLesson}!`);
              totalProgress += `Bài ${currentLesson}: ${prog.raw} `;
              break;
            }
            if (prog.current > lastSlide) {
              lastSlide  = prog.current;
              stuckCount = 0;
            } else {
              stuckCount++;
            }
          } else {
            stuckCount++;
          }

          if (stuckCount >= 100) {
            console.log(`[${username}] ⛔ Kẹt bài ${currentLesson} → chuyển bài`);
            break;
          }
        }

        loopCount++;
        await page.waitForTimeout(700);
      }

      // ── Chuyển sang bài tiếp theo ─────────────────────────────────────────
      const hasNext = await clickNextLesson(page, username);
      if (!hasNext) {
        console.log(`[${username}] Không còn bài tiếp theo → kết thúc`);
        break;
      }
      currentLesson++;
      await page.waitForTimeout(5000);
    }

    console.log(`[${username}] 🎉 Xong! ${totalProgress || 'Không xác định'}`);
    return { success: true, fullName, progress: totalProgress || 'Hoàn thành' };

  } catch (err) {
    console.error(`[${username}] Lỗi: ${err.message}`);
    return { success: false, error: err.message || 'Lỗi không xác định' };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { performLoginAndGetProgress };