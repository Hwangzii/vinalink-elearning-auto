// file: src/config.js
require('dotenv').config();
const path = require('path');

module.exports = {
  // ── Google Sheets ──────────────────────────────────────────────────────────
  CREDENTIALS_PATH:  path.join(__dirname, '../key/credentials.json'),
  TIMEHOOKER_PATH:   path.join(__dirname, '../key/TimeHooker.txt'),
  SPREADSHEET_ID:    '15o-NJOjYFxeuRPI6iqQcfQEJHIFAT-RfQyMezVoKIn4',

  // ── Bot concurrency ────────────────────────────────────────────────────────
  CONCURRENT_LIMIT:  1,       // số tài khoản chạy song song
  POLL_INTERVAL_MS:  5000,    // ms giữa mỗi lần poll Google Sheet
  RETRY_DELAY_MS:    3000,
  MAX_ATTEMPTS:      2,

  // ── URLs ───────────────────────────────────────────────────────────────────
  COURSE_URL:        'http://elearning.vina-link.com.vn/course/view.php?id=10',
  SCORM_PLAYER_URL:  'http://elearning.vina-link.com.vn/mod/scorm/player.php?a=21&currentorg=RSLBYTyDkzj5W_organization&scoid=67',

  // ── Tốc độ tua (TimerHooker) ───────────────────────────────────────────────
  SPEED_RATE:        100000,  // bội số tua timer (càng cao càng nhanh)
                              // 5000   → ~2 phút/slide tua còn ~0.024s
                              // 100000 → cực nhanh, gần như tức thì

  // ── Vòng lặp học ──────────────────────────────────────────────────────────
  TOTAL_SLIDES:      220,     // tổng số slide của khóa học
  LOOP_INTERVAL:     200,     // ms mỗi vòng lặp forcePlayAndNext (càng nhỏ càng nhanh)
  MAX_STUCK:         150,     // số vòng slide không tăng trước khi dừng (~30s với 200ms/vòng)
  PLAYER_READY_MS:   6000,    // ms chờ iframe player render lần đầu

  // ── Dev mode ───────────────────────────────────────────────────────────────
  // Bật: NODE_ENV=development (npm run dev)
  // headless=false, slowMo=300ms để quan sát trực tiếp
  DEV_SLOW_MO:       300,
};