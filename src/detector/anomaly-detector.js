/**
 * 추천수 변화 이상치 감지 모듈
 */
const { differenceInMinutes } = require('date-fns');
const Snapshot = require('../models/snapshot.model');
const Anomaly = require('../models/anomaly.model');
const config = require('../config/config');

/**
 * 게시글의 추천수 변화량(기울기) 계산
 * @param {string} postNo - 게시글 번호
 * @param {string} galleryId - 갤러리 ID
 * @param {number} windowMin - 분석 윈도우 크기 (기본값: 30분)
 * @returns {Promise<Array>} - 기울기 배열 [rec/min, ...] 최신순
 */
async function calculateSlopes(postNo, galleryId, windowMin = 30) {
  try { 
    // 최신 스냅샷 가져오기 (내림차순)
    const snapshots = await Snapshot.find({ postNo, galleryId })
      .sort({ collectedAt: -1 })
      .limit(windowMin)
      .lean();
    
    if (snapshots.length < 2) {
      return []; // 데이터가 충분하지 않음
    }
    
    // 기울기 계산
    const slopes = [];
    for (let i = 0; i < snapshots.length - 1; i++) {
      const current = snapshots[i];
      const previous = snapshots[i + 1];
      
      const recommendDiff = current.recommend - previous.recommend;
      const timeDiffMin = differenceInMinutes(
        new Date(current.collectedAt),
        new Date(previous.collectedAt)
      );
      
      if (timeDiffMin <= 0) continue; // 시간차가 없으면 건너뜀
      
      // 분당 추천수 변화량 계산
      const slope = recommendDiff / timeDiffMin;
      slopes.push(slope);
    }
    
    return slopes;
  } catch (err) {
    console.error(`❌ 기울기 계산 오류 (${postNo}):`, err.message);
    return [];
  }
}

/**
 * Z-Score 계산 함수
 * @param {number} value - 검증할 값
 * @param {Array<number>} population - 모집단 배열
 * @returns {number} - Z-Score
 */
function calculateZScore(value, population) {
  if (!population.length) return 0;
  
  // 평균 계산
  const mean = population.reduce((sum, val) => sum + val, 0) / population.length;
  
  // 표준편차 계산
  const squaredDiffs = population.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / population.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return 0; // 표준편차가 0이면 z-score 계산 불가
  
  // Z-Score 계산 및 반환
  return (value - mean) / stdDev;
}

/**
 * 새로운 스냅샷 데이터로 이상치 탐지
 * @param {Object} snapshot - 새 스냅샷 객체
 * @returns {Promise<Object|null>} - 감지된 이상치 또는 null
 */
async function detectAnomalies(snapshot) {
  try {
    // 이전 스냅샷 가져오기
    const prevSnapshot = await Snapshot.findOne({
      postNo: snapshot.postNo,
      galleryId: snapshot.galleryId,
      collectedAt: { $lt: snapshot.collectedAt }
    }).sort({ collectedAt: -1 });
    
    if (!prevSnapshot) return null; // 이전 데이터 없음
    
    // 추천수 변화 확인
    const recChange = snapshot.recommend - prevSnapshot.recommend;
    if (recChange <= 0) return null; // 추천수 증가가 없음
    
    // 최소 임계값 확인
    if (recChange < config.minRecChange) return null; // 너무 작은 변화는 무시
    
    // 시간 차이 계산 (분 단위)
    const timeDiffMin = differenceInMinutes(
      new Date(snapshot.collectedAt),
      new Date(prevSnapshot.collectedAt)
    );
    
    if (timeDiffMin <= 0) return null; // 시간차가 없음
    
    // 분당 추천수 변화량 (이전 로직 유지)
    const recChangePerMin = recChange / timeDiffMin;
    
    // 버스트 감지: shortWindowMin 이내 추천수 증가량이 burstThreshold 이상인 경우 이상치로 판정
    const windowStart = new Date(new Date(snapshot.collectedAt).getTime() - config.shortWindowMin * 60 * 1000);
    const windowSnapshots = await Snapshot.find({
      postNo: snapshot.postNo,
      galleryId: snapshot.galleryId,
      collectedAt: { $gte: windowStart }
    }).sort({ collectedAt: 1 }).lean();
    if (windowSnapshots.length >= 2) {
      const burstCount = snapshot.recommend - windowSnapshots[0].recommend;
      if (burstCount >= config.burstThreshold) {
        console.log(`🚀 버스트 감지: ${snapshot.postNo} (증가량: ${burstCount}개 in ${config.shortWindowMin}분)`);
        const anomaly = await Anomaly.create({
          postNo: snapshot.postNo,
          galleryId: snapshot.galleryId,
          detectedAt: new Date(),
          startedAt: windowSnapshots[0].collectedAt,
          statistics: {
            burstCount,
            burstWindowMin: config.shortWindowMin,
            beforeRecommend: windowSnapshots[0].recommend,
            afterRecommend: snapshot.recommend
          }
        });
        return anomaly;
      }
    }
    // 버스트 감지 조건 미충족 시 이상치 아님
    return null;
  } catch (err) {
    console.error(`❌ 이상치 감지 오류 (${snapshot.postNo}):`, err.message);
    return null;
  }
}

module.exports = {
  calculateSlopes,
  calculateZScore,
  detectAnomalies
};
