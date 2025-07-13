

---

# 디시인사이드 갤러리 추천수 조작 감지 시스템

**(가칭: DC Gall Guard)**

---

## 1. 프로젝트 개요

* **목적**
  디시인사이드 특정 갤러리(들)에서 게시글의 **비정상적인 추천수(개추) 상승 패턴**을 자동 감지하는 시스템을 구축한다.
  크롤러가 주기적으로 갤러리 게시글의 추천수를 수집·기록하고, 시계열 데이터 기반 통계 분석을 통해 추천수 조작(개추봇, 집단 어뷰징 등) 의심 케이스를 탐지하여, 알림 및 API로 제공합니다.

---

## 2. 주요 기능 및 흐름

### 2.1 주요 기능

1. **게시글 추천수·조회수·댓글수 크롤링**

   * 대상 갤러리 게시판(복수 지정 가능)을 15분 간격으로 모니터링
   * 각 게시글별 추천수 변화 시계열을 DB에 기록

2. **추천수 급증 탐지**

   * 최근 추천수 변화 속도(기울기)를 분석
   * 통계적 이상치(z-score 3 이상 등), 임계치 초과 시 ‘이상 징후’로 등록

3. **REST API 제공**

   * 게시글별 추천수/조회수 시계열 조회
   * 이상치(조작 의심) 목록 및 상세정보 제공

4. **이상치 발생 시 알림**

   * Slack, Discord 등 웹훅 연동(선택)

---

### 2.2 서비스 흐름

```mermaid
flowchart TD
  A[스케줄러(15분)] --> B[갤러리 게시판 크롤링]
  B --> C[DB에 스냅샷 기록]
  C --> D[추천수 변화 분석]
  D -- 이상치 발견 --> E[anomaly 등록/알림]
  E --> F[REST API, 대시보드]
```

---

## 3. 기술 스택

| 구분      | 주요 도구/프레임워크                      |
| ------- | -------------------------------- |
| 크롤러     | Node.js, @gurumnyang/dcinside.js |
| DB      | MongoDB (Time-series collection) |
| API 서버  | Express.js (혹은 Fastify)          |
| 스케줄러    | node-cron                        |
| 알림/대시보드 | Slack Webhook, Grafana (선택)      |
| 배포      | Docker, Github Actions           |

---

## 4. 데이터 구조 (MongoDB)

* **posts**

  * 게시글 메타(최초 발견 시 저장, title, author 등)
* **snapshots**

  * 게시글별 추천수/조회수/댓글수, 스냅샷 시각
* **anomalies**

  * 조작 의심 내역 (발생 시각, 지속 시간, 통계값, 상태 등)

---

## 5. 추천수 조작 탐지 로직

* **슬로프(분당 추천수 증가량) 계산**
* 동일 갤러리, 유사 시간대의 평균/표준편차와 비교 (통계적 이상치 탐지)
* 급격한 추천수 변화(스파이크) 감지 시 ‘이상치’로 등록
  (예시: z-score 3 이상, 또는 분당 5회 이상 추천수 증가 지속)

---

## 6. REST API 명세(예시)

| 메서드   | 경로                    | 설명                 |
| ----- | --------------------- | ------------------ |
| GET   | /posts                | 게시글 목록/검색          |
| GET   | /posts/\:id           | 게시글 정보             |
| GET   | /posts/\:id/snapshots | 게시글 추천수 시계열        |
| GET   | /anomalies            | 이상치 목록             |
| GET   | /anomalies/\:id       | 이상치 상세             |
| PATCH | /anomalies/\:id       | 이상치 상태변경(확인, 무시 등) |

---

## 7. 운영/보안

* API는 내부 서비스용 또는 인증키 기반 접근 제한
* 크롤링 속도/동시성 제한, 과도한 트래픽 방지
* 90일 경과 시 스냅샷 자동 삭제(TTL 인덱스)

---

## 8. 기대 효과

* 운영자/관리자가 갤러리 내 추천수 조작 의심 글을 빠르게 확인, 대응할 수 있음
* 비정상적인 추천수 상승 패턴 데이터 축적 및 시각화 가능
* 개추 조작 이력의 자동화된 기록 및 검색 지원

---

## 9. 향후 확장

* UI 대시보드, 실시간 알림 강화
* 다른 커뮤니티 확장, 자동 차단 제휴 연동 등

---

## 10. 일정(예상)

| 단계          | 기간 |
| ----------- | -- |
| 요구사항 확정     | 1일 |
| 1차 프로토타입 개발 | 3일 |
| 통계/탐지 로직 튜닝 | 2일 |
| API/알림/운영화  | 2일 |

---

**문의 및 담당:**
(담당자명, 연락처, 슬랙 등)

---

필요시 양식·디자인/상세 목차 조정 가능합니다.
특정 부분을 더 상세하게 원하면 말씀해 주세요!


---

## 🔄 수정된 크롤링 파이프라인

```mermaid
graph TD
  subgraph Worker
    A[Scheduler<br/>(node-cron - 15분)] --> B[Fetch Board Page<br/>(getPostList *or* raw.scrapeBoardPage)]
    B --> C[Store Snapshot]
    C --> D[Anomaly Detector]
  end
  D -->|알림| Slack
  subgraph API
    E[REST API (Express)]
    E --> C
    E --> D
  end
```

### 1️⃣ Board → Snapshot

| 단계       | 함수                                                                                    | 설명                        |
| -------- | ------------------------------------------------------------------------------------- | ------------------------- |
| 목록 수집    | `getPostList({ page, galleryId, boardType:'all' })` <br/>**또는** `raw.scrapeBoardPage` | **추천수·조회수·댓글수**가 이미 들어 있음 |
| 필터/중복 제거 | `postInfo.id` 기준으로 최근 N분 내에 본 적 없는 글만 처리                                              | 필요 시 `Set` 사용             |
| 스냅샷 저장   | `snapshots` 컬렉션에 `postNo`, `recommend`, `viewCount`, `replyCount`, `collectedAt` 인서트  | TTL(90일) 인덱스              |

> **getPost**는 *이상치 확정 이후* 세부 내용을 보여줄 때만 on-demand 호출해도 됩니다 (선택).

---

## 🗂️ 데이터 모델 변경점

### snapshots (time-series)

```json
{
  "postNo": "1234567",
  "galleryId": "programming",
  "recommend": 42,
  "viewCount": 987,
  "replyCount": 5,
  "collectedAt": ISODate("2025-07-11T12:00:00+09:00")
}
```

* 기존 모델과 동일하지만 **본문 필드는 제거** → 경량화
* 추천수 변화만 보면 되므로 `title`, `author`도 필수가 아님
  (최초 발견 시만 posts 컬렉션에 저장)

### posts (정적 메타)

* 글 최초 발견 시 한 번만 기록
* anomaly 발생 시 상세조회 필요하면 `getPost`로 갱신

---

## 🧮 추천수 기울기 계산 예시 코드

```typescript
// TypeScript (worker/src/slope.ts)
import { snapshots } from './db'
import { differenceInMinutes } from 'date-fns'

export async function calcSlopes(postNo: string, windowMin = 30) {
  const docs = await snapshots
    .find({ postNo })
    .sort({ collectedAt: -1 })
    .limit(windowMin) // 최근 30회(=7.5h) 정도
    .toArray()

  const slopes = []
  for (let i = 1; i < docs.length; i++) {
    const Δrec = docs[i - 1].recommend - docs[i].recommend
    const Δt   = differenceInMinutes(docs[i - 1].collectedAt, docs[i].collectedAt)
    if (Δt > 0) slopes.push(Δrec / Δt)
  }
  return slopes              // [rec/min, ...]
}
```

---

## 💡 Anomaly Detector 조정

1. **슬로프 시계열**을 위 함수로 추출
2. `μ, σ` → 동일 갤러리·동일 시간대 기준 (아침/점심/밤 등)
3. `|z| > 3` & `Δrec ≥ 임계치` → 스파이크
4. 스파이크 지속시간이 **2개 스냅샷 이상**이면 anomalies 컬렉션에 insert

---

## 🛠️ REST API 영향

| 엔드포인트                      | 변경 사항                                   |
| -------------------------- | --------------------------------------- |
| `GET /posts/:id/snapshots` | **본문 없는 경량 시계열** 반환                     |
| `GET /anomalies/:id`       | 필요 시 `getPost` 호출 후 **lazy-load 본문** 포함 |

---

## 🚀 다음 액션

1. **크롤러 수정**: `getPostList`→ snapshot 로직 작성
2. **기존 코드 리팩터**: getPosts 의존부 제거 (테스트 통과 확인)
3. **EDA**로 새로운 슬로프 분포 재확인 → 임계치 재튜닝
4. 프로덕션 환경 변수(`TARGET_GALLERY_IDS`, `CRON_EXPR`) 분리

필요하면 상세 코드나 배포 예시도 이어서 도와드릴게요!
