FROM node:18-alpine

WORKDIR /app

# 의존성 파일 복사 및 설치
COPY package*.json ./
RUN npm ci --only=production

# 소스 코드 복사
COPY . .

# API 서버 포트
EXPOSE 3000

# 애플리케이션 실행
CMD ["node", "index.js"]
