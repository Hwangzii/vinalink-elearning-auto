// file: src/config.js
require('dotenv').config();
const path = require('path');

module.exports = {
  // ── Google Sheets ──────────────────────────────────────────────────────────
  CREDENTIALS_PATH: path.join(__dirname, '../key/credentials.json'),
  TIMEHOOKER_PATH:  path.join(__dirname, '../key/TimeHooker.txt'),
  SPREADSHEET_ID:   '15o-NJOjYFxeuRPI6iqQcfQEJHIFAT-RfQyMezVoKIn4',

  // ── Bot ────────────────────────────────────────────────────────────────────
  CONCURRENT_LIMIT: 1,
  POLL_INTERVAL_MS: 5000,
  RETRY_DELAY_MS:   3000,
  MAX_ATTEMPTS:     2,

  // ── URLs ───────────────────────────────────────────────────────────────────
  COURSE_URL:       'http://elearning.vina-link.com.vn/course/view.php?id=10',
  SCORM_PLAYER_URL: 'http://elearning.vina-link.com.vn/mod/scorm/player.php?a=21&currentorg=RSLBYTyDkzj5W_organization&scoid=67',

  // ── TimeHooker speed ───────────────────────────────────────────────────────
  // Bội số tua timer SCORM — càng cao càng nhanh
  // 5000    → slide 2 phút → ~0.024s
  // 100000  → cực nhanh
  // 9999999 → gần như tức thì (max thực tế)
  SPEED_RATE: 9999999,

  // ── Dev mode ───────────────────────────────────────────────────────────────
  DEV_SLOW_MO: 200,
};