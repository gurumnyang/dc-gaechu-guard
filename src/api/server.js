/**
 * API 서버 설정
 */
const express = require('express');
const path = require('path');
const config = require('../config/config');
const { apiKeyAuth } = require('./middleware');
const postsRoutes = require('./posts.routes');
const anomaliesRoutes = require('./anomalies.routes');
const dashboardRoutes = require('./dashboard.routes');
const session = require('express-session');

// Express 앱 생성
const app = express();

// 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 정적 파일 제공
app.use(express.static(path.join(__dirname, '../../public')));

// EJS 템플릿 엔진 설정
app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'ejs');

// 세션 설정
app.use(session({
  secret: 'dc-gall-guard-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// CORS 설정 (필요시)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-API-Key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// API 경로에 인증 미들웨어 적용
app.use('/api', apiKeyAuth);

// 대시보드 라우트
app.get('/dashboard', (req, res) => {
  res.render('dashboard', {
    title: 'DC 갤러리 가드 - 모니터링 대시보드'
  });
});

app.get('/dashboard/anomalies', (req, res) => {
  res.render('anomalies', {
    title: 'DC 갤러리 가드 - 이상치 목록'
  });
});

app.get('/dashboard/posts', (req, res) => {
  res.render('posts', {
    title: 'DC 갤러리 가드 - 게시글 목록'
  });
});

// 특정 게시글의 추천수 시계열 차트 페이지
app.get('/dashboard/posts/:postNo/snapshots', (req, res) => {
  const { postNo } = req.params;
  res.render('snapshots', {
    title: `DC 갤러리 가드 - 게시글 ${postNo} 추천수 추이`,
    postNo
  });
});

app.get('/dashboard/stats', (req, res) => {
  res.render('stats', {
    title: 'DC 갤러리 가드 - 통계'
  });
});

// 게시글 상세 페이지 라우트
app.get('/posts/:galleryId/:postNo', async (req, res) => {
  try {
    const { galleryId, postNo } = req.params;
    const Post = require('../models/post.model');
    const post = await Post.findOne({ galleryId, postNo });
    
    if (!post) {
      return res.status(404).render('error', {
        title: 'DC 갤러리 가드 - 오류',
        error: '게시글을 찾을 수 없습니다.'
      });
    }
    
    res.render('snapshots', {
      title: `DC 갤러리 가드 - ${post.title}`,
      post,
      postNo: post.postNo,
      galleryId: post.galleryId
    });
  } catch (err) {
    console.error('게시글 페이지 조회 오류:', err);
    res.status(500).render('error', {
      title: 'DC 갤러리 가드 - 오류',
      error: '게시글을 조회하는 중 오류가 발생했습니다.'
    });
  }
});

// 기본 라우트
app.get('/', (req, res) => {
  res.json({
    name: 'DC Gall Guard API',
    version: '1.0.0',
    status: 'running'
  });
});

// API 라우트
app.use('/api/posts', postsRoutes);
app.use('/api/anomalies', anomaliesRoutes);

// 디버그 라우트
app.get('/debug', (req, res) => {
  res.render('debug', {
    title: 'DC 갤러리 가드 - 디버그 모드',
    config: {
      slopeRatioThresh: config.slopeRatioThresh,
      slopeDeltaThresh: config.slopeDeltaThresh
    }
  });
});

// 대시보드 라우트와 기타 라우트
app.use('/dashboard', dashboardRoutes);
app.use('/debug', dashboardRoutes);
app.use('/', dashboardRoutes);
app.use('/', postsRoutes);
app.use('/', anomaliesRoutes);

// 404 처리
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '요청한 리소스를 찾을 수 없습니다.'
  });
});

// 오류 처리 미들웨어
app.use((err, req, res, next) => {
  console.error('❌ API 오류:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: config.nodeEnv === 'production' ? '서버 오류가 발생했습니다.' : err.message
  });
});

/**
 * API 서버 시작
 */
function startServer() {
  const port = config.apiPort;
  
  app.listen(port, () => {
    console.log(`✅ API 서버가 ${port} 포트에서 실행 중입니다.`);
  });
}

module.exports = { app, startServer };
