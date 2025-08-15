-- ===================================================
-- CREATE TABLES SQL - 테이블 생성 및 초기 데이터
-- ===================================================
-- 2025 청년부 수련회 퀴즈 시스템 데이터베이스

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

-- 2. 퀴즈 상태 테이블  
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

-- 3. 응답 테이블
CREATE TABLE responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    question_id INTEGER NOT NULL,
    question_text TEXT,
    question_type VARCHAR(20),
    selected_option TEXT,
    selected_options TEXT[],
    answer_text TEXT,
    voted_for VARCHAR(100),
    slider_value INTEGER,
    response_time_ms INTEGER,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_number INTEGER,
    CONSTRAINT unique_user_question UNIQUE (user_id, question_id)
);

-- 4. 활동 로그 테이블
CREATE TABLE activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    question_id INTEGER,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 인덱스 생성
CREATE INDEX idx_participants_user_id ON participants(user_id);
CREATE INDEX idx_participants_gender ON participants(gender);
CREATE INDEX idx_responses_user_id ON responses(user_id);
CREATE INDEX idx_responses_question_id ON responses(question_id);
CREATE INDEX idx_responses_submitted_at ON responses(submitted_at);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX idx_survey_state_status ON survey_state(status);

-- 6. 색상 할당 함수
CREATE OR REPLACE FUNCTION get_color_for_gender(p_gender VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    male_colors VARCHAR[] := ARRAY[
        '#4A90E2', '#5C9FDB', '#6EAEE4', '#7BBCED', '#8AC5F2',
        '#3E78C6', '#2F5FA8', '#22478A', '#1A3A70', '#0F2850'
    ];
    female_colors VARCHAR[] := ARRAY[
        '#FF6B9D', '#FF7FA7', '#FF93B1', '#FFA7BB', '#FFBBC5',
        '#FF5289', '#FF387D', '#E91E63', '#D81B60', '#C2185B'
    ];
    used_colors VARCHAR[];
    available_colors VARCHAR[];
    selected_color VARCHAR;
BEGIN
    -- 사용된 색상 조회
    SELECT ARRAY_AGG(color_hex) INTO used_colors
    FROM participants
    WHERE gender = p_gender AND is_active = true;
    
    -- 사용 가능한 색상 찾기
    IF p_gender = 'male' THEN
        available_colors := ARRAY(
            SELECT unnest(male_colors)
            EXCEPT
            SELECT unnest(used_colors)
        );
        IF array_length(available_colors, 1) IS NULL THEN
            available_colors := male_colors;
        END IF;
    ELSE
        available_colors := ARRAY(
            SELECT unnest(female_colors)
            EXCEPT
            SELECT unnest(used_colors)
        );
        IF array_length(available_colors, 1) IS NULL THEN
            available_colors := female_colors;
        END IF;
    END IF;
    
    -- 랜덤하게 색상 선택
    selected_color := available_colors[1 + floor(random() * array_length(available_colors, 1))];
    
    RETURN selected_color;
END;
$$ LANGUAGE plpgsql;

-- 7. 현재 퀴즈 상태 조회 함수
CREATE OR REPLACE FUNCTION get_current_quiz_state()
RETURNS TABLE (
    current_question INTEGER,
    status VARCHAR,
    total_participants BIGINT,
    current_responses BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.current_question,
        s.status,
        (SELECT COUNT(*) FROM participants WHERE is_active = true),
        (SELECT COUNT(*) FROM responses r WHERE r.question_id = s.current_question)
    FROM survey_state s
    ORDER BY s.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 8. 트리거 함수들
CREATE OR REPLACE FUNCTION notify_state_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('state_change', row_to_json(NEW)::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_response_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('response_change', row_to_json(NEW)::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_participant_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify('participant_change', row_to_json(NEW)::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. 트리거 생성
CREATE TRIGGER survey_state_notify
    AFTER INSERT OR UPDATE ON survey_state
    FOR EACH ROW EXECUTE FUNCTION notify_state_change();

CREATE TRIGGER response_notify
    AFTER INSERT ON responses
    FOR EACH ROW EXECUTE FUNCTION notify_response_change();

CREATE TRIGGER participant_notify
    AFTER INSERT OR UPDATE ON participants
    FOR EACH ROW EXECUTE FUNCTION notify_participant_change();

-- 10. RLS (Row Level Security) 활성화
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- 11. RLS 정책 생성 (모든 사용자 접근 허용)
CREATE POLICY "Enable all access for participants" ON participants
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for survey_state" ON survey_state
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for responses" ON responses
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for activity_logs" ON activity_logs
    FOR ALL USING (true) WITH CHECK (true);

-- 12. 실시간 기능을 위한 Publication 생성
CREATE PUBLICATION quiz_realtime FOR TABLE 
    participants,
    survey_state,
    responses,
    activity_logs;

-- 13. 테이블 복제 설정
ALTER TABLE participants REPLICA IDENTITY FULL;
ALTER TABLE survey_state REPLICA IDENTITY FULL;
ALTER TABLE responses REPLICA IDENTITY FULL;
ALTER TABLE activity_logs REPLICA IDENTITY FULL;

-- 14. 권한 부여
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- 15. 초기 데이터 삽입

-- 초기 퀴즈 상태 설정
INSERT INTO survey_state (
    current_question,
    status,
    timer_end,
    current_session
) VALUES (
    0,
    'waiting',
    NULL,
    0
) ON CONFLICT DO NOTHING;

-- 16. 테스트용 더미 참여자 데이터 (선택사항)
-- 실제 운영시에는 주석 처리하거나 삭제하세요
/*
INSERT INTO participants (user_id, nickname, gender, color_hex) VALUES
    ('test_user_1', '테스트1', 'male', '#4A90E2'),
    ('test_user_2', '테스트2', 'female', '#FF6B9D'),
    ('test_user_3', '테스트3', 'male', '#5C9FDB'),
    ('test_user_4', '테스트4', 'female', '#FF7FA7')
ON CONFLICT (user_id) DO NOTHING;
*/

-- 완료 메시지
SELECT 'All tables and initial data created successfully' AS status;