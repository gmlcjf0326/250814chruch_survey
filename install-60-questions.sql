-- ========================================
-- 청년부 수련회 퀴즈 시스템 60문제 완전 설치
-- 기존 테이블 삭제 후 새로 설치
-- Supabase SQL Editor에서 실행하세요
-- ========================================

-- ========================================
-- STEP 1: 기존 데이터 완전 삭제
-- ========================================

-- Publication 삭제
DROP PUBLICATION IF EXISTS supabase_realtime CASCADE;

-- 기존 테이블 삭제
DROP TABLE IF EXISTS survey_events CASCADE;
DROP TABLE IF EXISTS emoji_reactions CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS responses CASCADE;
DROP TABLE IF EXISTS survey_state CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS participants CASCADE;

-- 기존 함수 삭제
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS get_color_by_gender(VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS assign_color_on_insert() CASCADE;

-- 기존 뷰 삭제
DROP VIEW IF EXISTS response_stats CASCADE;

-- ========================================
-- STEP 2: 새로운 스키마 생성
-- ========================================

-- 1. 참여자 테이블
CREATE TABLE participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id VARCHAR(100) UNIQUE NOT NULL,
    nickname VARCHAR(50) UNIQUE NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
    color_hex VARCHAR(7) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 질문 테이블
CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    session_number INTEGER NOT NULL,
    session_name VARCHAR(50) NOT NULL,
    question_number INTEGER NOT NULL UNIQUE,
    question_type VARCHAR(30) NOT NULL,
    question_text TEXT NOT NULL,
    options JSONB,
    constraints JSONB,
    timer_seconds INTEGER DEFAULT 10,
    chart_type VARCHAR(20) DEFAULT 'bar',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 응답 테이블
CREATE TABLE responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL,
    answer_text TEXT,
    answer_options TEXT[],
    answer_number INTEGER,
    answer_emoji VARCHAR(10),
    response_time_ms INTEGER,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(question_id, user_id)
);

-- 4. 설문 상태 관리
CREATE TABLE survey_state (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting',
    current_session INTEGER DEFAULT 0,
    current_question INTEGER DEFAULT 0,
    timer_end TIMESTAMP WITH TIME ZONE,
    is_result_visible BOOLEAN DEFAULT false,
    session_results_hidden JSONB,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 참여자 활동 로그
CREATE TABLE activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    question_id INTEGER,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 이모지 리액션
CREATE TABLE emoji_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
    from_user_id VARCHAR(100) NOT NULL,
    to_user_id VARCHAR(100),
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_responses_question_user ON responses(question_id, user_id);
CREATE INDEX idx_responses_question ON responses(question_id);
CREATE INDEX idx_responses_user ON responses(user_id);
CREATE INDEX idx_participants_gender ON participants(gender);
CREATE INDEX idx_participants_nickname ON participants(nickname);
CREATE INDEX idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX idx_questions_number ON questions(question_number);

-- 업데이트 시간 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
CREATE TRIGGER update_questions_updated_at 
    BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_survey_state_updated_at 
    BEFORE UPDATE ON survey_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 색상 팔레트 함수
CREATE OR REPLACE FUNCTION get_color_by_gender(gender_param VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    male_colors VARCHAR[] := ARRAY[
        '#4A90E2', '#5C9FDB', '#6EAEE4', '#7FB8E8', '#91C3EC',
        '#667EEA', '#7B8FED', '#90A0F0', '#A5B1F3', '#BAC2F6',
        '#4F86C6', '#6495ED', '#7BA7E7', '#92B9F1', '#A9CBF5'
    ];
    female_colors VARCHAR[] := ARRAY[
        '#FF6B9D', '#FF7FA7', '#FF93B1', '#FFA7BB', '#FFBBC5',
        '#FEC0CE', '#FECDD6', '#FEDAD', '#FEE7E6', '#FFF4F3',
        '#E91E63', '#EC407A', '#F06292', '#F48FB1', '#F8BBD0'
    ];
    used_colors VARCHAR[];
    available_color VARCHAR;
BEGIN
    SELECT ARRAY_AGG(color_hex) INTO used_colors 
    FROM participants 
    WHERE gender = gender_param;
    
    IF gender_param = 'male' THEN
        FOR i IN 1..array_length(male_colors, 1) LOOP
            IF NOT (male_colors[i] = ANY(COALESCE(used_colors, ARRAY[]::VARCHAR[]))) THEN
                RETURN male_colors[i];
            END IF;
        END LOOP;
        RETURN male_colors[1 + floor(random() * array_length(male_colors, 1))::int];
    ELSE
        FOR i IN 1..array_length(female_colors, 1) LOOP
            IF NOT (female_colors[i] = ANY(COALESCE(used_colors, ARRAY[]::VARCHAR[]))) THEN
                RETURN female_colors[i];
            END IF;
        END LOOP;
        RETURN female_colors[1 + floor(random() * array_length(female_colors, 1))::int];
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 참여자 등록시 색상 자동 배정 트리거
CREATE OR REPLACE FUNCTION assign_color_on_insert()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.color_hex IS NULL OR NEW.color_hex = '' THEN
        NEW.color_hex := get_color_by_gender(NEW.gender);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assign_participant_color
    BEFORE INSERT ON participants
    FOR EACH ROW EXECUTE FUNCTION assign_color_on_insert();

-- Row Level Security (RLS) 활성화
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE emoji_reactions ENABLE ROW LEVEL SECURITY;

-- RLS 정책 설정
CREATE POLICY "Public read access" ON participants FOR SELECT USING (true);
CREATE POLICY "Public read questions" ON questions FOR SELECT USING (true);
CREATE POLICY "Public read responses" ON responses FOR SELECT USING (true);
CREATE POLICY "Public read survey_state" ON survey_state FOR SELECT USING (true);
CREATE POLICY "Public read activity_logs" ON activity_logs FOR SELECT USING (true);
CREATE POLICY "Public read reactions" ON emoji_reactions FOR SELECT USING (true);

CREATE POLICY "Public insert participants" ON participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update participants" ON participants FOR UPDATE USING (true);
CREATE POLICY "Public insert responses" ON responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert activity_logs" ON activity_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert reactions" ON emoji_reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update survey_state" ON survey_state FOR UPDATE USING (true);
CREATE POLICY "Public insert survey_state" ON survey_state FOR INSERT WITH CHECK (true);

-- 실시간 구독을 위한 Publication 생성
CREATE PUBLICATION supabase_realtime FOR TABLE 
    survey_state, 
    responses, 
    participants,
    activity_logs,
    emoji_reactions;

-- 권한 부여
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- 기본 설문 상태 삽입
INSERT INTO survey_state (status, current_question, current_session) 
VALUES ('waiting', 0, 0);

-- ========================================
-- STEP 3: 60개 질문 데이터 삽입
-- ========================================

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

-- ========================================
-- 완료 메시지
-- ========================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '청년부 수련회 퀴즈 시스템 60문제 설치 완료!';
    RAISE NOTICE '- 테이블 6개 생성';
    RAISE NOTICE '- 질문 60개 등록 (10개 세션)';
    RAISE NOTICE '- 실시간 구독 설정 완료';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '세션 구성:';
    RAISE NOTICE '1. 오프닝 & 워밍업 (5문제)';
    RAISE NOTICE '2. 신앙 관련 (7문제)';
    RAISE NOTICE '3. 연애 & 관계 (8문제)';
    RAISE NOTICE '4. 청년부 어워즈 (10문제)';
    RAISE NOTICE '5. 커플 매칭 (5문제)';
    RAISE NOTICE '6. 재미있는 질문 (7문제)';
    RAISE NOTICE '7. TMI & 비밀 (5문제)';
    RAISE NOTICE '8. 청년부 RPG (5문제)';
    RAISE NOTICE '9. 따뜻한 마음 (5문제)';
    RAISE NOTICE '10. 타임캡슐 & 미래 (3문제)';
    RAISE NOTICE '========================================';
END $$;