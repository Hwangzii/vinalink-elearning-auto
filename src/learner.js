// file: src/learner.js
// Trách nhiệm: vòng lặp học SCORM
//   - Set speed TimeHooker
//   - Dismiss popup / dialog
//   - Force play, click TIẾP THEO
//   - Đọc tiến độ, phát hiện hoàn thành / kẹt
//   - Click "Phần tiếp theo" để chuyển bài
const config = require('./config');
const { sendCompletionMessage } = require('./messenger');
const { COL, STATUS, setCol } = require('./columns');

const LESSON_SEND_MSG      = 3;
const IS_DEV               = process.env.NODE_ENV === 'development';
const DEFAULT_TOTAL_SLIDES = 220;

// ─── Timing constants ─────────────────────────────────────────────────────────
// LOOP_INTERVAL: khoảng cách giữa 2 vòng lặp
//   200ms (cũ) → 300ms: giảm 33% số lần page.evaluate() mỗi giây
//   Tác động: mỗi browser từ 5 → 3.3 evaluate/s; 5 browsers: 25 → 16.5 calls/s
const LOOP_INTERVAL_MS  = 300;
// NEXT_INTERVAL: tần suất click "Tiếp theo" — giữ nguyên 500ms để không bỏ sót slide
const NEXT_INTERVAL_MS  = 500;
// CHECK_PROGRESS_EVERY: đọc tiến độ sau mỗi N vòng
//   10 (cũ) → 15: giảm thêm 33% số lần getProgress evaluate
//   Ở 300ms/vòng: check mỗi 15*300 = 4.5s (chấp nhận được)
const CHECK_PROGRESS_EVERY = 15;

// ─── stepFn được serialize 1 lần duy nhất (không tạo lại mỗi vòng lặp) ───────
// page.evaluate() nhận string → compile 1 lần trong browser context
// Truyền shouldNext qua argument thay vì closure để tái sử dụng được
const STEP_FN_STR = `(shouldNext) => {
  let doc = document;
  const iframe = document.querySelector('#scorm_object') || document.querySelector('iframe');
  if (iframe?.contentDocument) doc = iframe.contentDocument;

  // P1: Dismiss dialog "Kết nối internet" (Moodle, ngoài iframe)
  let dismissed = false;
  document.querySelectorAll('.moodle-dialogue-bd .confirmation-buttons .btn-primary').forEach(el => {
    const widget = el.closest('.yui3-widget');
    if (!widget || widget.getAttribute('aria-hidden') !== 'true') {
      el.click();
      dismissed = true;
    }
  });
  if (dismissed) return { action: 'dismiss_moodle' };

  // P2: Dismiss message-box bên trong iframe
  const okBtn = doc.querySelector('.message-box-buttons-panel__window-button');
  if (okBtn) {
    const mb = doc.querySelector('.message-box[role="alertdialog"]');
    if (mb && mb.style.opacity !== '0' && mb.style.display !== 'none') {
      okBtn.click();
      ['mousedown', 'mouseup', 'click'].forEach(t =>
        okBtn.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, detail: 1 }))
      );
      return { action: 'dismiss_popup' };
    }
  }

  // P3: Force play (aria-pressed="true" = đang chạy)
  const playBtn = doc.querySelector('.universal-control-panel__button_play-pause');
  if (playBtn && playBtn.getAttribute('aria-pressed') !== 'true') {
    playBtn.setAttribute('aria-pressed', 'true');
    playBtn.click();
    return { action: 'force_play' };
  }

  // P4: Click TIẾP THEO
  if (shouldNext) {
    const nextBtn = doc.querySelector(
      'button.universal-control-panel__button_next[aria-label="next slide"],' +
      'button.universal-control-panel__button_next'
    );
    if (nextBtn && !nextBtn.disabled && !nextBtn.hasAttribute('disabled') && nextBtn.offsetParent !== null) {
      nextBtn.click();
      ['mousedown', 'mouseup', 'click'].forEach(t =>
        nextBtn.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, detail: 1 }))
      );
      return { action: 'next_slide' };
    }
  }

  return { action: 'none' };
}`;

// Compile thành Function object 1 lần — tránh tạo mới mỗi 300ms
const STEP_FN = new Function(`return ${STEP_FN_STR}`)();

// ─── Set speed TimeHooker (polling đến khi ready) ────────────────────────────
async function setSpeed(page, username) {
  if (!page.url().includes('player.php')) return;
  try {
    const ok = await page.evaluate(async (rate) => {
      for (let i = 0; i < 15; i++) {
        if (typeof $hookTimer !== 'undefined' && $hookTimer?.setSpeed) {
          $hookTimer.setSpeed(rate);
          return true;
        }
        await new Promise(r => setTimeout(r, 200));
      }
      return false;
    }, config.SPEED_RATE);
    console.log(ok
      ? `[${username}] ⚡ Speed: ${config.SPEED_RATE}x`
      : `[${username}] ⚠ TimeHooker chưa sẵn sàng`
    );
  } catch (_) {}
}

// ─── Đọc tiến độ slide ───────────────────────────────────────────────────────
async function getProgress(page) {
  return page.evaluate(() => {
    let doc = document;
    const iframe = document.querySelector('#scorm_object') || document.querySelector('iframe');
    if (iframe?.contentDocument) doc = iframe.contentDocument;
    const label = doc.querySelector('.progressbar__label');
    if (!label) return null;
    const text = label.getAttribute('aria-label') || label.innerText || '';
    const m = text.match(/(\d+)\s*[\/|]\s*(\d+)/);
    return m ? { current: +m[1], total: +m[2], raw: text.trim() } : null;
  }).catch(() => null);
}

// ─── Chuyển sang bài tiếp theo ───────────────────────────────────────────────
async function goNextLesson(page, username) {
  try {
    const link = page.locator(
      '#next-activity-link,' +
      'a.btn.btn-inverse.btn-sm[title*="tiếp theo"],' +
      'a:has-text("Phần tiếp theo")'
    ).first();
    if (await link.count() > 0 && await link.isVisible({ timeout: 3000 }).catch(() => false)) {
      await link.click({ force: true });
      console.log(`[${username}] → Chuyển sang bài tiếp theo`);
      return true;
    }
  } catch (_) {}
  console.log(`[${username}] Không còn bài tiếp theo → kết thúc khóa`);
  return false;
}

// ─── Vòng lặp học 1 bài ──────────────────────────────────────────────────────
async function learnOneLesson(page, username, lessonNo, row) {
  console.log(`[${username}] 🚀 Học bài ${lessonNo} | ${config.SPEED_RATE}x`);

  // Cập nhật trạng thái ngay khi bắt đầu bài
  if (row) {
    setCol(row, COL.status, `Đang học bài ${lessonNo}...`);
    await row.save().catch(() => {});
  }

  let lastSlide      = 0;
  let stuckCount     = 0;
  let loopCount      = 0;
  let lastNextMs     = 0;

  while (true) {
    if (!page.url().includes('player.php')) {
      console.log(`[${username}] Rời player bài ${lessonNo}`);
      return 'left';
    }

    const now    = Date.now();
    const doNext = (now - lastNextMs) >= NEXT_INTERVAL_MS;

    // Dùng STEP_FN đã compile sẵn — không tạo object mới mỗi vòng
    const result = await page.evaluate(STEP_FN, doNext).catch(() => ({ action: 'error' }));
    if (doNext) lastNextMs = now;

    if (IS_DEV && !['none', 'error'].includes(result.action)) {
      console.log(`[${username}] [DEV] ${result.action} | vòng=${loopCount}`);
    }

    // Đọc tiến độ mỗi CHECK_PROGRESS_EVERY vòng hoặc khi next_slide
    if (result.action === 'next_slide' || loopCount % CHECK_PROGRESS_EVERY === 0) {
      const prog = await getProgress(page);
      if (prog) {
        console.log(`[${username}] Bài ${lessonNo} — Slide: ${prog.raw}`);
        if (prog.current >= DEFAULT_TOTAL_SLIDES || prog.current >= prog.total) {
          console.log(`[${username}] ✅ Hoàn thành bài ${lessonNo}!`);
          return prog.raw;
        }
        stuckCount = prog.current > lastSlide ? (lastSlide = prog.current, 0) : stuckCount + 1;
      } else {
        stuckCount++;
      }

      // stuck threshold tăng nhẹ vì check interval dài hơn (15 vòng * 300ms = 4.5s/check)
      // 100 checks * 4.5s = 450s timeout → hợp lý
      if (stuckCount >= 100) {
        console.log(`[${username}] ⛔ Kẹt bài ${lessonNo} slide ${lastSlide} → chuyển bài`);
        return `kẹt tại ${lastSlide}`;
      }
    }

    loopCount++;
    await page.waitForTimeout(LOOP_INTERVAL_MS);
  }
}

// ─── Học toàn bộ bài trong khóa ──────────────────────────────────────────────
async function learnAllLessons(page, username, row) {
  let lesson  = 1;
  let summary = '';

  while (true) {
    console.log(`[${username}] === Bài ${lesson} ===`);

    if (!page.url().includes('player.php')) {
      try {
        await page.waitForURL('**/player.php**', { timeout: 45000 });
        console.log(`[${username}] ✓ Vào player bài ${lesson}`);
      } catch (_) {
        if (!page.url().includes('player.php')) break;
      }
    }

    await page.waitForTimeout(1500);
    await setSpeed(page, username);

    const result = await learnOneLesson(page, username, lesson, row);
    if (typeof result === 'string' && result !== 'left') {
      summary += `Bài ${lesson}: ${result} | `;
    }

    if (lesson === LESSON_SEND_MSG && typeof result === 'string' && result !== 'left') {
      await sendCompletionMessage(page, username, row);
    }

    const hasNext = await goNextLesson(page, username);
    if (!hasNext) break;

    lesson++;
    await page.waitForTimeout(2000);
  }

  return summary || 'Hoàn thành';
}

module.exports = { learnAllLessons };