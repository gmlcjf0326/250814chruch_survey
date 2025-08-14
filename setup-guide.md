# Supabase Realtime 설정 가이드

## 🔧 Supabase Dashboard에서 Realtime 활성화

### Step 1: Replication 설정
1. Supabase Dashboard 접속
2. 왼쪽 메뉴 → **Database**
3. 상단 탭 → **Replication**
4. **0 tables** 버튼 클릭 (Source 섹션)

### Step 2: 테이블 선택
다음 테이블들을 활성화:

| 테이블 | Insert | Update | Delete | 용도 |
|--------|--------|--------|--------|------|
| `survey_state` | ✅ | ✅ | ✅ | 설문 상태 동기화 |
| `responses` | ✅ | ❌ | ❌ | 새 응답 알림 |
| `participants` | ✅ | ✅ | ❌ | 참여자 수 업데이트 |
| `survey_events` | ✅ | ❌ | ❌ | 이벤트 로그 |

### Step 3: 활성화 확인
- 각 테이블 옆에 "Streaming" 표시 확인
- 실시간 아이콘이 초록색으로 변경됨

## 🚀 사용 방법

### 현재 모드 (Broadcast - DB 없이)
```javascript
// app-realtime.js 사용
// 메모리 기반, 브라우저 새로고침시 초기화
```

### DB 연동 모드 (영구 저장)
```html
<!-- HTML 파일에 추가 -->
<script src="app-database.js"></script>
```

## 📊 두 모드 비교

| 기능 | Broadcast 모드 | Database 모드 |
|------|---------------|---------------|
| 실시간 동기화 | ✅ | ✅ |
| 데이터 영구 저장 | ❌ | ✅ |
| 통계/분석 | 제한적 | ✅ |
| 설정 난이도 | 쉬움 | 보통 |
| 비용 | 무료 | 무료 (제한적) |

## 🎯 권장 사항

1. **테스트/데모**: Broadcast 모드 (현재 설정)
2. **실제 운영**: Database 모드
3. **대규모 행사**: Database + 백업

## 🔍 실시간 동작 확인

### Supabase Dashboard에서:
1. **Database** → **Table Editor**
2. `responses` 테이블 선택
3. 설문 참여시 실시간으로 행 추가 확인

### 브라우저 콘솔에서:
```javascript
// 실시간 연결 상태 확인
console.log(supabaseClient.getChannels());
```

## ⚠️ 주의사항

1. **Realtime 할당량**
   - 무료: 동시 접속 100명
   - 월 2GB 대역폭

2. **보안 설정**
   - RLS (Row Level Security) 활성화됨
   - 익명 사용자도 읽기/쓰기 가능 (설문 특성상)

3. **성능 최적화**
   - 필요한 이벤트만 구독
   - 불필요한 테이블은 비활성화

## 📝 문제 해결

### "Realtime not enabled" 오류
→ Replication에서 테이블 활성화 확인

### 데이터가 실시간으로 안 보임
→ 브라우저 새로고침 후 재시도

### 연결이 자주 끊김
→ 네트워크 상태 확인, Supabase 상태 페이지 확인