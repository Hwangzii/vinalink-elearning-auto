# Sử dụng image Node chính thức, dựa trên Debian (có apt)
FROM node:22-bookworm-slim

# Cài các dependencies hệ thống cần cho Chromium/Playwright (không cần sudo riêng vì root trong Docker)
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils && \
    rm -rf /var/lib/apt/lists/*

# Tạo thư mục làm việc
WORKDIR /app

# Copy package.json và install dependencies trước để cache tốt hơn
COPY package*.json ./
RUN npm install

# Cài Playwright browsers (bây giờ có quyền root, chạy ok)
RUN npx playwright install --with-deps chromium

# Copy toàn bộ code còn lại
COPY . .

# Set biến môi trường (nếu cần)
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/app/.cache/ms-playwright  
# Port nếu cần expose (bot của bạn không cần HTTP, nhưng Render yêu cầu)
EXPOSE 10000

# Lệnh chạy bot
CMD ["npm", "run", "prod"]
# hoặc CMD ["NODE_ENV=production", "node", "index.js"]