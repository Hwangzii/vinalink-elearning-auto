// file: src/navigator.js
// Trách nhiệm: điều hướng từng bước trên trình duyệt
//   (1) Đăng nhập
//   (2) Vào khóa học "Đào tạo cơ bản"
//   (3) Click bài SCORM → chờ player.php
// Không chứa logic học — uỷ quyền cho learner.js
const { learnAllLessons } = require('./learner');

async function navigate(page, username, password) {

  // ── (1) Đăng nhập ──────────────────────────────────────────────────────────
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

  // ── (2) Vào khóa học ───────────────────────────────────────────────────────
  // Dùng class đặc trưng để tránh nhầm với link sidebar cùng href
  console.log(`[${username}] Vào "Đào tạo cơ bản"...`);
  const courseLink = page.locator(
    'a.font-weight-400.blue-grey-600.font-size-18[href*="course/view.php?id=10"]'
  ).first();
  await courseLink.waitFor({ state: 'visible', timeout: 10000 });
  await courseLink.click();
  await page.waitForURL('**/course/view.php?id=10**', { timeout: 15000 });
  console.log(`[${username}] ✓ Vào khóa học`);

  // ── (3) Click bài 1 SCORM ──────────────────────────────────────────────────
  // #module-69 giới hạn scope để tránh match 2 thẻ <a> cùng href
  console.log(`[${username}] Click bài "1. Pháp luật về bán hàng đa cấp"...`);
  const scormLink = page.locator(
    '#module-69 a[href*="mod/scorm/view.php?id=69"]'
  ).first();
  await scormLink.waitFor({ state: 'visible', timeout: 10000 });
  await scormLink.click();

  // Xử lý popup gián đoạn nếu xuất hiện trước khi vào player
  await dismissPopupIfAny(page, username);

  // ── (4) Chờ vào player.php ─────────────────────────────────────────────────
  try {
    await page.waitForURL('**/player.php**', { timeout: 45000 });
    console.log(`[${username}] ✓ Vào player → ${page.url()}`);
  } catch (_) {
    if (!page.url().includes('player.php')) {
      return { success: false, error: 'Không vào được player.php' };
    }
  }

  // ── Uỷ quyền vòng lặp học cho learner ─────────────────────────────────────
  const progress = await learnAllLessons(page, username);
  return { success: true, fullName, progress };
}

// Đóng popup "Kết nối gián đoạn" nếu có khi mới vào bài
async function dismissPopupIfAny(page, username) {
  try {
    const popup = page.locator('.moodle-dialogue-wrap.moodle-dialogue-content').first();
    await popup.waitFor({ state: 'visible', timeout: 3000 });
    const okBtn = popup.locator('input.btn-primary[value="Ok"]').first();
    if (await okBtn.count() > 0) {
      await okBtn.click({ force: true });
      console.log(`[${username}] Đóng popup gián đoạn`);
    }
    await popup.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
  } catch (_) {
    // Không có popup → bình thường, bỏ qua
  }
}

module.exports = { navigate };