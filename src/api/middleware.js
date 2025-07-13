/**
 * API 인증 미들웨어
 */
const config = require('../config/config');

/**
 * API 키 인증 미들웨어
 */
function apiKeyAuth(req, res, next) {
  // 개발 환경이거나 API 키가 설정되지 않은 경우 인증 생략
  if (config.nodeEnv === 'development' && !config.apiKey) {
    return next();
  }
  
  // 요청 헤더에서 API 키 확인
  const apiKey = req.headers['x-api-key'];
  
  // API 키 검증
  if (!apiKey || apiKey !== config.apiKey) {
    return res.status(401).json({
      success: false,
      error: '유효하지 않은 API 키입니다.'
    });
  }
  
  next();
}

module.exports = { apiKeyAuth };
