# Dùng image Microsoft Playwright — đã có sẵn Chromium + tất cả system deps
# Khớp với version playwright trong package.json (^1.45.0)
FROM mcr.microsoft.com/playwright:v1.45.0-jammy

WORKDIR /app

# Copy package files trước để Docker cache layer khi deps không đổi
COPY package*.json ./

# Cài node_modules — bỏ qua postinstall vì image đã có Chromium sẵn
RUN npm ci --ignore-scripts

# Copy toàn bộ source (key/ bị loại bởi .dockerignore)
COPY . .

# Render.com yêu cầu PORT env — node không dùng nhưng cần khai báo
ENV PORT=3000
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

CMD ["node", "index.js"]