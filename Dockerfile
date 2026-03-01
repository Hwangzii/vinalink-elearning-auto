# Dùng image Node chính thức có sẵn các deps hệ thống cho Playwright
FROM mcr.microsoft.com/playwright:v1.45.0-jammy

WORKDIR /app

# Copy package files trước để tận dụng Docker layer cache
COPY package*.json ./

# Cài node_modules (postinstall sẽ tự chạy playwright install)
RUN npm ci

# Copy toàn bộ source code
COPY . .

# Chạy ở production mode
ENV NODE_ENV=production

CMD ["node", "index.js"]