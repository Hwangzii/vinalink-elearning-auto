# file: Dockerfile
# Sử dụng image chính thức của Playwright (đã cài sẵn Node.js và các thư viện trình duyệt)
FROM mcr.microsoft.com/playwright:v1.58.1-jammy

# Tạo thư mục làm việc trong container
WORKDIR /app

# Copy package.json và cài đặt thư viện trước để tận dụng cache của Docker
COPY package*.json ./
RUN npm install

# Copy toàn bộ mã nguồn vào container
COPY . .

# Mặc định chạy ở chế độ production (ngầm)
# 'development'/'production'
ENV NODE_ENV=production

# Lệnh khởi chạy auto
CMD ["node", "index.js"]