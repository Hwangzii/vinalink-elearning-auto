require('dotenv').config();
const path = require('path');

module.exports = {
  CREDENTIALS_PATH: path.join(__dirname, '../key/credentials.json'),
  TIMEHOOKER_PATH: path.join(__dirname, '../key/TimeHooker.txt'),
  SPREADSHEET_ID: '15o-NJOjYFxeuRPI6iqQcfQEJHIFAT-RfQyMezVoKIn4',
  CONCURRENT_LIMIT: 5,
  POLL_INTERVAL_MS: 5000,
  RETRY_DELAY_MS: 3000,
  MAX_ATTEMPTS: 2,
};