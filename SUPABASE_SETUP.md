# Supabase 연동 설정 가이드

## 방법 1: 로컬 개발 (직접 수정)

1. `config.js` 파일을 열어서 직접 수정:
```javascript
const SUPABASE_CONFIG = {
    url: 'your-actual-supabase-url',  // 여기에 실제 URL 입력
    anonKey: 'your-actual-anon-key'   // 여기에 실제 KEY 입력
};
```

## 방법 2: Netlify 배포 (환경변수 사용)

### Netlify 대시보드에서 설정:
1. Netlify 대시보드 로그인
2. Site settings → Environment variables
3. 다음 변수 추가:
   - `SUPABASE_URL`: Supabase 프로젝트 URL
   - `SUPABASE_ANON_KEY`: Supabase anon key

### HTML 파일 수정:
각 HTML 파일 (`index.html`, `admin.html`, `result.html`)의 `<head>` 태그 안에 추가:

```html
<!-- config.js 로드 전에 추가 -->
<script>
  // Netlify 환경변수 (배포 시 자동 주입)
  window.SUPABASE_URL = '%SUPABASE_URL%';
  window.SUPABASE_ANON_KEY = '%SUPABASE_ANON_KEY%';
</script>
<script src="config.js"></script>
```

## 방법 3: 현재 설정 사용 (이미 작동 중)

현재 `config.js`에 이미 Supabase 연결 정보가 포함되어 있습니다:
- URL: `https://zwncncdgrfhihnuynssc.supabase.co`
- 이미 작동하는 anon key 포함

## Supabase 데이터베이스 설정

1. Supabase 대시보드에서 SQL Editor 열기
2. 다음 순서로 SQL 실행:
   - `drop-tables.sql` (기존 테이블 삭제)
   - `create-tables-with-data.sql` (새 테이블 생성)

## 연동 확인

브라우저 콘솔에서 확인:
- ✅ "Supabase 연결 성공" 메시지 확인
- ✅ 참여자 등록 시 데이터베이스에 저장되는지 확인
- ✅ 실시간 동기화 작동 확인

## 문제 해결

### "Supabase SDK가 로드되지 않았습니다" 오류
- 인터넷 연결 확인
- Supabase CDN 접근 가능한지 확인

### "Supabase 초기화 실패" 오류
- URL과 KEY가 올바른지 확인
- Supabase 프로젝트가 활성화되어 있는지 확인

### 실시간 동기화가 안 될 때
1. Supabase 대시보드 → Database → Replication
2. `quiz_realtime` publication 활성화 확인
3. 테이블들이 포함되어 있는지 확인