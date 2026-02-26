const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const config = require('./config');
const { performLogin } = require('./browser');
const { processRow } = require('./processor');

// Google Auth
function initAuth() {
  let creds;
  try {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } else {
      creds = require(config.CREDENTIALS_PATH);
    }
  } catch (err) {
    console.error('Không thể đọc credentials:', err.message);
    process.exit(1);
  }

  return new JWT({
    email: creds.client_email,
    key: creds.private_key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

// Native limiter
function createLimiter(concurrency) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    Promise.resolve().then(fn).then(
      val => { active--; resolve(val); next(); },
      err => { active--; reject(err); next(); }
    );
  };
  return fn => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    next();
  });
}

// Main loop
async function run() {
  const auth = initAuth();
  const doc = new GoogleSpreadsheet(config.SPREADSHEET_ID, auth);

  try {
    await doc.loadInfo();
  } catch (err) {
    console.error('Không thể kết nối Sheet:', err.message);
    process.exit(1);
  }

  const sheet = doc.sheetsByIndex[0];
  const limit = createLimiter(config.CONCURRENT_LIMIT);

  console.log(`Bot khởi động - concurrent: ${config.CONCURRENT_LIMIT}`);

  while (true) {
    try {
      const rows = await sheet.getRows();
      const needLogin = rows.filter(r => r.get('STATUS')?.trim() === 'login');

      if (needLogin.length > 0) {
        console.log(`Tìm thấy ${needLogin.length} tài khoản cần xử lý`);
        await Promise.all(
          needLogin.map(row => limit(() => processRow(row, { performLogin })))
        );
        console.log(`Xong đợt này`);
      }
    } catch (err) {
      console.error('Lỗi vòng lặp:', err.message);
    }

    await new Promise(r => setTimeout(r, config.POLL_INTERVAL_MS));
  }
}

run().catch(err => {
  console.error('Bot crash:', err);
  process.exit(1);
});