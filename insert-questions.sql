-- 퀴즈 데이터 삽입 SQL
-- Supabase SQL Editor에서 new-schema.sql 실행 후 이 파일을 실행하세요

-- 기존 질문 데이터 삭제 (필요시)
TRUNCATE TABLE questions CASCADE;

-- 세션 1: 아이스브레이킹
INSERT INTO questions (session_number, session_name, question_number, question_type, question_text, options, constraints, timer_seconds, chart_type) VALUES
(1, '아이스브레이킹', 1, 'text', '닉네임을 정해주세요!', NULL, '{"max_length": 10, "required": true}'::jsonb, 30, 'word_cloud'),
(1, '아이스브레이킹', 2, 'emoji', '오늘 기분은 어떠신가요?', '["😊", "😎", "🤔", "😴", "🤗", "😆"]'::jsonb, NULL, 7, 'pie'),
(1, '아이스브레이킹', 3, 'slider', '수련회 기대감은 몇 %인가요?', NULL, '{"min_value": 0, "max_value": 100, "step": 5}'::jsonb, 7, 'histogram'),
(1, '아이스브레이킹', 4, 'radio', '당신의 MBTI는?', '["INTJ/INTP/ENTJ/ENTP", "INFJ/INFP/ENFJ/ENFP", "ISTJ/ISFJ/ESTJ/ESFJ", "ISTP/ISFP/ESTP/ESFP"]'::jsonb, NULL, 10, 'donut'),
(1, '아이스브레이킹', 5, 'checkbox', '가장 기대되는 프로그램은? (최대 3개)', '["찬양과 경배", "말씀 시간", "레크레이션", "퀴즈 시간", "교제 시간", "식사 시간", "자유 시간"]'::jsonb, '{"max_select": 3, "min_select": 1}'::jsonb, 10, 'bar');

-- 세션 2: 연애 & 관계
INSERT INTO questions (session_number, session_name, question_number, question_type, question_text, options, constraints, timer_seconds, chart_type) VALUES
(2, '연애 & 관계', 6, 'radio', '이상형이 나타났을 때 나는?', '["먼저 다가간다", "신호를 보내며 기다린다", "아무것도 안한다"]'::jsonb, NULL, 7, 'pie'),
(2, '연애 & 관계', 7, 'text', '관심 있는 사람에게 보내는 나만의 시그널은?', NULL, '{"max_length": 50}'::jsonb, 20, 'word_cloud'),
(2, '연애 & 관계', 8, 'checkbox', '연애할 때 가장 중요하게 생각하는 것은? (최대 3개)', '["신앙의 일치", "성격 호환", "외모", "경제력", "유머 감각", "가치관", "소통 능력", "배려심"]'::jsonb, '{"max_select": 3, "min_select": 1}'::jsonb, 10, 'bar'),
(2, '연애 & 관계', 9, 'radio', '교회에 호감 가는 사람이 있나요?', '["있다", "없다", "비밀이다"]'::jsonb, NULL, 5, 'donut'),
(2, '연애 & 관계', 10, 'conditional', '그 사람이 지금 여기에 와있나요?', '["있다", "없다", "모르겠다"]'::jsonb, '{"condition": {"question_id": 9, "answer": "있다"}}'::jsonb, 5, 'pie'),
(2, '연애 & 관계', 11, 'radio', '이상적인 첫 데이트 장소는?', '["카페에서 대화", "영화관", "맛집 탐방", "공원 산책", "놀이공원"]'::jsonb, NULL, 7, 'bar'),
(2, '연애 & 관계', 12, 'slider', '결혼하고 싶은 나이는?', NULL, '{"min_value": 25, "max_value": 40, "step": 1}'::jsonb, 7, 'histogram'),
(2, '연애 & 관계', 13, 'radio', '나의 연애 스타일은?', '["집착형 - 매일 연락하고 싶어", "자유형 - 각자 시간도 중요해", "로맨틱형 - 특별한 이벤트를 좋아해", "현실형 - 실용적인 관계를 추구해"]'::jsonb, NULL, 7, 'donut');

-- 세션 3: 청년부 어워즈
INSERT INTO questions (session_number, session_name, question_number, question_type, question_text, options, constraints, timer_seconds, chart_type) VALUES
(3, '청년부 어워즈', 14, 'dropdown', '가장 듬직한 오빠는?', '"dynamic_male_participants"'::jsonb, '{"gender_filter": "male"}'::jsonb, 10, 'ranking'),
(3, '청년부 어워즈', 15, 'dropdown', '가장 듬직한 언니는?', '"dynamic_female_participants"'::jsonb, '{"gender_filter": "female"}'::jsonb, 10, 'ranking'),
(3, '청년부 어워즈', 16, 'radio', '최고의 패셔니스타는?', '"dynamic_all_participants"'::jsonb, NULL, 10, 'ranking'),
(3, '청년부 어워즈', 17, 'checkbox', '가장 잘 어울릴 것 같은 커플은? (2명 선택)', '"dynamic_all_participants"'::jsonb, '{"max_select": 2, "min_select": 2}'::jsonb, 15, 'heatmap'),
(3, '청년부 어워즈', 18, 'checkbox', '같이 사업하면 대박날 조합은? (2명 선택)', '"dynamic_all_participants"'::jsonb, '{"max_select": 2, "min_select": 2}'::jsonb, 15, 'heatmap'),
(3, '청년부 어워즈', 19, 'radio', '나의 고민을 들어줄 1순위는?', '"dynamic_all_participants"'::jsonb, NULL, 10, 'ranking'),
(3, '청년부 어워즈', 20, 'radio', '미래의 목사님이 될 것 같은 사람은?', '"dynamic_all_participants"'::jsonb, NULL, 10, 'ranking'),
(3, '청년부 어워즈', 21, 'radio', '제일 먼저 결혼할 것 같은 사람은?', '"dynamic_all_participants"'::jsonb, NULL, 10, 'ranking'),
(3, '청년부 어워즈', 22, 'radio', '오늘 수련회 MVP는?', '"dynamic_all_participants"'::jsonb, NULL, 10, 'ranking'),
(3, '청년부 어워즈', 23, 'text', 'MVP로 선정한 이유는?', NULL, '{"max_length": 100}'::jsonb, 20, 'word_cloud');

-- 세션 4: 신앙 & TMI
INSERT INTO questions (session_number, session_name, question_number, question_type, question_text, options, constraints, timer_seconds, chart_type) VALUES
(4, '신앙 & TMI', 24, 'radio', '성경 인물 중 한 사람을 만날 수 있다면?', '["다윗", "다니엘", "바울", "베드로", "에스더"]'::jsonb, NULL, 10, 'pie'),
(4, '신앙 & TMI', 25, 'slider', '나는 몇 % 죄인일까?', NULL, '{"min_value": 0, "max_value": 100, "step": 10}'::jsonb, 10, 'histogram'),
(4, '신앙 & TMI', 26, 'text', '아무도 모르는 나의 비밀 하나는?', NULL, '{"max_length": 100}'::jsonb, 20, 'word_cloud'),
(4, '신앙 & TMI', 27, 'radio', '하루만 초능력을 가진다면?', '["마음 읽기", "순간 이동", "투명 인간", "시간 정지"]'::jsonb, NULL, 7, 'donut'),
(4, '신앙 & TMI', 28, 'checkbox', '청년부와 꼭 해보고 싶은 활동은? (최대 5개)', '["해외 단기선교", "국내 선교여행", "캠핑", "체육대회", "성지순례", "봉사활동", "음악회/콘서트", "연합예배", "비전트립"]'::jsonb, '{"max_select": 5, "min_select": 1}'::jsonb, 15, 'bar'),
(4, '신앙 & TMI', 29, 'radio', '함께 가고 싶은 선교지는?', '["필리핀", "태국", "몽골", "캄보디아", "인도네시아"]'::jsonb, NULL, 10, 'pie'),
(4, '신앙 & TMI', 30, 'text', '청년부에 바라는 점 한 가지는?', NULL, '{"max_length": 100}'::jsonb, 20, 'word_cloud');