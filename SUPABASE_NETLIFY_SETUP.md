# Supabase + Netlify 설정 가이드

## 1. Netlify 환경변수 설정 ✅
Netlify 대시보드에서 이미 설정하신 환경변수:
- `VITE_SUPABASE_URL`: 실제 Supabase 프로젝트 URL
- `VITE_SUPABASE_ANON_KEY`: 실제 anon key

## 2. Supabase 데이터베이스 테이블 생성 (필수!)

### 새 프로젝트라면 테이블을 생성해야 합니다:

1. **Supabase 대시보드 접속**
   - [https://app.supabase.com](https://app.supabase.com) 로그인
   - 해당 프로젝트 선택

2. **SQL Editor에서 테이블 생성**
   - 왼쪽 메뉴에서 "SQL Editor" 클릭
   - 다음 순서로 SQL 파일 실행:

   a) **기존 테이블 삭제** (선택사항 - 처음이면 생략 가능)
   ```sql
   -- drop-tables.sql 내용 복사하여 실행
   ```

   b) **새 테이블 생성** (필수!)
   ```sql
   -- create-tables-with-data.sql 내용 복사하여 실행
   ```

3. **실시간 기능 활성화 확인**
   - Database → Replication 메뉴
   - Publications 탭에서 `quiz_realtime` 확인
   - 4개 테이블이 모두 포함되어 있는지 확인:
     - participants
     - survey_state
     - responses
     - activity_logs

## 3. 배포 및 테스트

### Netlify 배포:
```bash
git add .
git commit -m "Supabase 연동 설정"
git push
```

### 테스트:
1. 배포된 사이트 접속
2. 브라우저 개발자 도구 (F12) → Console
3. 다음 메시지 확인:
   - "✅ Netlify 환경변수 로드 성공"
   - "✅ Supabase 연결 성공"

## 4. 로컬 개발 시

로컬에서 테스트하려면 `config.js`의 DEFAULT_CONFIG를 수정:

```javascript
const DEFAULT_CONFIG = {
    url: '실제-supabase-url',  // Netlify 환경변수와 동일한 값
    anonKey: '실제-anon-key'   // Netlify 환경변수와 동일한 값
};
```

## 5. 필요한 테이블 구조

생성되는 4개 테이블:

1. **participants** - 참여자 정보
   - 닉네임, 성별, 색상 등

2. **survey_state** - 퀴즈 진행 상태
   - 현재 문제 번호, 상태 등

3. **responses** - 답변 데이터
   - 각 참여자의 답변 저장

4. **activity_logs** - 활동 로그
   - 참여자 활동 기록

## 문제 해결

### "테이블이 없습니다" 오류
→ SQL Editor에서 `create-tables-with-data.sql` 실행

### "권한이 없습니다" 오류
→ Supabase 대시보드 → Authentication → Policies 확인

### 실시간 동기화 안 됨
→ Database → Replication → Publications 확인

## 확인 사항
- [ ] Netlify 환경변수 설정 완료
- [ ] Supabase 테이블 생성 완료
- [ ] 실시간 기능 활성화 완료
- [ ] 배포 후 콘솔 메시지 확인