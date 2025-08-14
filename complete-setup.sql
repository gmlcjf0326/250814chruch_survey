-- 청년부 수련회 퀴즈 시스템 - 완전 설치 스크립트
-- Supabase SQL Editor에서 순서대로 실행하세요

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
-- STEP 3: 퀴즈 데이터 삽입
-- ========================================

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

-- ========================================
-- 완료 메시지
-- ========================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '청년부 수련회 퀴즈 시스템 설치 완료!';
    RAISE NOTICE '- 테이블 6개 생성';
    RAISE NOTICE '- 질문 30개 등록';
    RAISE NOTICE '- 실시간 구독 설정 완료';
    RAISE NOTICE '========================================';
END $$;