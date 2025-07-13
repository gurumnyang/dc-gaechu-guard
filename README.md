# DC Gall Guard (디시인사이드 갤러리 추천수 조작 감지 시스템)

디시인사이드 갤러리의 게시글 추천수를 주기적으로 모니터링하고, 비정상적인 추천수 증가 패턴을 감지하는 시스템입니다.

## 주요 기능

- **게시글 모니터링**: 15분 간격으로 지정된 갤러리의 게시글을 크롤링
- **추천수 변화 추적**: 시계열 데이터로 게시글별 추천수 변화 기록
- **이상치 감지**: 통계적 분석을 통한 비정상적인 추천수 증가 감지
- **알림 기능**: Slack을 통한 이상치 발견 시 알림
- **REST API**: 게시글 및 이상치 데이터 조회 API 제공

## 시스템 요구사항

- Node.js 16.0.0 이상
- MongoDB 4.0 이상
- NPM 또는 Yarn 패키지 매니저

## 설치 방법

1. 저장소 클론

```bash
git clone https://github.com/yourusername/dcinside-watchdog.git
cd dcinside-watchdog
```

2. 의존성 패키지 설치

```bash
npm install
```

3. 환경 변수 설정

`.env` 파일을 생성하고 다음 변수들을 설정:

```
# MongoDB 연결 정보
MONGODB_URI=mongodb://localhost:27017/dcinside-watchdog

# 크롤링 설정
TARGET_GALLERY_IDS=programming,hit  # 쉼표로 구분된 갤러리 ID 목록
CRON_EXPR=*/15 * * * *  # Cron 표현식 (기본: 15분마다)
CRAWL_PAGES=1  # 각 갤러리당 크롤링할 페이지 수
CRAWL_DELAY_MS=100  # 요청 간 지연 시간(ms)

# 이상 감지 설정
Z_SCORE_THRESHOLD=3  # Z-Score 임계값
MIN_REC_CHANGE=5  # 최소 추천수 변화량 임계값

# API 설정
API_PORT=3000
API_KEY=your_secret_api_key_here

# 알림 설정 (선택)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ
```

## 사용 방법

### 프로젝트 실행

```bash
# 일반 실행
npm start

# 개발 모드 실행 (자동 재시작)
npm run dev
```

### API 엔드포인트

| 메서드   | 경로                    | 설명                 |
| ----- | --------------------- | ------------------ |
| GET   | /api/posts            | 게시글 목록/검색          |
| GET   | /api/posts/:id        | 게시글 정보             |
| GET   | /api/posts/:id/snapshots | 게시글 추천수 시계열        |
| GET   | /api/anomalies        | 이상치 목록             |
| GET   | /api/anomalies/:id    | 이상치 상세             |
| PATCH | /api/anomalies/:id    | 이상치 상태변경           |

### API 인증

요청 헤더에 API 키를 포함시켜야 합니다:

```
X-API-Key: your_secret_api_key_here
```

## 시스템 구성

- **크롤러**: `@gurumnyang/dcinside.js` 라이브러리를 사용한 게시글 데이터 수집
- **데이터베이스**: MongoDB (Time-series 기반 스냅샷 저장)
- **이상치 감지**: Z-Score 기반 통계적 이상치 감지 알고리즘
- **API 서버**: Express.js 기반 REST API
- **스케줄러**: node-cron을 사용한 주기적 크롤링

## 라이선스

ISC

## 주의사항

- 디시인사이드의 이용약관을 준수해주세요
- 과도한 크롤링은 IP 차단을 유발할 수 있으니 적절한 지연 시간을 설정하세요
- 수집한 데이터는 개인 연구, 분석 등의 비상업적 용도로만 사용해주세요
