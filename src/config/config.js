/**
 * 환경 변수 설정 파일
 */
require('dotenv').config();

module.exports = {
  // 서버 환경
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // MongoDB 연결 정보
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/dcinside-watchdog',

  // 크롤링 설정
  targetGalleryIds: (process.env.TARGET_GALLERY_IDS || 'programming').split(','),
  cronExpression: process.env.CRON_EXPR || '*/5 * * * *', // 기본: 5분마다
  crawlPages: parseInt(process.env.CRAWL_PAGES || '1', 10),
  crawlDelayMs: parseInt(process.env.CRAWL_DELAY_MS || '100', 10),

  // 이상 감지 설정
  zScoreThreshold: parseFloat(process.env.Z_SCORE_THRESHOLD || '3.0'),
  minRecChange: parseInt(process.env.MIN_REC_CHANGE || '5', 10),
  shortWindowMin: parseInt(process.env.SHORT_WINDOW_MIN || '10', 10),
  longWindowMin: parseInt(process.env.LONG_WINDOW_MIN || '60', 10),
  slopeRatioThresh: parseFloat(process.env.SLOPE_RATIO_THRESH || '4.0'),
  slopeDeltaThresh: parseFloat(process.env.SLOPE_DELTA_THRESH || '0.4'),

  // API 설정
  apiPort: parseInt(process.env.API_PORT || '3000', 10),
  apiKey: process.env.API_KEY,

  // 알림 설정
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
};
