/**
 * API 라우터 - 이상치 관련
 */
const express = require('express');
const router = express.Router();
const Anomaly = require('../models/anomaly.model');
const Post = require('../models/post.model');

// 이상치 목록 조회
router.get('/', async (req, res) => {
  try {
    const { 
      galleryId, 
      status, 
      page = 1, 
      limit = 20, 
      sort = '-detectedAt'
    } = req.query;
    
    // 검색 조건
    const query = {};
    if (galleryId) query.galleryId = galleryId;
    if (status) query.status = status;
    
    // 페이징
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 이상치 조회
    const anomalies = await Anomaly.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    // 게시글 제목 정보 추가
    const postInfos = await Promise.all(anomalies.map(async (anomaly) => {
      const post = await Post.findOne({ postNo: anomaly.postNo });
      return {
        ...anomaly.toObject(),
        postTitle: post ? post.title : '(게시글 정보 없음)',
        postAuthor: post ? post.author.nickname : '알 수 없음'
      };
    }));
    
    // 전체 개수 조회
    const total = await Anomaly.countDocuments(query);
    
    res.json({
      success: true,
      data: postInfos,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// 이상치 상세 조회
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const anomaly = await Anomaly.findById(id);
    
    if (!anomaly) {
      return res.status(404).json({
        success: false,
        error: '이상치 데이터를 찾을 수 없습니다.'
      });
    }
    
    // 관련 게시글 정보 조회
    const post = await Post.findOne({ postNo: anomaly.postNo });
    
    res.json({
      success: true,
      data: {
        ...anomaly.toObject(),
        post: post || null
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// 이상치 상태 변경
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, memo } = req.body;
    
    // 유효한 상태값 확인
    const validStatuses = ['new', 'confirmed', 'ignored'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 상태값입니다.'
      });
    }
    
    // 변경할 필드만 업데이트
    const updateData = {};
    if (status) updateData.status = status;
    if (memo !== undefined) updateData.memo = memo;
    
    const updatedAnomaly = await Anomaly.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );
    
    if (!updatedAnomaly) {
      return res.status(404).json({
        success: false,
        error: '이상치 데이터를 찾을 수 없습니다.'
      });
    }
    
    res.json({
      success: true,
      data: updatedAnomaly
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
