/**
 * 전체 스냅샷 재검증 기능
 */
const { detectAnomalies } = require('./anomaly-detector');
const Snapshot = require('../models/snapshot.model');

/**
 * DB에 저장된 모든 스냅샷에 대해 이상치를 재검증하는 함수
 */
async function revalidateAllSnapshots() {
  console.log('\n🔍 전체 스냅샷 이상치 재검증 시작');
  const startTime = new Date();
  let totalProcessed = 0;
  let anomaliesDetected = 0;
  let batchSize = 100; // 한 번에 처리할 스냅샷 수
  let page = 0;
  
  try {
    // 페이징 처리하여 메모리 효율적으로 관리
    while (true) {
      // 스냅샷 가져오기 (최신순)
      const snapshots = await Snapshot.find({})
        .sort({ createdAt: -1 })
        .skip(page * batchSize)
        .limit(batchSize);
      
      if (snapshots.length === 0) break; // 더 이상 처리할 스냅샷 없음
      
      console.log(`📄 ${page + 1}번째 배치 처리 중 (${snapshots.length}개)...`);
      
      // 각 스냅샷에 대해 이상치 감지 수행
      for (const snapshot of snapshots) {
        const anomaly = await detectAnomalies(snapshot);
        totalProcessed++;
        
        if (anomaly) {
          anomaliesDetected++;
        }
        
        // 진행 상황 로깅 (100개 단위)
        if (totalProcessed % 100 === 0) {
          console.log(`⏳ ${totalProcessed}개 처리 완료, 이상치: ${anomaliesDetected}개 감지`);
        }
      }
      
      page++;
    }
    
    const duration = (new Date() - startTime) / 1000;
    console.log(`\n✅ 전체 스냅샷 검증 완료`);
    console.log(`📊 총 ${totalProcessed}개 스냅샷 중 ${anomaliesDetected}개 이상치 감지 (소요시간: ${duration.toFixed(2)}초)\n`);
    return true;
  } catch (err) {
    console.error('❌ 전체 스냅샷 검증 중 오류 발생:', err.message);
    return false;
  }
}

module.exports = {
  revalidateAllSnapshots
};
