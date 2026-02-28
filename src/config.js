// file: src/config.js
require('dotenv').config();
const path = require('path');

module.exports = {
  CREDENTIALS_PATH: path.join(__dirname, '../key/credentials.json'),
  TIMEHOOKER_PATH: path.join(__dirname, '../key/TimeHooker.txt'),
  SPREADSHEET_ID: '15o-NJOjYFxeuRPI6iqQcfQEJHIFAT-RfQyMezVoKIn4',
  CONCURRENT_LIMIT: 1,
  POLL_INTERVAL_MS: 5000,
  RETRY_DELAY_MS: 3000,
  MAX_ATTEMPTS: 2,

  // ── Thêm mới ──
  COURSE_URL: 'http://elearning.vina-link.com.vn/course/view.php?id=10',
  SCORM_PLAYER_URL: 'http://elearning.vina-link.com.vn/mod/scorm/player.php?a=21&currentorg=RSLBYTyDkzj5W_organization&scoid=67',
};