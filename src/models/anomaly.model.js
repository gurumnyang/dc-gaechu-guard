/**
 * 이상치 감지 모델
 */
const mongoose = require('mongoose');

const anomalySchema = new mongoose.Schema({
  // 연관된 게시글 번호
  postNo: {
    type: String,
    required: true,
    index: true
  },
  
  // 갤러리 ID
  galleryId: {
    type: String,
    required: true,
    index: true
  },
  
  // 이상 발생 시간
  detectedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // 이상치 감지 시작 시간
  startedAt: {
    type: Date,
    required: true
  },
  
  // 통계 수치
  statistics: {
    zScore: Number,             // Z-Score 값
    recChangePerMin: Number,    // 분당 추천수 변화량
    shortSlope: Number,         // 최근 단기(S분) 구간의 기울기
    longSlope: Number,          // 최근 장기(L분) 구간의 평균 기울기
    slopeRatio: Number,         // 단기/장기 기울기 비율
    slopeDelta: Number,         // 단기-장기 기울기 차이
    beforeRecommend: Number,    // 이상 발생 전 추천수
    afterRecommend: Number      // 이상 발생 후 추천수
  },
  
  // 상태 
  status: {
    type: String,
    enum: ['new', 'confirmed', 'ignored'],
    default: 'new'
  },
  
  // 메모 (관리자용)
  memo: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Anomaly', anomalySchema);
