# 2025 청년부 수련회 퀴즈 시스템 설치 가이드

## 🚀 Supabase 데이터베이스 설정

### 1단계: 기존 테이블 삭제 (필요한 경우)
```sql
-- drop-tables.sql 실행
-- Supabase SQL Editor에서 실행
```

### 2단계: 테이블 생성 및 초기 데이터
```sql
-- create-tables-with-data.sql 실행
-- Supabase SQL Editor에서 실행
```

### 3단계: Questions 테이블 추가 (60문제 데이터)
```sql
-- add-questions-table.sql 실행
-- Supabase SQL Editor에서 실행
```

### 4단계: Realtime 설정
1. Supabase 대시보드 → Database → Replication
2. 다음 테이블들의 Realtime 활성화:
   - `participants`
   - `survey_state`
   - `responses`
   - `questions`
   - `activity_logs`

### 5단계: RLS (Row Level Security) 확인
모든 테이블에 대해 anon 사용자가 읽기/쓰기 가능하도록 설정되어 있는지 확인

## 📁 파일 구조

### 핵심 모듈
- `config.js` - Supabase 연결 설정
- `supabase-realtime.js` - 실시간 동기화 모듈
- `session-manager.js` - 사용자 세션 관리 (localStorage + 쿠키)
- `sync-manager.js` - 통합 동기화 관리자

### 페이지별 스크립트
- `app-new.js` - 사용자 화면 로직
- `admin-new.js` - 관리자 화면 로직

### HTML 페이지
- `index.html` - 사용자 화면
- `admin.html` - 관리자 화면
- `result.html` - 결과 화면

## ⚙️ 환경 설정

### config.js 수정
```javascript
const SUPABASE_CONFIG = {
    url: 'YOUR_SUPABASE_URL',
    anonKey: 'YOUR_SUPABASE_ANON_KEY'
};
```

### Netlify/Vercel 환경변수
- `SUPABASE_URL` - Supabase 프로젝트 URL
- `SUPABASE_ANON_KEY` - Supabase anon 키

## 🔄 동기화 흐름

### 1. 관리자 액션
```
Admin Action → SyncManager.updateQuizState() 
→ SupabaseRealtime.updateQuizState()
→ Supabase DB Update
→ Realtime Broadcast
```

### 2. 사용자 수신
```
Supabase Realtime Event
→ SupabaseRealtime.handleStateChange()
→ SyncManager.handleUserStateChange()
→ UI Update (showQuestion)
```

### 3. Fallback (Supabase 연결 실패 시)
```
LocalStorage Update
→ Storage Event
→ SyncManager.checkStateUpdate()
→ UI Update
```

## 🐛 디버깅

### 콘솔에서 확인
```javascript
// Supabase 연결 상태
SupabaseRealtime.isConnected

// 현재 동기화 상태
SyncManager.getCurrentState()

// 사용자 정보
SessionManager.getUserInfo()

// 디버그 모드 활성화
SupabaseRealtime.DEBUG = true
SyncManager.DEBUG = true
SessionManager.DEBUG = true
```

### 문제 해결

#### 1. 실시간 동기화 안됨
- Supabase Realtime 활성화 확인
- RLS 정책 확인
- 브라우저 콘솔에서 WebSocket 연결 확인

#### 2. 3번 문제부터 전환 안됨
- `SyncManager.getCurrentState()` 확인
- `APP_STATE.currentQuestion` 값 확인
- 질문 데이터 존재 여부 확인

#### 3. 사용자 정보 소실
- 쿠키 활성화 확인
- `SessionManager.getUserInfo()` 결과 확인
- localStorage에 'user_info' 키 존재 확인

## 📊 데이터 구조

### survey_state 테이블
```sql
- status: 'waiting' | 'active' | 'finished'
- current_question: 현재 문제 번호 (1-60)
- current_session: 현재 세션 번호 (1-10)
- timer_end: 타이머 종료 시간
```

### questions 테이블
```sql
- question_number: 문제 번호 (1-60)
- session_number: 세션 번호 (1-10)
- question_type: 질문 유형
- question_text: 질문 내용
- options: 선택지 (JSONB)
- timer_seconds: 제한 시간
```

### participants 테이블
```sql
- user_id: 사용자 고유 ID
- nickname: 닉네임
- gender: 'male' | 'female'
- color_hex: 할당된 색상
- is_active: 활성 상태
```

### responses 테이블
```sql
- user_id: 사용자 ID
- question_id: 문제 번호
- answer_text: 답변 내용
- response_time_ms: 응답 시간
- session_number: 세션 번호
```

## 🎯 테스트 체크리스트

- [ ] Supabase 연결 성공
- [ ] 관리자 로그인 (비밀번호 제거됨)
- [ ] 사용자 등록 및 색상 할당
- [ ] 퀴즈 시작
- [ ] 문제 1 → 2 → 3 전환
- [ ] 실시간 응답 수집
- [ ] 실시간 차트 업데이트
- [ ] 통계 화면 표시
- [ ] 브라우저 새로고침 후 세션 유지
- [ ] 다른 기기에서 동기화 확인

## 📞 지원

문제 발생 시 브라우저 콘솔 로그와 함께 문의해주세요.