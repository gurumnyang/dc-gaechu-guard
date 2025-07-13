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
    
    // 분당 추천수 변화량
    const recChangePerMin = recChange / timeDiffMin;
    
    // 같은 갤러리 최근 게시물들의 기울기 수집 (장기 구간으로 변경)
    const recentSnapshots = await Snapshot.find({
      galleryId: snapshot.galleryId,
      collectedAt: {
        $gte: new Date(Date.now() - config.longWindowMin * 60 * 1000) // 최근 longWindowMin 분 데이터
      }
    }).sort({ collectedAt: -1 }).limit(200);
    
    // 비교 모집단 구성
    const populationSlopes = [];
    const recentPostNos = [...new Set(recentSnapshots.map(s => s.postNo))]; // 중복 제거
    
    for (const pNo of recentPostNos) {
      const slopes = await calculateSlopes(pNo, snapshot.galleryId);
      populationSlopes.push(...slopes.filter(s => s > 0)); // 양수 기울기만 포함
    }
    
    // short/long slope 계산
    const shortSlopes = await calculateSlopes(snapshot.postNo, snapshot.galleryId, config.shortWindowMin);
    const longSlopes = await calculateSlopes(snapshot.postNo, snapshot.galleryId, config.longWindowMin);
    const shortSlope = shortSlopes[0] || 0;
    const longSlope = longSlopes.length ? (longSlopes.reduce((a,b)=>a+b,0)/longSlopes.length) : 0;
    const ratio = longSlope > 0 ? shortSlope / longSlope : Infinity;
    const deltaSlope = shortSlope - longSlope;

    // Z-Score 계산
    const zScore = calculateZScore(recChangePerMin, populationSlopes);
    
    // 다중 조건 평가 (Z-Score 절댓값 사용)
    const isSpike =
      (ratio >= config.slopeRatioThresh && deltaSlope > 0) ||
      (deltaSlope >= config.slopeDeltaThresh) ||
      (Math.abs(zScore) >= config.zScoreThreshold);
    
    // 이상치 감지
    if (isSpike) {
      console.log(`⚠️ 이상치 감지: ${snapshot.postNo} (Z-Score: ${zScore.toFixed(2)}, 단기/장기 비율: ${ratio.toFixed(2)}, 델타: ${deltaSlope.toFixed(2)})`);
      
      // 이상치 레코드 생성 - 새로운 지표 포함
      const anomaly = await Anomaly.create({
        postNo: snapshot.postNo,
        galleryId: snapshot.galleryId,
        detectedAt: new Date(),
        startedAt: prevSnapshot.collectedAt,
        statistics: {
          zScore,
          recChangePerMin,
          shortSlope,
          longSlope,
          slopeRatio: ratio,
          slopeDelta: deltaSlope,
          beforeRecommend: prevSnapshot.recommend,
          afterRecommend: snapshot.recommend
        }
      });
      
      return anomaly;
    }
    
    return null; // 이상치 아님
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
