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
    const post = await Post.findOneAndUpdate(
      { postNo: '12345' },
      {
        postNo: '12345',
        galleryId: 'chatgpt',
        title: '테스트 게시글',
        author: { nickname: '테스터', userId: 'tester', ip: '127.0.0.1' },
        date: new Date(),
        type: 'text',
        subject: '테스트'
      },
      { upsert: true, new: true }
    );
    console.log('테스트 게시글이 추가되었습니다:', post);
    
    // 테스트용 이상치 데이터 추가
    const anomaly = await Anomaly.create({
      postNo: '12345',
      galleryId: 'chatgpt',
      detectedAt: new Date(),
      startedAt: new Date(Date.now() - 3600000),
      statistics: {
        zScore: 5.2,
        recChangePerMin: 12.5,
        beforeRecommend: 10,
        afterRecommend: 50
      },
      status: 'new',
      memo: '테스트 이상치 데이터'
    });
    console.log('테스트 이상치가 추가되었습니다:', anomaly);
    
    // 연결 종료
    await mongoose.connection.close();
    console.log('MongoDB 연결이 종료되었습니다.');
    process.exit(0);
  } catch (err) {
    console.error('테스트 데이터 추가 중 오류가 발생했습니다:', err);
    process.exit(1);
  }
}

addTestData();
