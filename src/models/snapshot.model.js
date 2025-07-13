/**
 * 게시글 스냅샷 모델 (타임시리즈)
 */
const mongoose = require('mongoose');

const snapshotSchema = new mongoose.Schema({
  // 게시글 식별자
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
  
  // 추천수 
  recommend: {
    type: Number,
    default: 0
  },
  
  // 조회수
  viewCount: {
    type: Number,
    default: 0
  },
  
  // 댓글수
  replyCount: {
    type: Number,
    default: 0
  },
  
  // 스냅샷 수집 시간
  collectedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// 90일 경과 데이터 자동 삭제 (TTL 인덱스)
snapshotSchema.index({ collectedAt: 1 }, { 
  expireAfterSeconds: 90 * 24 * 60 * 60 // 90일 (초 단위)
});

module.exports = mongoose.model('Snapshot', snapshotSchema);
