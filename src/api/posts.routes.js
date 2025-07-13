/**
 * API 라우터 - 게시글 관련
 */
const express = require('express');
const router = express.Router();
const Post = require('../models/post.model');
const Snapshot = require('../models/snapshot.model');

// 게시글 목록 조회
router.get('/', async (req, res) => {
  try {
    const { 
      galleryId, 
      page = 1, 
      limit = 20, 
      sort = '-firstDetectedAt' 
    } = req.query;
    
    // 검색 조건
    const query = {};
    if (galleryId) query.galleryId = galleryId;
    
    // 페이징
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 게시글 조회
    const posts = await Post.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
      
    // 전체 개수 조회
    const total = await Post.countDocuments(query);
    
    res.json({
      success: true,
      data: posts,
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

// 게시글 상세 조회
router.get('/:postNo', async (req, res) => {
  try {
    const { postNo } = req.params;
    const post = await Post.findOne({ postNo });
    
    if (!post) {
      return res.status(404).json({
        success: false,
        error: '게시글을 찾을 수 없습니다.'
      });
    }
    
    res.json({
      success: true,
      data: post
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// 게시글 스냅샷 시계열 조회
router.get('/:postNo/snapshots', async (req, res) => {
  try {
    const { postNo } = req.params;
    const { limit = 100 } = req.query;
    
    const snapshots = await Snapshot.find({ postNo })
      .sort({ collectedAt: 1 })
      .limit(parseInt(limit));
    
    if (!snapshots.length) {
      return res.status(404).json({
        success: false,
        error: '해당 게시글의 스냅샷 데이터가 없습니다.'
      });
    }
    
    res.json({
      success: true,
      data: snapshots,
      meta: {
        count: snapshots.length,
        firstSnapshot: snapshots[0].collectedAt,
        lastSnapshot: snapshots[snapshots.length - 1].collectedAt
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
