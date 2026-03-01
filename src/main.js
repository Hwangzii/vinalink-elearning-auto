// file: src/main.js
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const config = require('./config');
const { performLoginAndGetProgress } = require('./browser');
const { processRow } = require('./processor');
const { COL, STATUS, getCol } = require('./columns');

// ── Google Auth ──────────────────────────────────────────────────────────────
function initAuth() {
  let creds;
  try {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    } else {
      creds = require(config.CREDENTIALS_PATH);
    }
  } catch (err) {
    console.error('❌ Không thể đọc credentials:', err.message);
    process.exit(1);
  }
  return new JWT({
    email: creds.client_email,
    key: creds.private_key.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

// ── Giới hạn concurrent ──────────────────────────────────────────────────────
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

// ── Vòng lặp chính ──────────────────────────────────────────────────────────
async function run() {
  const auth = initAuth();
  const doc  = new GoogleSpreadsheet(config.SPREADSHEET_ID, auth);

  try {
    await doc.loadInfo();
    console.log(`✅ Kết nối Google Sheet thành công: "${doc.title}"`);
  } catch (err) {
    console.error('❌ Không thể kết nối Google Sheet:', err.message);
    process.exit(1);
  }

  const sheet = doc.sheetsByIndex[0];
  const limit = createLimiter(config.CONCURRENT_LIMIT);

  console.log(`🤖 Bot khởi động | Xử lý song song: ${config.CONCURRENT_LIMIT} tài khoản`);
  console.log(`⏳ Kiểm tra sheet mỗi ${config.POLL_INTERVAL_MS / 1000}s`);
  console.log(`🔍 Tìm các hàng có STATUS = "${STATUS.pending}"\n`);

  while (true) {
    try {
      const rows = await sheet.getRows();

      // Lọc hàng cần xử lý: STATUS === 'login' (giá trị từ columns.js)
      const hangCanXuLy = rows.filter(r => {
        const status = getCol(r, COL.status).toLowerCase();
        return status === STATUS.pending.toLowerCase();
      });

      if (hangCanXuLy.length === 0) {
        // Không log khi rảnh để tránh spam
      } else {
        console.log(`📋 Tìm thấy ${hangCanXuLy.length} hàng cần xử lý...`);
        await Promise.all(
          hangCanXuLy.map(row => limit(() => processRow(row, { performLoginAndGetProgress })))
        );
        console.log(`✅ Xong đợt này\n`);
      }
    } catch (err) {
      console.error('❌ Lỗi vòng lặp:', err.message);
    }

    await new Promise(r => setTimeout(r, config.POLL_INTERVAL_MS));
  }
}

run().catch(err => {
  console.error('💥 Bot crash:', err);
  process.exit(1);
});