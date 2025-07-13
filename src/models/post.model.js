/**
 * 게시글 정보 모델 (최초 발견 시 저장)
 */
const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  // 게시글 고유 식별자
  postNo: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // 갤러리 ID
  galleryId: {
    type: String,
    required: true,
    index: true
  },
  
  // 제목
  title: {
    type: String,
    required: true
  },
  
  // 작성자 정보
  author: {
    nickname: String,
    userId: String,
    ip: String
  },
  
  // 작성 날짜
  date: {
    type: Date,
    default: Date.now
  },
  
  // 게시글 타입
  type: {
    type: String,
    enum: ['notice', 'picture', 'text', 'survey', 'recommended', 'unknown'],
    default: 'unknown'
  },
  
  // 말머리
  subject: String,
  
  // 최초 발견 시간
  firstDetectedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Post', postSchema);
