# 健身房後端 API — 容器化壓軸
FROM node:20.19.3-alpine

WORKDIR /app

# 先複製 package 檔並安裝相依，善用 Docker layer 快取
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 再複製其餘原始碼（.dockerignore 已排除 node_modules 與 .env）
COPY . .

ENV NODE_ENV=production
# 後端固定運作在 8080（前端與 Swagger 都寫死這個 port）
EXPOSE 8080

CMD ["npm", "start"]
