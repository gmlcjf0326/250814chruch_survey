# 청년부 설문조사 시스템

실시간 동기화가 가능한 청년부 설문조사 웹 애플리케이션입니다.

## 🚀 주요 기능

- 📊 **실시간 설문조사**: 관리자가 문제를 진행하면 모든 참여자 화면이 동기화
- ⏱️ **타이머 기능**: 각 문제당 20초 제한 시간
- 📈 **실시간 통계**: 응답 결과를 즉시 확인 가능
- 💾 **데이터 백업**: 설문 데이터 자동 백업 및 복구
- 📱 **반응형 디자인**: 모바일, 태블릿, PC 모두 지원
- 🎨 **모던 UI**: 그라데이션과 애니메이션이 적용된 아름다운 디자인

## 📁 파일 구조

```
├── index.html        # 사용자 참여 화면
├── admin.html        # 관리자 패널
├── result.html       # 실시간 결과 대시보드
├── app.js           # 핵심 로직
├── config.js        # Supabase 설정
├── styles.css       # 스타일시트
├── netlify.toml     # Netlify 배포 설정
└── .env.example     # 환경 변수 예제
```

## 🛠️ 설치 및 실행

### 1. 저장소 클론
```bash
git clone https://github.com/yourusername/youth-survey.git
cd youth-survey
```

### 2. 환경 변수 설정
```bash
cp .env.example .env
# .env 파일을 열어 Supabase 키 입력
```

### 3. 로컬 서버 실행
```bash
# Python 사용
python3 -m http.server 8000

# 또는 Node.js 사용
npx serve .
```

### 4. 브라우저에서 접속
- 사용자: http://localhost:8000/index.html
- 관리자: http://localhost:8000/admin.html
- 결과: http://localhost:8000/result.html

## 🌐 Netlify 배포

### 1. GitHub에 푸시
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Netlify 설정
1. [Netlify](https://www.netlify.com) 로그인
2. "Import from Git" 클릭
3. GitHub 저장소 선택
4. 환경 변수 설정:
   - `VITE_SUPABASE_URL`: Supabase 프로젝트 URL
   - `VITE_SUPABASE_ANON_KEY`: Supabase anon key
5. Deploy 클릭

## 🔧 Supabase 설정

1. [Supabase](https://supabase.com) 계정 생성
2. 새 프로젝트 생성
3. SQL Editor에서 `supabase-schema.sql` 실행
4. Settings > API에서 URL과 anon key 복사
5. 환경 변수에 설정

## 📱 웹앱 특징

- **PWA 지원**: 홈 화면에 추가 가능
- **오프라인 모드**: LocalStorage 활용
- **풀스크린**: 웹앱 모드에서 전체화면 지원
- **제스처**: 스와이프 및 터치 인터랙션

## 🎯 사용 방법

### 관리자
1. `admin.html` 접속
2. 문제 편집 (필요시)
3. "설문 시작" 클릭
4. 20초 후 "다음 문제" 클릭
5. 모든 문제 완료 후 "설문 종료"
6. 필요시 "데이터 초기화"

### 참여자
1. `index.html` 접속
2. 문제가 나타나면 답변 선택
3. "제출하기" 클릭
4. 다음 문제 대기

### 결과 확인
1. `result.html` 접속
2. 실시간 통계 확인
3. 누적 통계 분석
4. CSV/JSON 내보내기 가능

## 🔒 보안

- 환경 변수를 통한 API 키 관리
- Row Level Security 적용 가능
- HTTPS 자동 적용 (Netlify)

## 📄 라이선스

MIT License

## 👥 기여

Issues와 Pull Requests 환영합니다!

## 📞 문의

문제가 있으시면 Issue를 등록해주세요.# 250814chruch_survey
