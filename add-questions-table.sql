-- ===================================================
-- QUESTIONS 테이블 추가 SQL
-- ===================================================
-- quiz-data-60.json 데이터를 데이터베이스에 저장

-- 1. questions 테이블 생성
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    question_number INTEGER NOT NULL UNIQUE,
    session_number INTEGER NOT NULL,
    session_name VARCHAR(100),
    question_type VARCHAR(20) NOT NULL,
    question_text TEXT NOT NULL,
    options JSONB,
    constraints JSONB,
    timer_seconds INTEGER DEFAULT 30,
    chart_type VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 인덱스 생성
CREATE INDEX idx_questions_number ON questions(question_number);
CREATE INDEX idx_questions_session ON questions(session_number);
CREATE INDEX idx_questions_type ON questions(question_type);

-- 3. RLS 활성화
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- 4. RLS 정책 생성 (모든 사용자 읽기 허용)
CREATE POLICY "Enable read access for all users" ON questions
    FOR SELECT USING (true);

-- 5. 60문제 데이터 삽입
INSERT INTO questions (question_number, session_number, session_name, question_type, question_text, options, constraints, timer_seconds, chart_type) VALUES
-- 세션 1: 오프닝 & 워밍업
(1, 1, '오프닝 & 워밍업', 'text', '닉네임을 정해주세요!', NULL, '{"required": true, "max_length": 20}', 60, 'word_cloud'),
(2, 1, '오프닝 & 워밍업', 'radio', '오늘 수련회 오길 잘했다?', '["완전 잘했다! 🔥", "잘한 것 같다", "보통이다", "아직까지 별로다", "집 가고 싶다 😅"]', NULL, 20, 'pie'),
(3, 1, '오프닝 & 워밍업', 'checkbox', '오늘 고기는 어땠나요? (복수선택)', '["완벽했다 👍", "맛있었다", "보통이었다", "태운 것도 있었다", "안 익은 것도 있었다", "못 먹었다 😢"]', '{"max_select": 3, "min_select": 1}', 20, 'bar'),
(4, 1, '오프닝 & 워밍업', 'radio', '오늘 날씨는 어떤가요?', '["최고의 날씨 ☀️", "좋은 편", "보통", "별로", "최악 ☔"]', NULL, 15, 'donut'),
(5, 1, '오프닝 & 워밍업', 'slider', '지금 기분은 몇 점?', NULL, '{"min": 0, "max": 100, "step": 10}', 20, 'gauge'),
(6, 1, '오프닝 & 워밍업', 'emoji', '지금 기분을 이모지로 표현한다면?', '["😄", "😊", "😐", "😔", "😴", "🤯"]', NULL, 15, 'emoji_cloud'),

-- 세션 2: 청년부 & 교회 생활
(7, 2, '청년부 & 교회 생활', 'radio', '청년부에 온 지 얼마나 되셨나요?', '["6개월 미만", "6개월-1년", "1-2년", "2-3년", "3년 이상"]', NULL, 20, 'bar'),
(8, 2, '청년부 & 교회 생활', 'checkbox', '청년부 활동 중 가장 좋은 것은? (복수선택)', '["주일예배", "금요모임", "소그룹", "친교시간", "봉사활동", "수련회"]', '{"max_select": 3}', 25, 'horizontal_bar'),
(9, 2, '청년부 & 교회 생활', 'participant_select', '청년부에서 가장 재밌는 사람은?', NULL, NULL, 30, 'avatar_grid'),
(10, 2, '청년부 & 교회 생활', 'text', '우리 청년부를 한 단어로 표현한다면?', NULL, '{"max_length": 20}', 30, 'word_cloud'),
(11, 2, '청년부 & 교회 생활', 'radio', '올해 청년부 목표 달성 가능성은?', '["100% 가능!", "80% 정도?", "50:50", "30% 정도", "기도가 필요해요"]', NULL, 20, 'pie'),
(12, 2, '청년부 & 교회 생활', 'participant_select', '차기 청년부 회장감은?', NULL, NULL, 30, 'ranking'),

-- 세션 3: 성경 & 신앙 퀴즈
(13, 3, '성경 & 신앙 퀴즈', 'radio', '예수님의 12제자가 아닌 사람은?', '["베드로", "안드레", "바울", "야고보", "요한"]', NULL, 30, 'pie'),
(14, 3, '성경 & 신앙 퀴즈', 'radio', '노아의 방주에 탄 가족은 총 몇 명?', '["4명", "6명", "8명", "10명", "12명"]', NULL, 25, 'bar'),
(15, 3, '성경 & 신앙 퀴즈', 'radio', '다윗이 골리앗을 쓰러뜨린 무기는?', '["칼", "창", "활", "물맷돌", "지팡이"]', NULL, 20, 'donut'),
(16, 3, '성경 & 신앙 퀴즈', 'text', '가장 좋아하는 성경 구절은?', NULL, '{"max_length": 100}', 45, 'text_list'),
(17, 3, '성경 & 신앙 퀴즈', 'radio', '예수님이 첫 기적을 행하신 곳은?', '["예루살렘", "베들레헴", "가나", "갈릴리", "나사렛"]', NULL, 25, 'pie'),
(18, 3, '성경 & 신앙 퀴즈', 'checkbox', '성경 66권 중 아는 것 모두 선택', '["창세기", "출애굽기", "레위기", "요한복음", "로마서", "요한계시록"]', '{"min_select": 1}', 30, 'stacked_bar'),

-- 세션 4: 연애 & 결혼관
(19, 4, '연애 & 결혼관', 'radio', '현재 연애 상태는?', '["연애중 💕", "썸타는중 💭", "짝사랑중 💔", "솔로 😎", "복잡해요 🤯"]', NULL, 20, 'pie'),
(20, 4, '연애 & 결혼관', 'slider', '결혼하고 싶은 나이는?', NULL, '{"min": 25, "max": 40, "step": 1}', 25, 'histogram'),
(21, 4, '연애 & 결혼관', 'participant_select', '우리 청년부 최고의 커플감은?', NULL, NULL, 30, 'couple_match'),
(22, 4, '연애 & 결혼관', 'checkbox', '이상형의 조건은? (최대 3개)', '["신앙심", "외모", "성격", "경제력", "유머감각", "가치관"]', '{"max_select": 3, "min_select": 1}', 30, 'radar'),
(23, 4, '연애 & 결혼관', 'radio', '청년부 내 연애 어떻게 생각해?', '["적극 찬성", "찬성", "중립", "반대", "절대 반대"]', NULL, 20, 'donut'),
(24, 4, '연애 & 결혼관', 'text', '연애할 때 가장 중요한 것은?', NULL, '{"max_length": 30}', 30, 'word_cloud'),

-- 세션 5: 취미 & 라이프스타일
(25, 5, '취미 & 라이프스타일', 'checkbox', '즐기는 취미는? (복수선택)', '["운동", "독서", "영화/드라마", "게임", "음악", "요리", "여행"]', '{"max_select": 4}', 25, 'bubble'),
(26, 5, '취미 & 라이프스타일', 'radio', 'MBTI는?', '["E (외향)", "I (내향)", "모르겠어요", "안 믿어요", "매번 바뀌어요"]', NULL, 15, 'pie'),
(27, 5, '취미 & 라이프스타일', 'slider', '일주일 운동 횟수는?', NULL, '{"min": 0, "max": 7, "step": 1}', 20, 'bar'),
(28, 5, '취미 & 라이프스타일', 'radio', '휴일에 주로 뭐해?', '["집에서 휴식", "친구 만나기", "가족과 시간", "취미활동", "자기계발"]', NULL, 20, 'donut'),
(29, 5, '취미 & 라이프스타일', 'emoji', '월요일 아침 기분', '["😭", "😔", "😐", "😊", "😄", "🤬"]', NULL, 15, 'emoji_bar'),
(30, 5, '취미 & 라이프스타일', 'participant_select', '운동 같이 하고 싶은 사람?', NULL, NULL, 25, 'avatar_list'),

-- 세션 6: 직장 & 진로
(31, 6, '직장 & 진로', 'radio', '현재 직업 만족도는?', '["매우 만족", "만족", "보통", "불만족", "이직 준비중"]', NULL, 20, 'gauge'),
(32, 6, '직장 & 진로', 'text', '10년 후 나의 모습은?', NULL, '{"max_length": 50}', 40, 'text_cloud'),
(33, 6, '직장 & 진로', 'slider', '일과 삶의 균형 점수는?', NULL, '{"min": 0, "max": 100, "step": 10}', 20, 'progress'),
(34, 6, '직장 & 진로', 'checkbox', '직장에서 중요한 것은? (최대 3개)', '["연봉", "워라밸", "성장가능성", "동료관계", "복지", "안정성"]', '{"max_select": 3}', 30, 'radar'),
(35, 6, '직장 & 진로', 'participant_select', '함께 창업하고 싶은 사람?', NULL, NULL, 30, 'network'),
(36, 6, '직장 & 진로', 'radio', '로또 당첨되면 일 계속할까?', '["당연히 계속", "고민해볼게", "바로 퇴사", "창업할래", "선교사 갈래"]', NULL, 20, 'pie'),

-- 세션 7: 재밌는 질문들
(37, 7, '재밌는 질문들', 'radio', '민초 vs 반민초?', '["민초파 💚", "반민초파 ❌", "둘다 좋아", "둘다 싫어", "뭔지 몰라"]', NULL, 15, 'versus'),
(38, 7, '재밌는 질문들', 'participant_select', '무인도에 함께 가고 싶은 사람?', NULL, NULL, 30, 'island'),
(39, 7, '재밌는 질문들', 'radio', '부먹 vs 찍먹?', '["부먹파", "찍먹파", "안 먹어", "상관없어", "뿌먹파"]', NULL, 15, 'versus'),
(40, 7, '재밌는 질문들', 'checkbox', '나의 매력포인트는? (최대 3개)', '["외모", "성격", "유머", "성실함", "따뜻함", "능력"]', '{"max_select": 3}', 25, 'bubble'),
(41, 7, '재밌는 질문들', 'emoji', '오늘 수련회 만족도', '["😍", "😊", "😐", "😕", "😫", "💀"]', NULL, 20, 'emoji_scale'),
(42, 7, '재밌는 질문들', 'participant_select', '우리 청년부 분위기 메이커는?', NULL, NULL, 25, 'spotlight'),

-- 세션 8: 소원 & 기도제목
(43, 8, '소원 & 기도제목', 'text', '올해 꼭 이루고 싶은 소원은?', NULL, '{"max_length": 100}', 45, 'wish_wall'),
(44, 8, '소원 & 기도제목', 'checkbox', '기도제목은? (복수선택)', '["건강", "직장/학업", "연애/결혼", "가족", "신앙성장", "경제"]', NULL, 30, 'prayer_tree'),
(45, 8, '소원 & 기도제목', 'participant_select', '기도해주고 싶은 사람?', NULL, NULL, 30, 'prayer_circle'),
(46, 8, '소원 & 기도제목', 'slider', '올해 신앙 성장 목표', NULL, '{"min": 0, "max": 100, "step": 10}', 25, 'growth_chart'),
(47, 8, '소원 & 기도제목', 'radio', '가장 도움이 필요한 영역은?', '["신앙", "관계", "진로", "건강", "경제"]', NULL, 20, 'help_map'),
(48, 8, '소원 & 기도제목', 'text', '청년부에 바라는 점은?', NULL, '{"max_length": 100}', 40, 'feedback_board'),

-- 세션 9: 청년부 어워즈
(49, 9, '청년부 어워즈', 'participant_select', '올해의 청년부 MVP는?', NULL, NULL, 30, 'trophy'),
(50, 9, '청년부 어워즈', 'participant_select', '가장 성장한 사람은?', NULL, NULL, 30, 'growth_award'),
(51, 9, '청년부 어워즈', 'participant_select', '숨은 일꾼상은?', NULL, NULL, 30, 'hidden_hero'),
(52, 9, '청년부 어워즈', 'participant_select', '최고의 유머상은?', NULL, NULL, 25, 'comedy_king'),
(53, 9, '청년부 어워즈', 'participant_select', '패션왕은?', NULL, NULL, 25, 'fashion_icon'),
(54, 9, '청년부 어워즈', 'participant_select', '요리왕은?', NULL, NULL, 25, 'chef_hat'),

-- 세션 10: 마무리 & 다짐
(55, 10, '마무리 & 다짐', 'text', '오늘 수련회 한 줄 평', NULL, '{"max_length": 100}', 40, 'review_wall'),
(56, 10, '마무리 & 다짐', 'radio', '내년 수련회도 올 거야?', '["무조건!", "아마도", "고민중", "글쎄", "다음에"]', NULL, 20, 'commitment'),
(57, 10, '마무리 & 다짐', 'emoji', '지금 이 순간의 기분', '["🥰", "😊", "😌", "😴", "🤗", "🎉"]', NULL, 15, 'mood_final'),
(58, 10, '마무리 & 다짐', 'participant_select', '오늘 가장 고마운 사람', NULL, NULL, 30, 'thanks_giving'),
(59, 10, '마무리 & 다짐', 'checkbox', '앞으로 청년부에서 하고싶은 것', '["예배 인도", "찬양팀", "미디어팀", "친교팀", "전도", "양육"]', NULL, 30, 'future_vision'),
(60, 10, '마무리 & 다짐', 'text', '모두에게 전하고 싶은 말', NULL, '{"max_length": 200}', 60, 'message_board')
ON CONFLICT (question_number) DO NOTHING;

-- 6. 권한 부여
GRANT ALL ON questions TO anon;
GRANT ALL ON questions_id_seq TO anon;

-- 완료 메시지
SELECT 'Questions table created and populated successfully' AS status;