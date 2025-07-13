/**
 * MongoDB 연결 설정
 */
const mongoose = require('mongoose');
const config = require('../config/config');

// MongoDB 연결 옵션
const connectOptions = {
  // useNewUrlParser, useUnifiedTopology는 최신 mongoose 버전에서는 기본값으로 설정됨
};

/**
 * 데이터베이스 연결 함수
 */
async function connectDB() {
  try {
    await mongoose.connect(config.mongodbUri, connectOptions);
    console.log('✅ MongoDB 연결 성공');
    
    // 90일 후 자동 삭제 TTL 인덱스 설정 (snapshots 컬렉션)
    // 스키마에서 자동으로 설정되므로 여기서는 생략
    
    return mongoose.connection;
  } catch (err) {
    console.error('❌ MongoDB 연결 실패:', err.message);
    process.exit(1);
  }
}

module.exports = { connectDB };
