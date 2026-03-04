// file: src/main.js
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const config = require('./config');
const { performLoginAndGetProgress } = require('./browser');
const { processRow, processQuizRow } = require('./processor');
const { COL, STATUS, getCol, setCol } = require('./columns');

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

  const IS_DEV     = process.env.NODE_ENV === 'development';
  const concurrent = IS_DEV ? config.CONCURRENT_DEV : config.CONCURRENT_LIMIT;

  console.log(`🤖 Bot khởi động | Chế độ: ${IS_DEV ? 'DEV (1 tài khoản)' : `PROD (tối đa ${concurrent} tài khoản song song)`}`);
  console.log(`⏳ Kiểm tra sheet mỗi ${config.POLL_INTERVAL_MS / 1000}s`);
  console.log(`🔍 Tìm các hàng có STATUS = "${STATUS.pending}" hoặc "${STATUS.exam_pending}"\n`);

  // ── Worker pool: track số slot đang bận ─────────────────────────────────
  // Set lưu username đang được xử lý → tránh pick up cùng 1 mã 2 lần
  const activeUsers = new Set();

  // Hàm dispatch 1 row vào pool (fire-and-forget, tự giải phóng slot khi xong)
  function dispatch(row, type) {
    const user = getCol(row, COL.username);
    activeUsers.add(user);

    const task = type === 'quiz'
      ? processQuizRow(row, { performLoginAndGetProgress })
      : processRow(row, { performLoginAndGetProgress });

    task
      .catch(err => console.error(`[${user}] ❌ Lỗi không bắt được: ${err.message}`))
      .finally(() => {
        activeUsers.delete(user);
        console.log(`[${user}] 🔓 Slot giải phóng | Đang bận: ${activeUsers.size}/${concurrent}`);
      });
  }

  // ── Poll liên tục ─────────────────────────────────────────────────────────
  while (true) {
    try {
      // Còn slot trống thì mới đọc sheet (tránh đọc vô ích khi full)
      const freeSlots = concurrent - activeUsers.size;

      if (freeSlots > 0) {
        const rows = await sheet.getRows();

        // Lọc hàng chưa được xử lý và chưa nằm trong activeUsers
        const canHoc = rows.filter(r => {
          const status = getCol(r, COL.status).toLowerCase();
          const user   = getCol(r, COL.username);
          return status === STATUS.pending.toLowerCase() && !activeUsers.has(user);
        });

        const canThi = rows.filter(r => {
          const status = getCol(r, COL.status).toLowerCase();
          const user   = getCol(r, COL.username);
          return status === STATUS.exam_pending.toLowerCase() && !activeUsers.has(user);
        });

        // Dispatch tối đa freeSlots mã mới (học ưu tiên trước, thi sau)
        const toDispatch = [...canHoc.map(r => ({ row: r, type: 'learn' })),
                            ...canThi.map(r => ({ row: r, type: 'quiz'  }))]
                           .slice(0, freeSlots);

        if (toDispatch.length > 0) {
          console.log(`📋 Slot trống: ${freeSlots} | Dispatch ${toDispatch.length} mã mới | Đang chạy: ${activeUsers.size}`);
          for (const { row, type } of toDispatch) {
            const user = getCol(row, COL.username);
            console.log(`  ▶ [${user}] (${type === 'quiz' ? 'thi' : 'học'})`);
            dispatch(row, type);
          }
        }
      }
    } catch (err) {
      console.error('❌ Lỗi vòng poll:', err.message);
    }

    await new Promise(r => setTimeout(r, config.POLL_INTERVAL_MS));
  }
}

run().catch(err => {
  console.error('💥 Bot crash:', err);
  process.exit(1);
});