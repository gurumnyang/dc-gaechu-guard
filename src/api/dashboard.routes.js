/**
 * 대시보드 라우트 설정
 */
const express = require('express');
const router = express.Router();
const Post = require('../models/post.model');
const Anomaly = require('../models/anomaly.model');
const Snapshot = require('../models/snapshot.model');
const config = require('../config/config');
const { calculateSlopes, calculateZScore } = require('../detector/anomaly-detector');
const { revalidateAllSnapshots } = require('../detector/validator');

// 통계 데이터 API
router.get('/api/stats', async (req, res) => {
  try {
    const totalPosts = await Post.countDocuments();
    const totalAnomalies = await Anomaly.countDocuments();
    const recentAnomalies = await Anomaly.find().sort({ detectedAt: -1 }).limit(5);
    
    // 각 이상치에 대한 게시글 정보 조회 (populate 대신)
    for (let anomaly of recentAnomalies) {
      const post = await Post.findOne({ postNo: anomaly.postNo });
      if (post) {
        anomaly = anomaly.toObject();
        anomaly.post = post;
      }
    }
    
    // 갤러리별 이상치 통계
    const galleryStats = await Anomaly.aggregate([
      {
        $group: {
          _id: "$galleryId",
          count: { $sum: 1 },
          avgZScore: { $avg: "$zScore" }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    // 시간별 이상치 발생 추이 (최근 7일)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const dailyAnomalies = await Anomaly.aggregate([
      {
        $match: { detectedAt: { $gte: sevenDaysAgo } }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$detectedAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.json({
      totalPosts,
      totalAnomalies,
      recentAnomalies,
      galleryStats,
      dailyAnomalies
    });
  } catch (err) {
    console.error('통계 데이터 조회 오류:', err);
    res.status(500).json({ error: '통계 데이터를 조회하는 중 오류가 발생했습니다.' });
  }
});

// 모든 이상치 데이터 조회 API
router.get('/api/anomalies/data', async (req, res) => {
  try {
    // 페이징 처리
    const page = parseInt(req.query.page) || 0;
    const size = parseInt(req.query.size) || 10;
    const skip = page * size;
    
    // 정렬 옵션
    const sortField = req.query.sort || 'detectedAt';
    const sortOrder = req.query.order === 'asc' ? 1 : -1;
    const sortOptions = {};
    sortOptions[sortField] = sortOrder;
    
    // 필터링
    const filter = {};
    if (req.query.gallery) filter.galleryId = req.query.gallery;
    // Z-Score 필터링 (statistics 객체 내부)
    if (req.query.minZScore) filter['statistics.zScore'] = { $gte: parseFloat(req.query.minZScore) };
    
    // 데이터 조회 (lean 사용)
    const anomalies = await Anomaly.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(size)
      .lean();

    // postNo로 연관 게시글 정보 일괄 조회 및 매핑
    if (anomalies.length > 0) {
      const postNos = anomalies.map(a => a.postNo);
      const posts = await Post.find({ postNo: { $in: postNos } }).lean();
      const postMap = {};
      posts.forEach(p => { postMap[p.postNo] = p; });
      anomalies.forEach(a => { a.post = postMap[a.postNo] || null; });
    }
    
    const totalFiltered = await Anomaly.countDocuments(filter);
    const totalAll = await Anomaly.countDocuments();
    const draw = parseInt(req.query.draw) || 0;
    
    // DataTables server-side response
    res.json({
      draw,
      recordsTotal: totalAll,
      recordsFiltered: totalFiltered,
      data: anomalies
    });
  } catch (err) {
    console.error('이상치 데이터 조회 오류:', err);
    res.status(500).json({ error: '이상치 데이터를 조회하는 중 오류가 발생했습니다.' });
  }
});

// 모든 게시글 데이터 조회 API
router.get('/api/posts/data', async (req, res) => {
  try {
    // 페이징 처리
    const page = parseInt(req.query.page) || 0;
    const size = parseInt(req.query.size) || 10;
    const skip = page * size;
    
    // 정렬 옵션
    const sortField = req.query.sort || 'createdAt';
    const sortOrder = req.query.order === 'asc' ? 1 : -1;
    const sortOptions = {};
    sortOptions[sortField] = sortOrder;
    
    // 필터링
    const filter = {};
    if (req.query.gallery) filter.galleryId = req.query.gallery;
    if (req.query.subject) filter.subject = { $regex: req.query.subject, $options: 'i' };
    
    // 데이터 조회 (lean 사용)
    const posts = await Post.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(size)
      .lean();
    
    // 이상치 여부 매핑
    let anomalyMap = {};
    if (posts.length > 0) {
      const postNos = posts.map(p => p.postNo);
      const anomalies = await Anomaly.find({ postNo: { $in: postNos } })
        .select('postNo')
        .lean();
      anomalies.forEach(a => { anomalyMap[a.postNo] = true; });
    }
    const data = posts.map(p => ({
      ...p,
      hasAnomaly: !!anomalyMap[p.postNo]
    }));
    
    const totalFiltered = await Post.countDocuments(filter);
    const totalAll = await Post.countDocuments();
    const draw = parseInt(req.query.draw) || 0;
    
    res.json({
      draw,
      recordsTotal: totalAll,
      recordsFiltered: totalFiltered,
      data
    });
  } catch (err) {
    console.error('게시글 데이터 조회 오류:', err);
    res.status(500).json({ error: '게시글 데이터를 조회하는 중 오류가 발생했습니다.' });
  }
});

// 특정 게시글의 스냅샷(개추수 시계열) 조회 API
router.get('/api/posts/:postNo/snapshots', async (req, res) => {
  try {
    const { postNo } = req.params;
    // 날짜 범위 필터링 (옵션)
    const filter = { postNo };
    if (req.query.startDate) filter.collectedAt = { ...filter.collectedAt, $gte: new Date(req.query.startDate) };
    if (req.query.endDate) filter.collectedAt = { ...filter.collectedAt, $lte: new Date(req.query.endDate) };
    // 스냅샷 조회 및 정렬
    const snapshots = await Snapshot.find(filter).sort({ collectedAt: 1 }).lean();
    // 응답 데이터 구성
    const data = snapshots.map(s => ({ time: s.collectedAt, recommend: s.recommend }));
    res.json({ postNo, data });
  } catch (err) {
    console.error('스냅샷 데이터 조회 오류:', err);
    res.status(500).json({ error: '스냅샷 데이터를 조회하는 중 오류가 발생했습니다.' });
  }
});

// 디버그용 게시글 통계 데이터 조회 API
router.get('/debug/api/posts', async (req, res) => {
  try {
    // DataTables 서버 사이드 처리를 위한 파라미터 파싱
    const draw = parseInt(req.query.draw) || 1;
    const start = parseInt(req.query.start) || 0;
    const length = parseInt(req.query.length) || 10;
    
    // 정렬 옵션
    let sortField = 'createdAt';
    let sortOrder = -1;
    
    // DataTables 정렬 파라미터 처리
    if (req.query.order && req.query.order[0]) {
      const orderColumn = parseInt(req.query.order[0].column);
      const direction = req.query.order[0].dir === 'asc' ? 1 : -1;
      
      // 컬럼 매핑 (인덱스 -> 필드 이름)
      const columns = ['galleryId', 'postNo', 'title', 'latestRecommend', 'prevRecommend', 
                      'recChange', 'recChangePerMin', 'timeDiffMin', 'shortSlope', 'longSlope',
                      'slopeRatio', 'slopeDelta', 'zScore', 'snapshotCount', 'lastSnapshot', 'createdAt'];
                      
      if (orderColumn >= 0 && orderColumn < columns.length) {
        sortField = columns[orderColumn];
        sortOrder = direction;
      }
    }
    
    const sortOptions = {};
    sortOptions[sortField] = sortOrder;
    
    // 검색 필터링
    const filter = {};
    
    // 갤러리 필터
    if (req.query.gallery) filter.galleryId = req.query.gallery;
    
    // DataTables 검색어 처리
    if (req.query.search && req.query.search.value) {
      const searchValue = req.query.search.value;
      filter.$or = [
        { galleryId: { $regex: searchValue, $options: 'i' } },
        { postNo: { $regex: searchValue, $options: 'i' } },
        { title: { $regex: searchValue, $options: 'i' } }
      ];
    }
    
    // 최근 게시글 조회 (lean 사용)
    const posts = await Post.find(filter)
      .sort(sortOptions)
      .skip(start)
      .limit(length)
      .lean();
    
    // 게시글별 통계 계산
    const debugData = [];
    
    // 모든 게시글에 대한 스냅샷 통계 수집
    for (const post of posts) {
      try {
        // 최근 스냅샷 데이터 조회
        const snapshots = await Snapshot.find({ 
          postNo: post.postNo, 
          galleryId: post.galleryId 
        })
        .sort({ collectedAt: -1 })
        .limit(360)
        .lean();
        
        if (snapshots.length >= 2) {
          // 최신 스냅샷 추천수 및 시간 차이
          const latestSnapshot = snapshots[0];
          const prevSnapshot = snapshots[1];
          const timeDiffMs = new Date(latestSnapshot.collectedAt) - new Date(prevSnapshot.collectedAt);
          const timeDiffMin = Math.max(timeDiffMs / 60000, 1);
          
          // 추천수 변화량 및 분당 변화량 계산
          const recChange = latestSnapshot.recommend - prevSnapshot.recommend;
          const recChangePerMin = recChange / timeDiffMin;
          
          // 단기/장기 기울기 계산
          const shortSlopes = await calculateSlopes(post.postNo, post.galleryId, config.shortWindowMin);
          const longSlopes = await calculateSlopes(post.postNo, post.galleryId, config.longWindowMin);
          const shortSlope = shortSlopes[0] || 0;
          const longSlope = longSlopes.length ? (longSlopes.reduce((a,b)=>a+b,0)/longSlopes.length) : 0;
          const ratio = longSlope > 0 ? shortSlope / longSlope : shortSlope > 0 ? Infinity : 0;
          const deltaSlope = shortSlope - longSlope;
          
          // 기존 기울기(변화율) 계산
          const slopes = await calculateSlopes(post.postNo, post.galleryId);
          
          // Z-Score 계산
          const zScore = slopes.length > 0 ? calculateZScore(slopes[0], slopes) : 0;
          
          // 버스트 감지 로직 (새로운 이상치 감지 방식)
          // 최근 shortWindowMin 이내의 스냅샷 가져오기
          const windowStart = new Date(new Date(latestSnapshot.collectedAt).getTime() - config.shortWindowMin * 60 * 1000);
          const windowSnapshots = snapshots.filter(s => new Date(s.collectedAt) >= windowStart);
          
          // 버스트 계산
          let burstCount = 0;
          if (windowSnapshots.length >= 2) {
            const oldestSnapshot = windowSnapshots[windowSnapshots.length - 1];
            burstCount = latestSnapshot.recommend - oldestSnapshot.recommend;
          }
          
          // 이상치 감지
          const isBurst = burstCount >= config.burstThreshold;
          const wouldBeDetected = isBurst;
          
          // 데이터 추가
          debugData.push({
            ...post,
            latestRecommend: latestSnapshot.recommend,
            prevRecommend: prevSnapshot.recommend,
            recChange: recChange,
            recChangePerMin: parseFloat(recChangePerMin.toFixed(2)),
            timeDiffMin: parseFloat(timeDiffMin.toFixed(2)),
            shortSlope: parseFloat(shortSlope.toFixed(2)),
            longSlope: parseFloat(longSlope.toFixed(2)),
            slopeRatio: parseFloat(ratio.toFixed(2)),
            slopeDelta: parseFloat(deltaSlope.toFixed(2)),
            zScore: parseFloat(zScore.toFixed(2)),
            isBurst: isBurst,
            burstCount: burstCount,
            burstWindowMin: config.shortWindowMin,
            burstThreshold: config.burstThreshold,
            wouldBeDetected: wouldBeDetected,
            snapshotCount: snapshots.length,
            lastSnapshot: latestSnapshot.collectedAt
          });
        } else {
          // 스냅샷이 충분하지 않은 경우
          debugData.push({
            ...post,
            latestRecommend: snapshots.length > 0 ? snapshots[0].recommend : 0,
            prevRecommend: 0,
            recChange: 0,
            recChangePerMin: 0,
            timeDiffMin: 0,
            shortSlope: 0,
            longSlope: 0,
            slopeRatio: 0,
            slopeDelta: 0,
            zScore: 0,
            isBurst: false,
            burstCount: 0,
            burstWindowMin: config.shortWindowMin,
            burstThreshold: config.burstThreshold,
            wouldBeDetected: false,
            snapshotCount: snapshots.length,
            lastSnapshot: snapshots.length > 0 ? snapshots[0].collectedAt : null
          });
        }
      } catch (err) {
        console.error(`디버그 통계 계산 오류 (${post.postNo}):`, err);
        debugData.push({
          ...post,
          latestRecommend: 0,
          prevRecommend: 0,
          recChange: 0,
          recChangePerMin: 0,
          timeDiffMin: 0,
          shortSlope: 0,
          longSlope: 0,
          slopeRatio: 0,
          slopeDelta: 0,
          zScore: 0,
          isBurst: false,
          burstCount: 0,
          burstWindowMin: config.shortWindowMin,
          burstThreshold: config.burstThreshold,
          wouldBeDetected: false,
          snapshotCount: 0,
          lastSnapshot: null,
          error: err.message
        });
      }
    }
    
    // 전체 데이터 수 및 필터링된 데이터 수 계산
    const totalAll = await Post.countDocuments();
    const totalFiltered = await Post.countDocuments(filter);
    
    // DataTables 응답 형식으로 반환
    res.json({
      draw: draw,
      recordsTotal: totalAll,
      recordsFiltered: totalFiltered,
      data: debugData
    });
  } catch (err) {
    console.error('디버그 통계 조회 오류:', err);
    res.status(500).json({ error: '디버그 통계를 조회하는 중 오류가 발생했습니다.' });
  }
});

// 디버그용 시스템 통계 API
router.get('/debug/api/stats', async (req, res) => {
  try {
    const postsCount = await Post.countDocuments();
    const snapshotsCount = await Snapshot.countDocuments();
    const anomaliesCount = await Anomaly.countDocuments();
    
    // 최근 크롤링 시간 확인 (가장 최근 스냅샷)
    const latestSnapshot = await Snapshot.findOne().sort({collectedAt: -1}).lean();
    const lastCrawl = latestSnapshot ? latestSnapshot.collectedAt : null;
    
    res.json({
      success: true,
      stats: {
        postsCount,
        snapshotsCount,
        anomaliesCount,
        lastCrawl
      }
    });
  } catch (err) {
    console.error('디버그 통계 조회 오류:', err);
    res.status(500).json({ 
      success: false,
      error: '디버그 시스템 통계를 조회하는 중 오류가 발생했습니다.' 
    });
  }
});

// 시스템 설정 조회 API
router.get('/debug/api/config', (req, res) => {
  try {
    // 이상치 감지 관련 설정만 반환
    const detectionConfig = {
      zScoreThreshold: config.zScoreThreshold,
      minRecChange: config.minRecChange,
      shortWindowMin: config.shortWindowMin,
      longWindowMin: config.longWindowMin,
      slopeRatioThresh: config.slopeRatioThresh,
      slopeDeltaThresh: config.slopeDeltaThresh
    };
    
    res.json({
      success: true,
      config: detectionConfig
    });
  } catch (err) {
    console.error('설정 조회 오류:', err);
    res.status(500).json({ 
      success: false,
      error: '시스템 설정을 조회하는 중 오류가 발생했습니다.' 
    });
  }
});



// 전체 스냅샷 재검증 API
router.post('/debug/api/revalidate-all', (req, res) => {
  try {
    // 이미 재검증 중인지 확인
    if (global.revalidationInProgress) {
      return res.json({
        success: false,
        message: '이미 재검증이 진행 중입니다.',
        startTime: global.revalidationStartTime
      });
    }
    
    // 실행 중 표시를 위한 상태 저장
    global.revalidationInProgress = true;
    global.revalidationStartTime = new Date();
    global.revalidationError = null;
    
    // 응답 먼저 전송
    res.json({
      success: true,
      message: '전체 스냅샷 재검증이 시작되었습니다.',
      startTime: global.revalidationStartTime
    });
    
    // 비동기로 재검증 실행
    setTimeout(() => {
      revalidateAllSnapshots()
        .then(success => {
          global.revalidationInProgress = false;
          global.revalidationEndTime = new Date();
          global.revalidationSuccess = success;
        })
        .catch(err => {
          global.revalidationInProgress = false;
          global.revalidationEndTime = new Date();
          global.revalidationSuccess = false;
          global.revalidationError = err.message;
          console.error('전체 스냅샷 재검증 중 오류:', err);
        });
    }, 100);
  } catch (err) {
    // 오류 발생 시 상태 리셋
    global.revalidationInProgress = false;
    console.error('재검증 시작 오류:', err);
    
    // 응답이 아직 전송되지 않았다면 오류 응답 전송
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false,
        error: '전체 스냅샷 재검증을 시작하는 중 오류가 발생했습니다.' 
      });
    }
  }
});

// 전체 스냅샷 재검증 상태 조회 API
router.get('/debug/api/revalidate-status', (req, res) => {
  try {
    // global 변수의 존재 여부 확인 후 안전하게 값 반환
    const status = {
      success: true,
      inProgress: !!global.revalidationInProgress,
      startTime: global.revalidationStartTime || null,
      endTime: global.revalidationEndTime || null,
      isSuccess: global.revalidationSuccess === undefined ? null : global.revalidationSuccess,
      error: global.revalidationError || null
    };
    
    res.json(status);
  } catch (err) {
    console.error('재검증 상태 조회 오류:', err);
    res.status(500).json({ 
      success: false,
      error: '재검증 상태를 조회하는 중 오류가 발생했습니다.' 
    });
  }
});

module.exports = router;
