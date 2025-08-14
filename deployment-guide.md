# 청년부 설문조사 배포 가이드

## 🚀 배포 전 필수 설정

### 1. Supabase 설정 (실시간 동기화용)

1. [Supabase](https://supabase.com) 계정 생성
2. 새 프로젝트 생성
3. SQL Editor에서 다음 테이블 생성:

```sql
-- survey_state 테이블
CREATE TABLE survey_state (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    status TEXT,
    current_question INTEGER,
    start_time BIGINT,
    timer_end BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- responses 테이블
CREATE TABLE responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question_id INTEGER,
    user_id TEXT,
    answer TEXT,
    timestamp BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- participants 테이블
CREATE TABLE participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT UNIQUE,
    joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- questions 테이블
CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    question_type TEXT,
    question_text TEXT,
    options JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE survey_state;
ALTER PUBLICATION supabase_realtime ADD TABLE responses;
ALTER PUBLICATION supabase_realtime ADD TABLE participants;
ALTER PUBLICATION supabase_realtime ADD TABLE questions;
```

4. Settings > API에서 다음 값 복사:
   - Project URL
   - anon public key

### 2. 환경 변수 설정

#### Vercel 배포:
1. Vercel 프로젝트 설정에서 Environment Variables 추가:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

2. `vercel.json` 파일 생성:
   ```json
   {
     "build": {
       "env": {
         "VITE_SUPABASE_URL": "@vite_supabase_url",
         "VITE_SUPABASE_ANON_KEY": "@vite_supabase_anon_key"
       }
     }
   }
   ```

#### Netlify 배포:
1. Site settings > Environment variables에서 추가:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

2. `netlify.toml` 파일 생성:
   ```toml
   [build]
     publish = "."
   
   [build.environment]
     VITE_SUPABASE_URL = "your_supabase_url"
     VITE_SUPABASE_ANON_KEY = "your_anon_key"
   ```

### 3. 문제 편집 DB 동기화 구현

현재 문제 편집은 **LocalStorage에만 저장**됩니다. 
DB 동기화를 위해 `app.js`의 `saveQuestion` 함수를 수정해야 합니다:

```javascript
async function saveQuestion() {
    const questionId = parseInt(document.getElementById('question-select').value);
    const questionText = document.getElementById('question-text').value;
    const questionType = document.getElementById('question-type').value;
    
    const question = {
        id: questionId,
        type: questionType,
        question: questionText,
        options: []
    };
    
    if (questionType === 'multiple') {
        document.querySelectorAll('.option-input').forEach(input => {
            if (input.value.trim()) {
                question.options.push(input.value.trim());
            }
        });
    }
    
    // LocalStorage 저장
    APP_STATE.questions[questionId - 1] = question;
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(APP_STATE.questions));
    
    // Supabase DB 저장 (추가 필요)
    if (APP_STATE.useSupabase && supabase) {
        try {
            const { data, error } = await supabase
                .from('questions')
                .upsert({
                    id: questionId,
                    question_type: questionType,
                    question_text: questionText,
                    options: question.options
                });
            
            if (error) throw error;
            
            // 실시간 브로드캐스트
            if (APP_STATE.channel) {
                APP_STATE.channel.send({
                    type: 'broadcast',
                    event: 'question_updated',
                    payload: { questionId, question }
                });
            }
        } catch (error) {
            console.error('DB 저장 실패:', error);
        }
    }
    
    displayQuestionList();
    alert('문제가 저장되었습니다!');
}
```

## 📋 배포 체크리스트

- [ ] Supabase 프로젝트 생성 완료
- [ ] 데이터베이스 테이블 생성 완료
- [ ] 환경 변수 설정 완료
- [ ] Vercel/Netlify 계정 준비
- [ ] Git 저장소에 코드 업로드
- [ ] 배포 플랫폼과 Git 연동
- [ ] 환경 변수 설정
- [ ] 배포 테스트

## 🔧 현재 상태

### ✅ 완료된 기능:
- 기본 설문 기능
- LocalStorage 동기화
- 실시간 타이머
- 관리자 패널
- 결과 통계
- 데이터 초기화/백업
- 누적 통계 대시보드

### ⚠️ 추가 구현 필요:
1. **Supabase 실시간 동기화 완성**
   - 현재 브로드캐스트 설정은 있으나 DB 연동 미완성
   
2. **문제 편집 DB 저장**
   - 현재 LocalStorage만 사용
   - Supabase DB 저장 로직 추가 필요

3. **응답 데이터 DB 저장**
   - 현재 LocalStorage만 사용
   - Supabase DB 저장 로직 추가 필요

## 💡 권장사항

1. **테스트 환경 먼저 구축**
   - Supabase 무료 플랜으로 시작
   - Vercel/Netlify 무료 플랜 사용

2. **단계적 배포**
   - 1단계: LocalStorage 버전 배포 (현재 가능)
   - 2단계: Supabase 연동 테스트
   - 3단계: 실시간 동기화 활성화

3. **보안 고려사항**
   - 환경 변수는 절대 코드에 직접 입력하지 말 것
   - Row Level Security 정책 설정 권장
   - 관리자 인증 시스템 추가 고려

## 📞 문의사항

배포 중 문제가 발생하면:
1. 브라우저 콘솔 에러 확인
2. Supabase 대시보드 로그 확인
3. 배포 플랫폼 빌드 로그 확인