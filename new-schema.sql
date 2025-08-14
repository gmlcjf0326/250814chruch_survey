-- 청년부 수련회 퀴즈 시스템 - 개선된 데이터베이스 스키마
-- Supabase SQL Editor에서 실행하세요

-- 기존 테이블 삭제 (필요시)
-- DROP TABLE IF EXISTS activity_logs CASCADE;
-- DROP TABLE IF EXISTS responses CASCADE;
-- DROP TABLE IF EXISTS survey_state CASCADE;
-- DROP TABLE IF EXISTS questions CASCADE;
-- DROP TABLE IF EXISTS participants CASCADE;

-- 1. 참여자 테이블
CREATE TABLE IF NOT EXISTS participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id VARCHAR(100) UNIQUE NOT NULL,
    nickname VARCHAR(50) UNIQUE NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
    color_hex VARCHAR(7) NOT NULL, -- 성별에 따른 색상 자동 배정
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 질문 테이블 (세션 구조)
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    session_number INTEGER NOT NULL,
    session_name VARCHAR(50) NOT NULL,
    question_number INTEGER NOT NULL UNIQUE,
    question_type VARCHAR(30) NOT NULL, 
    -- 'radio', 'checkbox', 'text', 'slider', 'dropdown', 'emoji', 'conditional'
    question_text TEXT NOT NULL,
    options JSONB, -- 선택지 배열
    constraints JSONB, -- 제약조건
    -- 예시:
    -- {
    --   "max_select": 3,
    --   "gender_filter": "male", -- 특정 성별만 선택지에 표시
    --   "condition": {"question_id": 9, "answer": "예"},
    --   "min_value": 0,
    --   "max_value": 100,
    --   "required_gender": "male" -- 특정 성별만 답변 가능
    -- }
    timer_seconds INTEGER DEFAULT 10,
    chart_type VARCHAR(20) DEFAULT 'bar',
    -- 'bar', 'pie', 'donut', 'word_cloud', 'heatmap', 'ranking', 'histogram'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 응답 테이블
CREATE TABLE IF NOT EXISTS responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL,
    answer_text TEXT, -- 주관식 답변
    answer_options TEXT[], -- 체크박스 다중 선택
    answer_number INTEGER, -- 슬라이더 값
    answer_emoji VARCHAR(10), -- 이모지 선택
    response_time_ms INTEGER, -- 응답 시간 (밀리초)
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(question_id, user_id) -- 중복 답변 방지
);

-- 4. 설문 상태 관리
CREATE TABLE IF NOT EXISTS survey_state (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting', -- waiting, active, finished, paused
    current_session INTEGER DEFAULT 0,
    current_question INTEGER DEFAULT 0,
    timer_end TIMESTAMP WITH TIME ZONE,
    is_result_visible BOOLEAN DEFAULT false,
    session_results_hidden JSONB, -- 묶음 질문 결과 숨김 설정
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 참여자 활동 로그
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- 'joined', 'answered', 'viewed_result', 'reaction'
    question_id INTEGER,
    metadata JSONB, -- 추가 정보 저장
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 이모지 리액션 (선택적)
CREATE TABLE IF NOT EXISTS emoji_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
    from_user_id VARCHAR(100) NOT NULL,
    to_user_id VARCHAR(100),
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_responses_question_user ON responses(question_id, user_id);
CREATE INDEX IF NOT EXISTS idx_responses_question ON responses(question_id);
CREATE INDEX IF NOT EXISTS idx_responses_user ON responses(user_id);
CREATE INDEX IF NOT EXISTS idx_participants_gender ON participants(gender);
CREATE INDEX IF NOT EXISTS idx_participants_nickname ON participants(nickname);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_number ON questions(question_number);

-- 업데이트 시간 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
DROP TRIGGER IF EXISTS update_questions_updated_at ON questions;
CREATE TRIGGER update_questions_updated_at 
    BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_survey_state_updated_at ON survey_state;
CREATE TRIGGER update_survey_state_updated_at 
    BEFORE UPDATE ON survey_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) 활성화
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE emoji_reactions ENABLE ROW LEVEL SECURITY;

-- RLS 정책 설정
-- 모든 사용자가 읽기 가능
CREATE POLICY "Public read access" ON participants FOR SELECT USING (true);
CREATE POLICY "Public read questions" ON questions FOR SELECT USING (true);
CREATE POLICY "Public read responses" ON responses FOR SELECT USING (true);
CREATE POLICY "Public read survey_state" ON survey_state FOR SELECT USING (true);
CREATE POLICY "Public read activity_logs" ON activity_logs FOR SELECT USING (true);
CREATE POLICY "Public read reactions" ON emoji_reactions FOR SELECT USING (true);

-- 모든 사용자가 쓰기 가능 (익명 참여)
CREATE POLICY "Public insert participants" ON participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update participants" ON participants FOR UPDATE USING (true);
CREATE POLICY "Public insert responses" ON responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert activity_logs" ON activity_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert reactions" ON emoji_reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update survey_state" ON survey_state FOR UPDATE USING (true);
CREATE POLICY "Public insert survey_state" ON survey_state FOR INSERT WITH CHECK (true);

-- 실시간 구독을 위한 Publication 생성
DROP PUBLICATION IF EXISTS supabase_realtime CASCADE;
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
VALUES ('waiting', 0, 0)
ON CONFLICT DO NOTHING;

-- 색상 팔레트 함수 (성별에 따른 색상 자동 배정)
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
    -- 이미 사용된 색상 가져오기
    SELECT ARRAY_AGG(color_hex) INTO used_colors 
    FROM participants 
    WHERE gender = gender_param;
    
    -- 사용 가능한 색상 찾기
    IF gender_param = 'male' THEN
        FOR i IN 1..array_length(male_colors, 1) LOOP
            IF NOT (male_colors[i] = ANY(COALESCE(used_colors, ARRAY[]::VARCHAR[]))) THEN
                RETURN male_colors[i];
            END IF;
        END LOOP;
        -- 모든 색상이 사용된 경우 랜덤 반환
        RETURN male_colors[1 + floor(random() * array_length(male_colors, 1))::int];
    ELSE
        FOR i IN 1..array_length(female_colors, 1) LOOP
            IF NOT (female_colors[i] = ANY(COALESCE(used_colors, ARRAY[]::VARCHAR[]))) THEN
                RETURN female_colors[i];
            END IF;
        END LOOP;
        -- 모든 색상이 사용된 경우 랜덤 반환
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

DROP TRIGGER IF EXISTS assign_participant_color ON participants;
CREATE TRIGGER assign_participant_color
    BEFORE INSERT ON participants
    FOR EACH ROW EXECUTE FUNCTION assign_color_on_insert();