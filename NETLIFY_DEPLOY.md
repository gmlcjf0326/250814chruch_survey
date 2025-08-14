# Netlify 배포 문제 해결 가이드

## ❌ 발생한 문제
배포는 성공했지만 페이지가 제대로 표시되지 않음

## ✅ 해결 방법

### 1. netlify.toml 수정 완료
- 불필요한 리다이렉트 규칙 제거
- X-Frame-Options을 SAMEORIGIN으로 변경

### 2. 환경 변수 설정 (중요!)
Netlify는 정적 사이트이므로 빌드 시점에 환경 변수를 주입할 수 없습니다.

#### 방법 1: config.js에 직접 입력 (권장)
```javascript
// config.js 파일을 열어서 직접 수정
const SUPABASE_CONFIG = {
    url: 'your-supabase-url-here',
    anonKey: 'your-anon-key-here'
};
```

#### 방법 2: Netlify Functions 사용 (고급)
- 별도의 API 엔드포인트 구성 필요

### 3. GitHub 재배포
```bash
git add .
git commit -m "Fix Netlify deployment issues"
git push origin main
```

### 4. Netlify에서 확인
1. Netlify 대시보드에서 자동 재배포 확인
2. Deploy log에서 에러 없는지 확인
3. 사이트 접속 테스트

## 🔍 체크리스트

- [ ] netlify.toml 파일 수정됨
- [ ] 환경 변수 처리 코드 제거됨
- [ ] config.js에 Supabase 키 직접 입력
- [ ] GitHub에 푸시 완료
- [ ] Netlify 재배포 확인

## 📝 추가 팁

### LocalStorage 모드로만 사용하기
Supabase 없이 사용하려면 config.js에서:
```javascript
const SUPABASE_CONFIG = {
    url: '',  // 비워두기
    anonKey: ''  // 비워두기
};
```

### 디버깅
브라우저 콘솔(F12)에서 확인:
- 네트워크 탭: 파일이 제대로 로드되는지
- 콘솔 탭: JavaScript 에러 확인

## 🚨 보안 주의사항
- Supabase 키를 GitHub에 직접 올리면 누구나 볼 수 있습니다
- 프로덕션 환경에서는 Row Level Security 설정 필수
- 관리자 인증 시스템 추가 권장

## 🎯 현재 상태
- LocalStorage 모드: ✅ 작동
- Supabase 모드: config.js 수정 필요

## 📞 문의
문제가 지속되면 다음을 확인:
1. 브라우저 캐시 삭제 (Ctrl+F5)
2. 시크릿 모드에서 테스트
3. 다른 브라우저에서 테스트