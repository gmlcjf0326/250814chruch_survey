-- 청년부 수련회 퀴즈 시스템 - 60문제 완전판
-- 이 파일을 complete-setup.sql 실행 후 또는 단독으로 실행하세요

-- 기존 질문 데이터 삭제
TRUNCATE TABLE questions CASCADE;

-- 60개 질문 삽입
INSERT INTO questions (session_number, session_name, question_number, question_type, question_text, options, constraints, timer_seconds, chart_type) VALUES

-- 🎯 오프닝 & 워밍업 (1-5)
(1, '오프닝 & 워밍업', 1, 'text', '닉네임을 정해주세요!', NULL, '{"required": true, "max_length": 20}'::jsonb, 60, 'word_cloud'),
(1, '오프닝 & 워밍업', 2, 'radio', '오늘 수련회 오길 잘했다?', '["완전 잘했다! 🔥", "잘한 것 같다", "보통이다", "아직까지 별로다", "집 가고 싶다 😅"]'::jsonb, NULL, 20, 'pie'),
(1, '오프닝 & 워밍업', 3, 'checkbox', '오늘 고기는 어땠나요? (복수선택)', '["완벽했다 👍", "맛있었다", "보통이었다", "태운 것도 있었다", "안 익은 것도 있었다", "못 먹었다 😢"]'::jsonb, '{"max_select": 3, "min_select": 1}'::jsonb, 20, 'bar'),
(1, '오프닝 & 워밍업', 4, 'radio', '오늘 날씨는 어떤가요?', '["최고의 날씨 ☀️", "좋은 편", "보통", "별로", "최악 ☔"]'::jsonb, NULL, 15, 'donut'),
(1, '오프닝 & 워밍업', 5, 'text', '수련회 첫인상을 한마디로?', NULL, '{"max_length": 30}'::jsonb, 30, 'word_cloud'),

-- 💭 신앙 관련 (6-12)
(2, '신앙 관련', 6, 'radio', '성경인물 중 한 사람을 만날 수 있다면?', '["다윗 - 찬양의 사람", "다니엘 - 기도의 사람", "바울 - 전도의 사람", "베드로 - 열정의 사람", "에스더 - 지혜의 사람"]'::jsonb, NULL, 30, 'pie'),
(2, '신앙 관련', 7, 'radio', '나는 죄인인가? (솔직하게)', '["100% 죄인입니다", "80% 정도?", "50% 반반", "30% 약간?", "나는 의인이다!"]'::jsonb, NULL, 20, 'donut'),
(2, '신앙 관련', 8, 'text', '만약 예수님과 카페에서 대화한다면 무엇을 물어보고 싶나요?', NULL, '{"max_length": 100}'::jsonb, 45, 'word_cloud'),
(2, '신앙 관련', 9, 'text', '가장 좋아하는 성경구절은?', NULL, '{"max_length": 100}'::jsonb, 40, 'word_cloud'),
(2, '신앙 관련', 10, 'radio', '신앙생활 기간은?', '["1년 미만", "1-3년", "3-5년", "5-10년", "10년 이상", "모태신앙"]'::jsonb, NULL, 20, 'bar'),
(2, '신앙 관련', 11, 'text', '가장 은혜받은 찬양 제목은?', NULL, '{"max_length": 50}'::jsonb, 30, 'word_cloud'),
(2, '신앙 관련', 12, 'text', '요즘 기도제목을 공유한다면?', NULL, '{"max_length": 100}'::jsonb, 45, 'word_cloud'),

-- 💕 연애 & 관계 (13-20)
(3, '연애 & 관계', 13, 'radio', '이상형이 나타났을 때', '["먼저 다가간다", "눈치 주며 기다린다", "친구부터 시작한다", "기도하고 기다린다", "모른 척한다"]'::jsonb, NULL, 20, 'pie'),
(3, '연애 & 관계', 14, 'radio', '교회에 호감가는 사람이 있다? (익명)', '["있다", "없다", "비밀이다", "잘 모르겠다"]'::jsonb, NULL, 15, 'donut'),
(3, '연애 & 관계', 15, 'conditional', '(위에서 있다고 답한 분만) 그 사람이 지금 여기에 와있다?', '["네, 와있어요", "아니요, 없어요", "비밀입니다", "해당없음"]'::jsonb, '{"condition": {"question_id": 14, "answer": "있다"}}'::jsonb, 15, 'pie'),
(3, '연애 & 관계', 16, 'text', '관심 있는 사람에게 보내는 나만의 시그널은?', NULL, '{"max_length": 50}'::jsonb, 30, 'word_cloud'),
(3, '연애 & 관계', 17, 'radio', '이상적인 첫 데이트는?', '["카페 대화", "영화 관람", "맛집 탐방", "공원 산책", "놀이공원", "교회 행사"]'::jsonb, NULL, 20, 'bar'),
(3, '연애 & 관계', 18, 'slider', '결혼하고 싶은 나이는?', NULL, '{"min_value": 25, "max_value": 40, "step": 1}'::jsonb, 20, 'histogram'),
(3, '연애 & 관계', 19, 'radio', '나의 연애 스타일은?', '["매일 연락하는 집착형", "각자 시간 중요한 자유형", "이벤트 좋아하는 로맨틱형", "실용적인 현실형"]'::jsonb, NULL, 25, 'donut'),
(3, '연애 & 관계', 20, 'radio', '이상형은 외모 vs 성격?', '["외모 100%", "외모 70% 성격 30%", "50:50", "성격 70% 외모 30%", "성격 100%"]'::jsonb, NULL, 15, 'bar'),

-- 🏆 청년부 어워즈 (21-30)
(4, '청년부 어워즈', 21, 'dropdown', '가장 듬직한 오빠상', '"dynamic_male_participants"'::jsonb, '{"gender_filter": "male"}'::jsonb, 30, 'ranking'),
(4, '청년부 어워즈', 22, 'dropdown', '가장 든든한 언니상', '"dynamic_female_participants"'::jsonb, '{"gender_filter": "female"}'::jsonb, 30, 'ranking'),
(4, '청년부 어워즈', 23, 'radio', '목사님이 될 것 같은 사람', '"dynamic_all_participants"'::jsonb, NULL, 30, 'ranking'),
(4, '청년부 어워즈', 24, 'radio', '제일 먼저 결혼할 것 같은 사람', '"dynamic_all_participants"'::jsonb, NULL, 30, 'ranking'),
(4, '청년부 어워즈', 25, 'radio', '10년 후에도 청년부에 있을 것 같은 사람 😄', '"dynamic_all_participants"'::jsonb, NULL, 30, 'ranking'),
(4, '청년부 어워즈', 26, 'radio', '만약 좀비 사태가 일어난다면 가장 먼저...? 😅', '"dynamic_all_participants"'::jsonb, NULL, 30, 'ranking'),
(4, '청년부 어워즈', 27, 'radio', '가장 재미있는 사람', '"dynamic_all_participants"'::jsonb, NULL, 25, 'ranking'),
(4, '청년부 어워즈', 28, 'radio', '패션 리더는?', '"dynamic_all_participants"'::jsonb, NULL, 25, 'ranking'),
(4, '청년부 어워즈', 29, 'radio', '요리 잘할 것 같은 사람', '"dynamic_all_participants"'::jsonb, NULL, 25, 'ranking'),
(4, '청년부 어워즈', 30, 'radio', '운동 잘할 것 같은 사람', '"dynamic_all_participants"'::jsonb, NULL, 25, 'ranking'),

-- 💑 커플 매칭 (31-35)
(5, '커플 매칭', 31, 'checkbox', '파워 커플이 될 것 같은 조합 (남녀 각 1명)', '"dynamic_all_participants"'::jsonb, '{"max_select": 2, "min_select": 2, "require_pair": true}'::jsonb, 45, 'heatmap'),
(5, '커플 매칭', 32, 'checkbox', '알콩달콩 커플이 될 조합 (남녀 각 1명)', '"dynamic_all_participants"'::jsonb, '{"max_select": 2, "min_select": 2, "require_pair": true}'::jsonb, 45, 'heatmap'),
(5, '커플 매칭', 33, 'radio', '위 커플이 만약 성사된다면?', '["적극 축복한다! 💕", "축복한다", "잘 모르겠다", "글쎄...", "반대한다"]'::jsonb, NULL, 20, 'pie'),
(5, '커플 매칭', 34, 'checkbox', '같이 사업하면 대박날 조합 (2명)', '"dynamic_all_participants"'::jsonb, '{"max_select": 2, "min_select": 2}'::jsonb, 35, 'heatmap'),
(5, '커플 매칭', 35, 'checkbox', '베프가 될 것 같은 조합 (2명)', '"dynamic_all_participants"'::jsonb, '{"max_select": 2, "min_select": 2}'::jsonb, 35, 'heatmap'),

-- 🎮 재미있는 질문 (36-42)
(6, '재미있는 질문', 36, 'radio', '하루만 초능력을 가진다면?', '["마음읽기", "순간이동", "투명인간", "시간정지", "미래예지"]'::jsonb, NULL, 25, 'pie'),
(6, '재미있는 질문', 37, 'text', '그 능력으로 청년부를 위해 하고 싶은 일은?', NULL, '{"max_length": 100}'::jsonb, 40, 'word_cloud'),
(6, '재미있는 질문', 38, 'radio', '하루만 바꿔서 살아보고 싶은 사람', '"dynamic_all_participants"'::jsonb, NULL, 30, 'ranking'),
(6, '재미있는 질문', 39, 'text', '위에서 선택한 이유는?', NULL, '{"max_length": 50}'::jsonb, 30, 'word_cloud'),
(6, '재미있는 질문', 40, 'checkbox', '무인도에 함께 갈 생존 파트너 (2명)', '"dynamic_all_participants"'::jsonb, '{"max_select": 2, "min_select": 2}'::jsonb, 35, 'bar'),
(6, '재미있는 질문', 41, 'text', '복권 1등 당첨되면 첫 번째로 할 일은?', NULL, '{"max_length": 50}'::jsonb, 30, 'word_cloud'),
(6, '재미있는 질문', 42, 'radio', '타임머신 타고 갈 시대는?', '["조선시대", "고려시대", "삼국시대", "일제강점기", "6.25 전쟁", "100년 후 미래"]'::jsonb, NULL, 25, 'donut'),

-- 🤫 TMI & 비밀 (43-47)
(7, 'TMI & 비밀', 43, 'text', '나는 사실 _______다', NULL, '{"max_length": 50}'::jsonb, 40, 'word_cloud'),
(7, 'TMI & 비밀', 44, 'text', '아무도 모르는 나의 비밀 하나는? (익명)', NULL, '{"max_length": 100}'::jsonb, 45, 'word_cloud'),
(7, 'TMI & 비밀', 45, 'text', '나의 특이한 습관은?', NULL, '{"max_length": 50}'::jsonb, 35, 'word_cloud'),
(7, 'TMI & 비밀', 46, 'text', '스트레스 해소법은?', NULL, '{"max_length": 50}'::jsonb, 35, 'word_cloud'),
(7, 'TMI & 비밀', 47, 'text', '최근 가장 웃긴 일은?', NULL, '{"max_length": 100}'::jsonb, 45, 'word_cloud'),

-- 🎨 청년부 RPG (48-52)
(8, '청년부 RPG', 48, 'radio', '신앙 레벨 만렙(99)일 것 같은 사람', '"dynamic_all_participants"'::jsonb, NULL, 25, 'ranking'),
(8, '청년부 RPG', 49, 'radio', '아직 레벨 1 새내기 같은 사람', '"dynamic_all_participants"'::jsonb, NULL, 25, 'ranking'),
(8, '청년부 RPG', 50, 'radio', '숨겨진 고수일 것 같은 사람', '"dynamic_all_participants"'::jsonb, NULL, 25, 'ranking'),
(8, '청년부 RPG', 51, 'radio', '힐러 역할이 어울리는 사람', '"dynamic_all_participants"'::jsonb, NULL, 25, 'ranking'),
(8, '청년부 RPG', 52, 'radio', '탱커 역할이 어울리는 사람', '"dynamic_all_participants"'::jsonb, NULL, 25, 'ranking'),

-- 💝 따뜻한 마음 (53-57)
(9, '따뜻한 마음', 53, 'checkbox', '오늘 고맙다고 말하고 싶은 사람 (최대 3명)', '"dynamic_all_participants"'::jsonb, '{"max_select": 3, "min_select": 1}'::jsonb, 30, 'bar'),
(9, '따뜻한 마음', 54, 'text', '위 사람(들)에게 전하고 싶은 말', NULL, '{"max_length": 100}'::jsonb, 45, 'word_cloud'),
(9, '따뜻한 마음', 55, 'checkbox', '나의 고민을 잘 들어줄 것 같은 사람 (2명)', '"dynamic_all_participants"'::jsonb, '{"max_select": 2, "min_select": 1}'::jsonb, 30, 'bar'),
(9, '따뜻한 마음', 56, 'radio', '닮고 싶은 사람 (롤모델)', '"dynamic_all_participants"'::jsonb, NULL, 30, 'ranking'),
(9, '따뜻한 마음', 57, 'text', '닮고 싶은 이유는?', NULL, '{"max_length": 100}'::jsonb, 40, 'word_cloud'),

-- 🌟 타임캡슐 & 미래 (58-60)
(10, '타임캡슐 & 미래', 58, 'text', '1년 후 나에게 하고 싶은 말 (타임캡슐)', NULL, '{"max_length": 200}'::jsonb, 60, 'word_cloud'),
(10, '타임캡슐 & 미래', 59, 'checkbox', '청년부와 꼭 해보고 싶은 활동 TOP 3', '["해외 단기선교", "국내 선교여행", "청년부 MT", "체육대회", "찬양집회", "성경통독", "기도회", "봉사활동", "청년부 카페", "유튜브 제작"]'::jsonb, '{"max_select": 3, "min_select": 1}'::jsonb, 40, 'bar'),
(10, '타임캡슐 & 미래', 60, 'radio', '함께 가고 싶은 선교지는?', '["동남아시아", "중앙아시아", "아프리카", "남미", "국내 소외지역"]'::jsonb, NULL, 20, 'pie');

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '60개 질문 등록 완료!';
    RAISE NOTICE '========================================';
END $$;