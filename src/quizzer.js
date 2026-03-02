// file: src/quizzer.js
// Trách nhiệm: thực hiện bài thi trắc nghiệm sau khi đăng nhập
//   B1: Vào khóa học
//   B2: Click "4. Làm bài trắc nghiệm đào tạo cơ bản"
//   B3: Click "Bắt đầu làm bài" → xử lý popup confirm
//   B4: Xác nhận bắt đầu trong popup
//   B5: Trả lời từng câu hỏi dựa vào quiz-data.js
//   B6: Nộp bài → xác nhận → log điểm
//   B7: Quay về khóa học → click "5. Bản cam kết..."
const { findAnswer, findMatchingOption } = require('./quiz-data');
const { COL, STATUS, setCol } = require('./columns');

const COURSE_URL = 'http://elearning.vina-link.com.vn/course/view.php?id=10';
const QUIZ_URL   = 'http://elearning.vina-link.com.vn/mod/quiz/view.php?id=70';

async function runQuiz(page, username, row) {
  console.log(`[${username}] 🎯 Bắt đầu thi trắc nghiệm...`);

  // Cập nhật trạng thái "Đang thi..."
  if (row) {
    setCol(row, COL.status, STATUS.taking_exam);
    await row.save();
  }

  try {
    // ── B1: Vào khóa học ───────────────────────────────────────────────────
    console.log(`[${username}] B1: Vào trang khóa học...`);
    await page.goto(COURSE_URL, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await page.waitForTimeout(1500);
    console.log(`[${username}] ✓ Trang khóa học`);

    // ── B2: Goto trực tiếp URL quiz — tránh mọi vấn đề click hidden ──────────
    console.log(`[${username}] B2: Vào trang trắc nghiệm...`);
    await page.goto(QUIZ_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log(`[${username}] ✓ Trang quiz: ${page.url()}`);

    // ── B3+B4: Bắt đầu mới hoặc Tiếp tục lần kiểm tra ───────────────────────
    // (A) Lần đầu:   "Bắt đầu làm bài"                  → popup confirm → vào câu hỏi
    // (B) Dở dang:   "Tiếp tục lần kiểm tra cuối cùng"  → vào thẳng (không popup)
    console.log(`[${username}] B3: Kiểm tra trạng thái bài thi...`);

    const continueBtn = page.locator('button:has-text("Tiếp tục lần kiểm tra cuối cùng"), input[value*="Tiếp tục lần kiểm tra"]').first();
    const retryBtn    = page.locator('button:has-text("Thực hiện lại đề thi"), input[value*="Thực hiện lại"]').first();
    const startBtn    = page.locator('button.btn:has-text("Bắt đầu làm bài"), input[value="Bắt đầu làm bài"]').first();

    await Promise.race([
      continueBtn.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {}),
      retryBtn.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {}),
      startBtn.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {}),
    ]);

    const hasContinue = await continueBtn.isVisible().catch(() => false);
    const hasRetry    = await retryBtn.isVisible().catch(() => false);
    const hasStart    = await startBtn.isVisible().catch(() => false);

    if (hasContinue) {
      console.log(`[${username}] B3: ▶ Tiếp tục lần kiểm tra cuối cùng...`);
      await continueBtn.click();
      console.log(`[${username}] ✓ Tiếp tục bài thi dở dang`);
    } else if (hasRetry) {
      console.log(`[${username}] B3: 🔄 Thực hiện lại đề thi...`);
      await retryBtn.click();
      const confirmBtn2 = page.locator('#id_submitbutton, input[name="submitbutton"][value="Bắt đầu làm bài"]').first();
      await confirmBtn2.waitFor({ state: 'visible', timeout: 15000 });
      await confirmBtn2.click();
      console.log(`[${username}] ✓ Đã xác nhận thi lại`);
    } else if (hasStart) {
      console.log(`[${username}] B3: 🆕 Bắt đầu làm bài...`);
      await startBtn.click();
      const confirmBtn3 = page.locator('#id_submitbutton, input[name="submitbutton"][value="Bắt đầu làm bài"]').first();
      await confirmBtn3.waitFor({ state: 'visible', timeout: 15000 });
      await confirmBtn3.click();
      console.log(`[${username}] ✓ Đã xác nhận bắt đầu thi`);
    } else {
      throw new Error('Không tìm thấy button bắt đầu, tiếp tục hoặc thi lại');
    }

    // Chờ trang câu hỏi load
    await page.waitForSelector('.que.multichoice', { timeout: 30000 });
    console.log(`[${username}] ✓ Trang câu hỏi đã load`);

    // ── B5: Trả lời từng câu hỏi ───────────────────────────────────────────
    let questionNo = 1;
    let answered   = 0;
    let notFound   = 0;

    while (true) {
      // Đọc câu hỏi hiện tại
      const qData = await page.evaluate(() => {
        const qEl = document.querySelector('.que.multichoice');
        if (!qEl) return null;

        const qText = qEl.querySelector('.qtext')?.innerText?.trim() || '';
        const options = [];
        qEl.querySelectorAll('.answer .radio-custom').forEach(div => {
          const input = div.querySelector('input[type="radio"]');
          const label = div.querySelector('label');
          if (input && label) {
            // Lấy text của label, bỏ span.answernumber rỗng
            const spans = label.querySelectorAll('span.answernumber');
            spans.forEach(s => s.remove());
            const text = label.innerText.trim();
            options.push({ value: input.value, id: input.id, text });
          }
        });
        return { qText, options };
      });

      if (!qData || !qData.qText) {
        console.log(`[${username}] Không đọc được câu hỏi → dừng`);
        break;
      }

      // Tìm đáp án đúng
      const correctAnswer = findAnswer(qData.qText);

      console.log(`[${username}] Câu ${questionNo}: "${qData.qText}"`);
      console.log(`[${username}]   Đáp án: [${qData.options.map(o => o.text).join(' | ')}]`);

      // findMatchingOption: exact → substring an toàn, không chọn nhầm đáp án ngắn
      const match = findMatchingOption(qData.options, qData.qText);

      if (!correctAnswer || !match) {
        if (!correctAnswer) {
          console.log(`[${username}]   ⚠ Không có trong kho dữ liệu → chọn đầu tiên (fallback)`);
        } else {
          console.log(`[${username}]   ⚠ Không khớp option nào → chọn đầu tiên (fallback)`);
          console.log(`[${username}]   Cần: "${correctAnswer}"`);
        }
        notFound++;
        if (qData.options.length > 0) await page.click(`[id="${qData.options[0].id}"]`);
      } else {
        await page.click(`[id="${match.id}"]`);
        console.log(`[${username}]   ✓ Chọn: "${match.text}"`);
        answered++;
      }

      await page.waitForTimeout(300);

      // Click "Câu tiếp theo" hoặc "Nộp bài..."
      const nextBtn = page.locator([
        'input[name="next"][value="Câu tiếp theo"]',
        'input.mod_quiz-next-nav[value="Câu tiếp theo"]',
      ].join(', ')).first();

      const submitBtn = page.locator([
        'input[name="next"][value="Nộp bài..."]',
        'input.mod_quiz-next-nav[value="Nộp bài..."]',
      ].join(', ')).first();

      const isSubmit = await submitBtn.count() > 0 && await submitBtn.isVisible().catch(() => false);

      if (isSubmit) {
        console.log(`[${username}] B6: Nộp bài... (đã trả lời ${answered} câu đúng)`);
        await submitBtn.click();
        break;
      } else {
        await nextBtn.waitFor({ state: 'visible', timeout: 10000 });
        await nextBtn.click();
        questionNo++;
        await page.waitForTimeout(500);
      }
    }

    // ── B6a: Trang summary.php → click "Nộp bài và kết thúc" ───────────────────
    console.log(`[${username}] B6a: Chờ trang tổng kết (summary.php)...`);
    await page.waitForURL('**/quiz/summary.php**', { timeout: 20000 });
    const summarySubmit = page.locator(
      'button:has-text("Nộp bài và kết thúc"), input[value="Nộp bài và kết thúc"]'
    ).first();
    await summarySubmit.waitFor({ state: 'visible', timeout: 15000 });
    await summarySubmit.click();
    console.log(`[${username}] ✓ Đã click "Nộp bài và kết thúc" trên summary`);

    // ── B6b: Popup xác nhận → click "Nộp bài và kết thúc" ─────────────────────
    console.log(`[${username}] B6b: Xác nhận popup nộp bài...`);
    const confirmSubmit = page.locator(
      'input[id^="id_yuiconfirmyes"], input.btn-primary[value="Nộp bài và kết thúc"]'
    ).first();
    await confirmSubmit.waitFor({ state: 'visible', timeout: 15000 });
    await confirmSubmit.click();
    console.log(`[${username}] ✓ Đã xác nhận nộp bài`);

    // Chờ trang kết quả
    await page.waitForSelector('tr:has(th.cell)', { timeout: 20000 });

    // Đọc điểm
    const score = await page.evaluate(() => {
      const rows = document.querySelectorAll('tr');
      for (const row of rows) {
        const th = row.querySelector('th.cell');
        if (th && th.innerText.trim() === 'Điểm') {
          return row.querySelector('td.cell')?.innerText?.trim() || '';
        }
      }
      return '';
    });

    console.log(`[${username}] 🏆 Kết quả thi: ${score || 'Không đọc được điểm'}`);
    if (notFound > 0) {
      console.log(`[${username}] ⚠ ${notFound} câu không tìm thấy đáp án trong kho dữ liệu`);
    }

    // ── B7: Quay về khóa học → click "5. Bản cam kết..." ──────────────────
    console.log(`[${username}] B7: Quay về khóa học...`);
    const backLink = page.locator(`a[href="${COURSE_URL}"][title="Đào tạo cơ bản"], a[href="${COURSE_URL}"]`).first();
    await backLink.waitFor({ state: 'visible', timeout: 15000 });
    await backLink.click();
    await page.waitForURL('**/course/view.php?id=10**', { timeout: 30000 });
    await page.waitForTimeout(1500);

    console.log(`[${username}] B7: Click "5. Bản cam kết học hiểu..."...`);
    const camKetLink = page.locator([
      'a[href*="mod/resource/view.php?id=72"]',
      'a:has-text("Bản cam kết học hiểu đào tạo cơ bản")',
      'a:has-text("Mẫu số 13")',
    ].join(', ')).first();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await camKetLink.waitFor({ state: 'visible', timeout: 15000 });
    await camKetLink.click();
    console.log(`[${username}] ✅ Hoàn thành toàn bộ chương trình!`);

    // Cập nhật trạng thái cuối
    if (row) {
      setCol(row, COL.status, STATUS.exam_done);
      await row.save();
      console.log(`[${username}] ✓ Trạng thái: "${STATUS.exam_done}" | Điểm: ${score}`);
    }

    return { success: true, score };

  } catch (err) {
    console.error(`[${username}] ❌ Lỗi thi: ${err.message}`);
    if (row) {
      setCol(row, COL.status, STATUS.error);
      await row.save();
    }
    return { success: false, error: err.message };
  }
}

module.exports = { runQuiz };