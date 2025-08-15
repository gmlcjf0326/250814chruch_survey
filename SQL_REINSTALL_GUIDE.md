# Supabase SQL 재설치 가이드

## 기존 데이터베이스 초기화 및 새로 설치하기

### 1단계: Supabase 대시보드 접속
1. [Supabase](https://app.supabase.com) 로그인
2. 해당 프로젝트 선택
3. 왼쪽 메뉴에서 **SQL Editor** 클릭

### 2단계: 기존 테이블 삭제 (초기화)
SQL Editor에 다음 명령어를 실행하여 기존 테이블을 모두 삭제합니다:

```sql
-- 기존 테이블 삭제
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS responses CASCADE;
DROP TABLE IF EXISTS survey_state CASCADE;
DROP TABLE IF EXISTS participants CASCADE;

-- 기존 함수 삭제
DROP FUNCTION IF EXISTS get_color_for_gender CASCADE;
DROP FUNCTION IF EXISTS get_current_quiz_state CASCADE;
DROP FUNCTION IF EXISTS notify_state_change CASCADE;
DROP FUNCTION IF EXISTS notify_response_change CASCADE;
DROP FUNCTION IF EXISTS notify_participant_change CASCADE;

-- 기존 트리거 삭제 (이미 CASCADE로 삭제됨)

-- 기존 뷰 삭제
DROP VIEW IF EXISTS quiz_statistics CASCADE;
DROP VIEW IF EXISTS session_results CASCADE;
```

### 3단계: 새 테이블 설치
이제 새로운 테이블과 구조를 설치합니다. 

**방법 1: 분리된 SQL 파일 사용 (권장)**
1. **테이블 삭제**: `drop-tables.sql` 실행
2. **테이블 생성 및 초기 데이터**: `create-tables-with-data.sql` 실행

**방법 2: 기존 파일 사용**
1. **기본 테이블 생성**: `install-60-questions.sql` 실행
2. **실시간 기능 설정**: `supabase-realtime-setup.sql` 실행

### 4단계: 실시간 기능 활성화
SQL Editor에서 다음 명령어를 실행:

```sql
-- 실시간 기능을 위한 publication 생성
DROP PUBLICATION IF EXISTS quiz_realtime;
CREATE PUBLICATION quiz_realtime FOR TABLE 
    participants,
    survey_state,
    responses,
    activity_logs;

-- 테이블별 실시간 복제 설정
ALTER TABLE participants REPLICA IDENTITY FULL;
ALTER TABLE survey_state REPLICA IDENTITY FULL;
ALTER TABLE responses REPLICA IDENTITY FULL;
ALTER TABLE activity_logs REPLICA IDENTITY FULL;

-- RLS (Row Level Security) 활성화
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- 모든 사용자에게 읽기/쓰기 권한 부여
CREATE POLICY "Enable all access for all users" ON participants
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for all users" ON survey_state
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for all users" ON responses
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for all users" ON activity_logs
    FOR ALL USING (true) WITH CHECK (true);
```

### 5단계: 초기 상태 설정
퀴즈 시작을 위한 초기 상태를 설정합니다:

```sql
-- 초기 퀴즈 상태 설정
INSERT INTO survey_state (
    current_question,
    status,
    timer_end,
    current_session
) VALUES (
    0,
    'waiting',
    NULL,
    0
) ON CONFLICT DO NOTHING;
```

### 6단계: 실시간 구독 확인
Supabase 대시보드에서:
1. **Database** → **Replication** 메뉴로 이동
2. **Source** 탭에서 `quiz_realtime` publication이 활성화되어 있는지 확인
3. 각 테이블(participants, survey_state, responses, activity_logs)이 포함되어 있는지 확인

### 7단계: 환경 변수 확인
프로젝트의 `config.js` 파일에 Supabase 연결 정보가 올바르게 설정되어 있는지 확인:

```javascript
// config.js
window.SUPABASE_URL = 'your-project-url.supabase.co';
window.SUPABASE_ANON_KEY = 'your-anon-key';
```

## 문제 해결

### 권한 오류가 발생하는 경우
```sql
-- 모든 테이블에 대한 권한 부여
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon;
```

### 실시간 업데이트가 작동하지 않는 경우
1. Supabase 대시보드에서 **Settings** → **API**로 이동
2. **Realtime** 섹션에서 실시간 기능이 활성화되어 있는지 확인
3. 브라우저 개발자 도구에서 WebSocket 연결 확인

### 데이터 초기화만 하고 싶은 경우
테이블 구조는 유지하고 데이터만 삭제:

```sql
-- 모든 데이터 삭제 (테이블 구조는 유지)
TRUNCATE TABLE activity_logs CASCADE;
TRUNCATE TABLE responses CASCADE;
TRUNCATE TABLE survey_state CASCADE;
TRUNCATE TABLE participants CASCADE;

-- 초기 상태 다시 설정
INSERT INTO survey_state (
    current_question,
    status,
    timer_end,
    metadata
) VALUES (
    0,
    'waiting',
    NULL,
    '{"session": 0, "total_questions": 60}'::jsonb
);
```

## 주의사항
- 테이블 삭제 시 모든 데이터가 영구적으로 삭제됩니다
- 실시간 기능을 사용하려면 Supabase 프로젝트에서 Realtime이 활성화되어 있어야 합니다
- RLS 정책은 보안을 위해 프로덕션 환경에서는 더 엄격하게 설정하는 것을 권장합니다

## 테스트
설치 완료 후 다음을 테스트합니다:
1. 참여자 등록이 정상적으로 작동하는지 확인
2. 관리자 페이지에서 퀴즈 시작이 가능한지 확인
3. 실시간 업데이트가 모든 화면에서 동기화되는지 확인