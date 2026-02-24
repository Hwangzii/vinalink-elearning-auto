require('dotenv').config();

const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Xác định môi trường một cách rõ ràng
const NODE_ENV = (process.env.NODE_ENV || 'development').trim().toLowerCase();
const IS_DEV = NODE_ENV === 'development';
const IS_PROD = NODE_ENV === 'production' || NODE_ENV === 'prod';

// Các đường dẫn
const CREDENTIALS_PATH = path.join(__dirname, 'key', 'credentials.json');
const TIMEHOOKER_PATH = path.join(__dirname, 'TimeHooker.txt');
const SPREADSHEET_ID = '15o-NJOjYFxeuRPI6iqQcfQEJHIFAT-RfQyMezVoKIn4';

// Khởi tạo Google Auth
let auth;
try {
  const creds = require(CREDENTIALS_PATH);
  auth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
} catch (err) {
  console.error('Không thể đọc file credentials.json:', err.message);
  process.exit(1);
}

async function runBot() {
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);

  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    console.log(`\n============================================`);
    console.log(`  MÔI TRƯỜNG     : ${IS_DEV ? 'DEVELOPMENT' : 'PRODUCTION'}`);
    console.log(`  Browser         : ${IS_DEV ? 'CÓ HIỂN THỊ (visible)' : 'ẨN (headless)'}`);
    console.log(`  Tốc độ          : ${IS_DEV ? 'CHẬM (slowMo 150ms)' : 'NHANH'}`);
    console.log(`  Sheet đang theo dõi : "${doc.title}"`);
    console.log(`============================================\n`);

    while (true) {
      try {
        const rows = await sheet.getRows();

        for (const row of rows) {
          const status = row.get('STATUS')?.trim();

          if (status === 'login') {
            const user = row.get('ID')?.toString().trim();
            const pass = row.get('PASS')?.toString().trim();

            if (!user || !pass) {
              console.warn(`Dòng có STATUS=login nhưng thiếu ID hoặc PASS`);
              continue;
            }

            row.set('STATUS', 'processing...');
            await row.save();

            const result = await performLoginAndGetName(user, pass);

            if (result.success) {
              console.log(`✅ [${user}] Đăng nhập thành công → ${result.fullName}`);
              row.set('STATUS', 'success');
              row.set('FULLNAME', result.fullName);
            } else {
              console.log(`❌ [${user}] Thất bại: ${result.error}`);
              row.set('STATUS', 'error');
            }

            await row.save();
          }
        }
      } catch (err) {
        console.error('Lỗi khi xử lý sheet:', err.message);
      }

      // Nghỉ 5 giây trước khi quét lại
      await new Promise(r => setTimeout(r, 5000));
    }
  } catch (err) {
    console.error('Lỗi khởi tạo Google Sheet:', err.message);
    process.exit(1);
  }
}

async function performLoginAndGetName(username, password) {
  let browser;
  try {
    browser = await chromium.launch({
      headless: !IS_DEV,
      slowMo: IS_DEV ? 150 : 0,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',              // hữu ích khi chạy headless
        '--disable-extensions',
        '--disable-infobars',
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();

    // Inject TimeHooker nếu có
    if (fs.existsSync(TIMEHOOKER_PATH)) {
      const script = fs.readFileSync(TIMEHOOKER_PATH, 'utf8');
      await page.addInitScript(script);
    }

    await page.goto('http://elearning.vina-link.com.vn/login/index.php', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    await page.fill('#username', username);
    await page.fill('#password', password);
    await page.click('#loginbtn');

    // Chờ chuyển hướng khỏi trang login
    await page.waitForURL(url => !url.href.includes('login/index.php'), {
      timeout: 20000,
    });

    // Đợi thêm một chút để trang load ổn định
    await page.waitForTimeout(IS_DEV ? 2500 : 800);

    await page.waitForSelector('.username', { timeout: 15000 });
    const fullName = (await page.innerText('.username')).trim();

    return { success: true, fullName };
  } catch (err) {
    return { success: false, error: err.message || 'Lỗi không xác định' };
  } finally {
    if (browser) {
      // Ở production luôn close browser
      // Ở dev có thể comment dòng này nếu muốn giữ browser để debug
      await browser.close();
    }
  }
}

// Chạy bot
runBot().catch(err => {
  console.error('Bot bị lỗi nghiêm trọng:', err);
  process.exit(1);
});