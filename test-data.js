/**
 * 테스트용 이상치 데이터 추가 스크립트
 */
const mongoose = require('mongoose');
const { connectDB } = require('./src/db/connection');
const Anomaly = require('./src/models/anomaly.model');
const Post = require('./src/models/post.model');

async function addTestData() {
  try {
    // MongoDB 연결
    await connectDB();
    console.log('MongoDB에 연결되었습니다.');
    
    // 테스트용 게시글 데이터 추가
    const data = await Anomaly.find({}).lean();
    if (data.length > 0) {
      console.log(data);
      return;
    }
    process.exit(0);
  } catch (err) {
    console.error('테스트 데이터 추가 중 오류가 발생했습니다:', err);
    process.exit(1);
  }
}

addTestData();
