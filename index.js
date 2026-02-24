require('dotenv').config(); // Nạp cấu hình từ file .env
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// --- CẤU HÌNH BIẾN MÔI TRƯỜNG ---
const isDev = process.env.NODE_ENV;

const CREDENTIALS_PATH = path.join(__dirname, 'key', 'credentials.json');
const TIMEHOOKER_PATH = path.join(__dirname, 'TimeHooker.txt');
const SPREADSHEET_ID = '15o-NJOjYFxeuRPI6iqQcfQEJHIFAT-RfQyMezVoKIn4';

const creds = require(CREDENTIALS_PATH);
const auth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function runBot() {
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    // Log trạng thái để bạn biết mình đang ở môi trường nào
    console.log(`\n============================================`);
    console.log(`🚀 CHẾ ĐỘ: ${isDev ? 'DEVELOPMENT (CÓ UI)' : 'PRODUCTION (CHẠY NGẦM)'}`);
    console.log(`📊 Theo dõi Sheet: "${doc.title}"`);
    console.log(`============================================\n`);

    while (true) {
        try {
            const rows = await sheet.getRows();
            for (let row of rows) {
                const status = row.get('STATUS');
                if (status === 'login') {
                    const user = row.get('ID');
                    const pass = row.get('PASS');
                    
                    row.set('STATUS', 'processing...');
                    await row.save();

                    const result = await performLoginAndGetName(user, pass);

                    if (result.success) {
                        console.log(`✅ [${user}] Đăng nhập thành công: ${result.fullName}`);
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
            console.error("⚠️ Lỗi hệ thống:", err.message);
        }
        await new Promise(r => setTimeout(r, 5000));
    }
}

async function performLoginAndGetName(user, pass) {
    // TỰ ĐỘNG CẤU HÌNH TRÌNH DUYỆT THEO MÔI TRƯỜNG
    const browser = await chromium.launch({ 
        headless: !isDev, // Nếu là Dev thì hiện UI (headless = false), nếu không thì ẩn (headless = true)
        slowMo: isDev ? 150 : 0 // Nếu Dev thì làm chậm lại để nhìn, nếu Prod thì chạy tốc độ tối đa
    }); 
    
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        if (fs.existsSync(TIMEHOOKER_PATH)) {
            const script = fs.readFileSync(TIMEHOOKER_PATH, 'utf8');
            await page.addInitScript(script);
        }

        await page.goto('http://elearning.vina-link.com.vn/login/index.php', { waitUntil: 'networkidle' });
        await page.fill('#username', user.toString());
        await page.fill('#password', pass.toString());
        await page.click('#loginbtn');

        await page.waitForURL(url => !url.href.includes('login/index.php'), { timeout: 15000 });
        
        // Nếu là Prod thì đợi ít hơn để tiết kiệm tài nguyên
        await page.waitForTimeout(isDev ? 2000 : 1000);

        await page.waitForSelector('.username', { timeout: 8000 });
        const fullName = await page.innerText('.username');
        
        return { success: true, url: page.url(), fullName: fullName.trim() };

    } catch (err) {
        return { success: false, error: err.message };
    } finally {
        await browser.close();
    }
}

runBot();