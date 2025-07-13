/**
 * 디시인사이드 갤러리 크롤러
 */
const dcCrawler = require('@gurumnyang/dcinside.js');
const config = require('../config/config');
const Post = require('../models/post.model');
const Snapshot = require('../models/snapshot.model');

/**
 * 갤러리 게시글 목록 크롤링
 * @param {string} galleryId - 갤러리 ID
 * @param {number} page - 페이지 번호 (기본값: 1)
 * @param {string} boardType - 게시판 타입 (기본값: 'all')
 * @returns {Promise<Array>} - 저장된 스냅샷 객체들의 배열
 */
async function crawlGallery(galleryId, page = 1, boardType = 'all') {
  try {
    console.log(`🔎 크롤링 시작: ${galleryId} 갤러리 ${page} 페이지`);
    
    // 게시글 목록 수집
    const postInfoList = await dcCrawler.getPostList({
      page,
      galleryId,
      boardType
    });
    
    // 디버깅을 위한 샘플 데이터 로깅
    if (postInfoList.length > 0) {
      const samplePost = postInfoList[0];
      console.log(`📊 샘플 게시글 데이터:`, {
        id: samplePost.id,
        title: samplePost.title,
        author: samplePost.author,
        date: samplePost.date,
        type: samplePost.type,
        subject: samplePost.subject
      });
    }
    
    console.log(`✅ ${postInfoList.length}개 게시글 정보 수집 완료`);
    
    // 저장된 스냅샷을 담을 배열
    const savedSnapshots = [];
    
    // 게시글 정보 처리
    for (const postInfo of postInfoList) {
      // 공지사항은 건너뜀
      if (postInfo.type === 'notice') continue;
      
      try {
        // 1. 게시글 기본 정보 저장 (없는 경우에만)
        let post = await Post.findOne({ postNo: postInfo.id });
        if (!post) {
          // 날짜 파싱 시도
          let postDate = new Date();
          try {
            // 한국어 날짜 형식 파싱 (예: "24.07.11 12:34:56")
            if (typeof postInfo.date === 'string') {
              if (postInfo.date.includes('.')) {
                const [datePart, timePart] = postInfo.date.split(' ');
                const [year, month, day] = datePart.split('.').map(part => part.trim());
                
                // 2자리 연도를 4자리로 변환 (예: "24" → "2024")
                const fullYear = year.length === 2 ? `20${year}` : year;
                
                if (timePart && timePart.includes(':')) {
                  const [hours, minutes, seconds] = timePart.split(':').map(part => part.trim());
                  postDate = new Date(fullYear, parseInt(month) - 1, day, hours || 0, minutes || 0, seconds || 0);
                } else {
                  postDate = new Date(fullYear, parseInt(month) - 1, day);
                }
              }
            }
          } catch (dateErr) {
            console.log(`⚠️ 날짜 파싱 오류 [${postInfo.id}]: ${postInfo.date}`, dateErr);
            postDate = new Date(); // 오류 시 현재 시간으로 대체
          }
          
          post = await Post.create({
            postNo: postInfo.id,
            galleryId,
            title: postInfo.title,
            author: {
              nickname: postInfo.author.nickname,
              userId: postInfo.author.userId,
              ip: postInfo.author.ip
            },
            date: postDate,
            type: postInfo.type || 'unknown', // type이 없을 경우 unknown으로 설정
            subject: postInfo.subject
          });
          console.log(`📝 새 게시글 등록: [${postInfo.id}] ${postInfo.title}`);
        }
        
        // 2. 게시글 스냅샷 저장
        const snapshot = await Snapshot.create({
          postNo: postInfo.id,
          galleryId,
          recommend: postInfo.recommend,
          viewCount: postInfo.count,
          replyCount: postInfo.replyCount,
          collectedAt: new Date()
        });
        
        savedSnapshots.push(snapshot);
      } catch (err) {
        console.error(`❌ 게시글 처리 오류 [${postInfo.id}]:`, err.message);
        // 유효성 검증 오류 상세 정보
        if (err.name === 'ValidationError' && err.errors) {
          Object.keys(err.errors).forEach(field => {
            console.error(`  - ${field}: ${err.errors[field].message}`);
          });
        }
        // 처리 중이던 게시글 데이터 로깅
        console.error(`  게시글 데이터:`, {
          id: postInfo.id,
          title: postInfo.title,
          date: postInfo.date,
          type: postInfo.type
        });
      }
    }
    
    console.log(`✅ ${savedSnapshots.length}개 스냅샷 저장 완료`);
    return savedSnapshots;
  } catch (err) {
    console.error(`❌ 크롤링 오류 (${galleryId}):`, err.message);
    throw err;
  }
}

module.exports = { crawlGallery };
