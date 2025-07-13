/**
 * 디시인사이드 갤러리 추천수 조작 감지 시스템
 * (DC Gall Guard)
 */
const cron = require('node-cron');
const { connectDB } = require('./src/db/connection');
const config = require('./src/config/config');
const { crawlGallery } = require('./src/crawler/gallery-crawler');
const { detectAnomalies } = require('./src/detector/anomaly-detector');
const { startServer } = require('./src/api/server');
const Post = require('./src/models/post.model');


// 메인 크롤링 함수
async function runCrawler(galleryId, pages = 1) {
  try {
    console.log(`🔄 ${galleryId} 갤러리 크롤링 시작 (${pages}페이지)`);
    let anomaliesDetected = 0;
    
    // 페이지별 크롤링
    for (let page = 1; page <= pages; page++) {
      // 게시글 스냅샷 수집
      const snapshots = await crawlGallery(galleryId, page);
      
      // 각 스냅샷에 대해 이상치 감지
      for (const snapshot of snapshots) {
        const anomaly = await detectAnomalies(snapshot);
        
        // 이상치 발견 시 알림 전송
        if (anomaly) {
          anomaliesDetected++;
          
          // 게시글 정보 가져오기
          const post = await Post.findOne({ postNo: anomaly.postNo });
          
        }
      }
      
      // 페이지 간 딜레이
      if (page < pages) {
        console.log(`⏱️ ${config.crawlDelayMs}ms 지연 중...`);
        await new Promise(resolve => setTimeout(resolve, config.crawlDelayMs));
      }
    }
    
    console.log(`✅ ${galleryId} 갤러리 크롤링 완료: 이상치 ${anomaliesDetected}개 감지됨`);
    return true;
  } catch (err) {
    console.error(`❌ 크롤링 실패 (${galleryId}):`, err.message);
    return false;
  }
}

// 모든 대상 갤러리 크롤링
async function crawlAllGalleries() {
  console.log(`\n🔄 크롤링 작업 시작: ${new Date().toLocaleString('ko-KR')}`);
  console.log(`📋 대상 갤러리: ${config.targetGalleryIds.join(', ')}`);
  
  for (const galleryId of config.targetGalleryIds) {
    await runCrawler(galleryId, config.crawlPages);
  }
  
  console.log('✅ 모든 갤러리 크롤링 완료\n');
}

// 메인 함수
async function main() {
  try {
    console.log('🚀 DC Gall Guard 시작');
    
    // MongoDB 연결
    await connectDB();
    
    // API 서버 시작
    startServer();
    
    // 스케줄러 설정 (Cron 표현식으로 실행)
    console.log(`⏰ 스케줄러 설정: ${config.cronExpression}`);
    cron.schedule(config.cronExpression, async () => {
      await crawlAllGalleries();
    });
    
    // 시작 즉시 한 번 실행 (선택)
    console.log('📡 초기 크롤링 시작...');
    await crawlAllGalleries();
    
    console.log('✅ 시스템이 정상적으로 실행 중입니다.');
  } catch (err) {
    console.error('❌ 시스템 시작 오류:', err);
    process.exit(1);
  }
}

// 애플리케이션 시작
main();
