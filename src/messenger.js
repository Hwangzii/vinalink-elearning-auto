// file: src/messenger.js
// Trách nhiệm: sau khi học xong bài 3
//   1. Quay về trang khóa học
//   2. Click "Đào Tạo Viên" → tab mới
//   3. Kiểm tra đã nhắn chưa → nếu chưa thì nhắn
//   4. Set STATUS = 'Chưa thi' vào Google Sheet
//   5. Đăng xuất tài khoản
const { COL, STATUS, setCol } = require('./columns');

const MSG_TEXT = 'Tôi đã xem hết các video và không có câu hỏi thắc mắc nào. Mong đào tạo viên xác nhận cho tôi vào thi';
const MSG_URL  = 'http://elearning.vina-link.com.vn/message/index.php?id=187';

// ── Hàm chính ─────────────────────────────────────────────────────────────────
// row: google-spreadsheet row object (để ghi STATUS)
async function sendCompletionMessage(page, username, row) {
  console.log(`[${username}] 📨 Bắt đầu gửi tin nhắn đào tạo viên...`);

  try {
    // ── Bước 1: Quay về trang khóa học ───────────────────────────────────────
    console.log(`[${username}] Bước 1: Quay về trang khóa học...`);
    await page.goto('http://elearning.vina-link.com.vn/course/view.php?id=10', {
      waitUntil: 'domcontentloaded', timeout: 20000,
    });
    await page.waitForTimeout(1500); // chờ page render
    console.log(`[${username}] ✓ Đã về trang khóa học`);

    // ── Bước 2: Click "Đào Tạo Viên" → bắt tab mới ───────────────────────────
    console.log(`[${username}] Bước 2: Tìm link "Đào Tạo Viên"...`);
    // Thử nhiều selector: href chính xác, text, hoặc href một phần
    const dtvLink = page.locator([
      `a[href="${MSG_URL}"]`,
      'a:has-text("Đào Tạo Viên")',
      'a:has-text("Đào tạo viên")',
      `a[href*="message/index.php?id=187"]`,
    ].join(', ')).first();

    // Scroll xuống để đảm bảo link visible (có thể nằm cuối trang)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await dtvLink.waitFor({ state: 'visible', timeout: 15000 });

    const [msgPage] = await Promise.all([
      page.context().waitForEvent('page', { timeout: 15000 }),
      dtvLink.click(),
    ]);
    await msgPage.waitForLoadState('domcontentloaded', { timeout: 15000 });
    await msgPage.waitForTimeout(2000); // chờ messages render
    console.log(`[${username}] ✓ Tab tin nhắn mở: ${msgPage.url()}`);

    // ── Bước 3: Kiểm tra đã nhắn chưa ────────────────────────────────────────
    console.log(`[${username}] Bước 3: Kiểm tra lịch sử tin nhắn...`);
    const alreadySent = await msgPage.evaluate((msgText) => {
      const msgs = document.querySelectorAll('[data-region="content-message-container"] .chat-content p');
      for (const p of msgs) {
        if (p.textContent.trim() === msgText) return true;
      }
      return false;
    }, MSG_TEXT);

    if (alreadySent) {
      console.log(`[${username}] ℹ️ Đã gửi tin nhắn trước đó → không gửi lại`);
      await msgPage.close().catch(() => {});
    } else {
      // ── Bước 4: Nhập tin nhắn ──────────────────────────────────────────────
      console.log(`[${username}] Bước 4: Nhập tin nhắn...`);
      const textarea = msgPage.locator('[data-region="send-message-txt"]').first();
      await textarea.waitFor({ state: 'visible', timeout: 10000 });
      await textarea.click();
      await textarea.fill(MSG_TEXT);

      // ── Bước 5: Gửi ────────────────────────────────────────────────────────
      console.log(`[${username}] Bước 5: Gửi tin nhắn...`);
      const sendBtn = msgPage.locator('[data-action="send-message"]').first();
      await sendBtn.waitFor({ state: 'visible', timeout: 5000 });
      await sendBtn.click();

      // Xác nhận tin nhắn xuất hiện trong DOM
      await msgPage.waitForFunction((msgText) => {
        const msgs = document.querySelectorAll('[data-region="content-message-container"] .chat-content p');
        for (const p of msgs) {
          if (p.textContent.trim() === msgText) return true;
        }
        return false;
      }, MSG_TEXT, { timeout: 15000 });

      console.log(`[${username}] ✅ Gửi tin nhắn thành công!`);
      await msgPage.close().catch(() => {});
    }

    // ── Bước 6: Set STATUS = 'Chưa thi' vào Google Sheet ─────────────────────
    if (row) {
      setCol(row, COL.status, STATUS.done);
      await row.save();
      console.log(`[${username}] ✓ Cập nhật trạng thái: "${STATUS.done}"`);
    }

  } catch (err) {
    console.error(`[${username}] ❌ Lỗi gửi tin nhắn: ${err.message}`);
  }
}

module.exports = { sendCompletionMessage };