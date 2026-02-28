// file: src/browser.js
const { chromium } = require('playwright');
const fs = require('fs');
const config = require('./config');

const IS_DEV = process.env.NODE_ENV === 'development';

// ─── Inject speed chỉ khi đúng URL player ────────────────────────────────────
async function setSpeedIfOnPlayer(page) {
  if (!page.url().includes('player.php')) return;
  try {
    await page.evaluate((rate) => {
      if (typeof $hookTimer !== 'undefined' && $hookTimer?.setSpeed) {
        $hookTimer.setSpeed(rate);
      }
      const iframe = document.querySelector('#scorm_object');
      if (iframe?.contentWindow?.$hookTimer?.setSpeed) {
        iframe.contentWindow.$hookTimer.setSpeed(rate);
      }
    }, config.SPEED_RATE);
  } catch (_) {}
}

// ─── forcePlayAndNext ─────────────────────────────────────────────────────────
async function forcePlayAndNext(page) {
  return page.evaluate(() => {
    let doc = document;
    const iframe = document.querySelector('#scorm_object') || document.querySelector('iframe');
    if (iframe?.contentDocument) doc = iframe.contentDocument;

    // PRIORITY 1: Dismiss moodle-dialogue "Kết nối internet..." (ngoài iframe)
    const moodleDialogs = document.querySelectorAll(
      '.moodle-dialogue-base[aria-hidden="false"] .btn-primary, ' +
      '.moodle-dialogue-wrap .confirmation-buttons .btn-primary, ' +
      '.moodle-dialogue-bd .btn-primary'
    );
    if (moodleDialogs.length > 0) {
      moodleDialogs.forEach(el => {
        const dialog = el.closest('.moodle-dialogue-base, .moodle-dialogue-wrap');
        const isHidden = dialog && (
          dialog.getAttribute('aria-hidden') === 'true' ||
          dialog.style.display === 'none'
        );
        if (!isHidden) el.click();
      });
    }

    // PRIORITY 2: Click OK popup bên trong iframe (message-box)
    const okButton = doc.querySelector('.message-box-buttons-panel__window-button');
    if (okButton) {
      const messageBox = doc.querySelector('.message-box[role="alertdialog"]');
      if (messageBox &&
          messageBox.style.opacity !== '0' &&
          messageBox.style.display !== 'none') {
        okButton.click();
        ['mousedown', 'mouseup', 'click'].forEach(type => {
          okButton.dispatchEvent(new MouseEvent(type, {
            bubbles: true, cancelable: true, view: window, detail: 1,
          }));
        });
        return { action: 'dismiss_popup' };
      }
    }

    // PRIORITY 3: Force Play
    const playBtn = doc.querySelector('.universal-control-panel__button_play-pause');
    if (playBtn && playBtn.getAttribute('aria-pressed') !== 'true') {
      playBtn.setAttribute('aria-pressed', 'true');
      playBtn.click();
      return { action: 'play' };
    }

    // PRIORITY 4: Auto Next Slide
    const nextBtn = doc.querySelector('.universal-control-panel__button_next');
    if (nextBtn && !nextBtn.disabled && !nextBtn.hasAttribute('disabled') &&
        nextBtn.offsetParent !== null) {
      nextBtn.click();
      ['mousedown', 'mouseup', 'click'].forEach(type => {
        nextBtn.dispatchEvent(new MouseEvent(type, {
          bubbles: true, cancelable: true, view: window, detail: 1,
        }));
      });
      return { action: 'next_slide' };
    }

    return { action: 'none' };
  }).catch(() => ({ action: 'error' }));
}

// ─── Đọc tiến độ slide ───────────────────────────────────────────────────────
async function getSlideProgress(page) {
  return page.evaluate(() => {
    let doc = document;
    const iframe = document.querySelector('#scorm_object') || document.querySelector('iframe');
    if (iframe?.contentDocument) doc = iframe.contentDocument;

    const labels = doc.querySelectorAll('.progressbar__label');
    for (const label of labels) {
      const text = label.getAttribute('aria-label') || label.innerText || '';
      const m = text.match(/(\d+)\s*[\/|]\s*(\d+)/);
      if (m) return { current: parseInt(m[1]), total: parseInt(m[2]), raw: text.trim() };
    }
    return null;
  }).catch(() => null);
}

// ─── Hàm chính ───────────────────────────────────────────────────────────────
async function performLoginAndGetProgress(username, password) {
  let browser;
  try {
    browser = await chromium.launch({
      headless: !IS_DEV,
      slowMo: IS_DEV ? config.DEV_SLOW_MO : 0,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-infobars',
      ],
    });

    if (IS_DEV) {
      console.log(`[DEV] headless=false | slowMo=${config.DEV_SLOW_MO}ms`);
    }

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    // Inject TimerHooker vào MỌI frame (context-level → cả iframe scorm)
    if (fs.existsSync(config.TIMEHOOKER_PATH)) {
      const script = fs.readFileSync(config.TIMEHOOKER_PATH, 'utf8');
      const autoSpeed = `
${script}
(function(){
  var _t = 0;
  var _iv = setInterval(function() {
    if (typeof $hookTimer !== 'undefined' && $hookTimer && $hookTimer.setSpeed) {
      $hookTimer.setSpeed(${config.SPEED_RATE});
      clearInterval(_iv);
    } else if (++_t > 60) {
      clearInterval(_iv);
    }
  }, 100);
})();
`;
      await context.addInitScript(autoSpeed);
      console.log(`[${username}] TimerHooker injected | SPEED_RATE=${config.SPEED_RATE}×`);
    }

    const page = await context.newPage();
    page.on('dialog', async d => { try { await d.dismiss(); } catch (_) {} });

    // ── 1. Đăng nhập ─────────────────────────────────────────────────────────
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
    console.log(`[${username}] ✓ Đăng nhập thành công → ${fullName}`);

    // ── 2. Vào khóa học ───────────────────────────────────────────────────────
    await page.goto('http://elearning.vina-link.com.vn/', {
      waitUntil: 'networkidle', timeout: 15000,
    });
    await page.getByRole('link', { name: 'Đào tạo cơ bản' }).first()
      .waitFor({ state: 'visible', timeout: 10000 });
    await page.getByRole('link', { name: 'Đào tạo cơ bản' }).first().click();
    await page.waitForURL('**/course/view.php?id=10**', { timeout: 15000 });

    // ── 3. Click SCORM ────────────────────────────────────────────────────────
    await page.getByRole('link', { name: '1. Pháp luật về bán hàng đa cấp' }).first()
      .waitFor({ state: 'visible', timeout: 10000 });
    await page.getByRole('link', { name: '1. Pháp luật về bán hàng đa cấp' }).first().click();
    await page.waitForURL(url => url.href.includes('/mod/scorm/'), { timeout: 20000 });

    // ── 4. Nút launch (nếu có) ────────────────────────────────────────────────
    const launchBtn = page.getByRole('button', { name: /Enter|Bắt đầu|Xem|Launch/i }).first();
    if (await launchBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
      await launchBtn.click();
    }
    await page.waitForURL('**/player.php**', { timeout: 30000 });
    console.log(`[${username}] ✓ Vào player → ${page.url()}`);

    // ── 5. Chờ iframe render + set speed ──────────────────────────────────────
    await page.waitForTimeout(config.PLAYER_READY_MS);
    await setSpeedIfOnPlayer(page);
    console.log(`[${username}] ⚡ SPEED_RATE=${config.SPEED_RATE}× | LOOP=${config.LOOP_INTERVAL}ms | MAX_STUCK=${config.MAX_STUCK}`);

    // ── 6. Vòng lặp học liên tục ──────────────────────────────────────────────
    let lastSlide  = 0;
    let stuckCount = 0;
    let loopCount  = 0;
    console.log(`[${username}] 🚀 Bắt đầu vòng lặp (${config.TOTAL_SLIDES} slides)...`);

    while (true) {
      if (!page.url().includes('player.php')) {
        console.log(`[${username}] ⚠ Rời khỏi player URL → chờ...`);
        await page.waitForTimeout(3000);
        continue;
      }

      const result = await forcePlayAndNext(page);

      loopCount++;

      // Log action khi dev hoặc khi có sự kiện quan trọng
      if (IS_DEV && result.action !== 'none' && result.action !== 'error') {
        console.log(`[${username}] [DEV] action=${result.action} | loop=${loopCount}`);
      }

      // Đọc tiến độ mỗi 10 vòng hoặc khi next_slide / dismiss
      if (loopCount % 10 === 0 || result.action === 'next_slide' || result.action === 'dismiss_popup') {
        const prog = await getSlideProgress(page);
        if (prog) {
          if (result.action === 'next_slide' || loopCount % 50 === 0) {
            console.log(`[${username}] 📊 Slide: ${prog.raw}`);
          }
          if (prog.current >= config.TOTAL_SLIDES || prog.current >= prog.total) {
            console.log(`[${username}] ✅ Hoàn thành! ${prog.raw}`);
            return { success: true, fullName, progress: prog.raw };
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

        if (stuckCount >= config.MAX_STUCK) {
          console.log(`[${username}] ⛔ Kẹt tại slide ${lastSlide} → dừng`);
          const finalProg = await getSlideProgress(page);
          return {
            success: true,
            fullName,
            progress: finalProg ? finalProg.raw : `${lastSlide}/${config.TOTAL_SLIDES} (kẹt)`,
          };
        }
      }

      await page.waitForTimeout(config.LOOP_INTERVAL);
    }

  } catch (err) {
    console.error(`[${username}] Lỗi: ${err.message}`);
    return { success: false, error: err.message || 'Lỗi không xác định' };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { performLoginAndGetProgress };