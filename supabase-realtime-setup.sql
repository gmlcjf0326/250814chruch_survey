-- ========================================
-- Supabase 실시간 기능 설정 SQL
-- 60문제 시스템 + 실시간 동기화
-- ========================================

-- ========================================
-- STEP 1: 기존 테이블 및 설정 삭제
-- ========================================

-- Realtime 구독 삭제
DROP PUBLICATION IF EXISTS supabase_realtime CASCADE;

-- 기존 트리거 삭제
DROP TRIGGER IF EXISTS on_survey_state_change ON survey_state;
DROP TRIGGER IF EXISTS on_response_insert ON responses;
DROP TRIGGER IF EXISTS on_participant_insert ON participants;
DROP TRIGGER IF EXISTS on_participant_update ON participants;

-- 기존 함수 삭제
DROP FUNCTION IF EXISTS notify_survey_state_change() CASCADE;
DROP FUNCTION IF EXISTS notify_response_change() CASCADE;
DROP FUNCTION IF EXISTS notify_participant_change() CASCADE;

-- ========================================
-- STEP 2: 실시간 알림 함수 생성
-- ========================================

-- 설문 상태 변경 알림 함수
CREATE OR REPLACE FUNCTION notify_survey_state_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'survey_state_changes',
        json_build_object(
            'action', TG_OP,
            'data', row_to_json(NEW),
            'timestamp', NOW()
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 응답 변경 알림 함수
CREATE OR REPLACE FUNCTION notify_response_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'response_changes',
        json_build_object(
            'action', TG_OP,
            'question_id', NEW.question_id,
            'user_id', NEW.user_id,
            'timestamp', NOW()
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 참여자 변경 알림 함수
CREATE OR REPLACE FUNCTION notify_participant_change()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'participant_changes',
        json_build_object(
            'action', TG_OP,
            'data', row_to_json(NEW),
            'timestamp', NOW()
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- STEP 3: 실시간 트리거 생성
-- ========================================

-- 설문 상태 변경 트리거
CREATE TRIGGER on_survey_state_change
AFTER INSERT OR UPDATE OR DELETE ON survey_state
FOR EACH ROW EXECUTE FUNCTION notify_survey_state_change();

-- 응답 추가 트리거
CREATE TRIGGER on_response_insert
AFTER INSERT ON responses
FOR EACH ROW EXECUTE FUNCTION notify_response_change();

-- 참여자 추가/수정 트리거
CREATE TRIGGER on_participant_insert
AFTER INSERT ON participants
FOR EACH ROW EXECUTE FUNCTION notify_participant_change();

CREATE TRIGGER on_participant_update
AFTER UPDATE ON participants
FOR EACH ROW EXECUTE FUNCTION notify_participant_change();

-- ========================================
-- STEP 4: Supabase Realtime Publication 설정
-- ========================================

-- 실시간 구독을 위한 Publication 생성
CREATE PUBLICATION supabase_realtime FOR TABLE 
    survey_state,
    responses,
    participants,
    activity_logs,
    emoji_reactions,
    questions;

-- ========================================
-- STEP 5: RLS (Row Level Security) 업데이트
-- ========================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Enable realtime for all" ON survey_state;
DROP POLICY IF EXISTS "Enable realtime for all" ON responses;
DROP POLICY IF EXISTS "Enable realtime for all" ON participants;

-- 실시간 접근을 위한 새 정책
CREATE POLICY "Enable realtime for all" ON survey_state
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable realtime for all" ON responses
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable realtime for all" ON participants
    FOR ALL USING (true) WITH CHECK (true);

-- ========================================
-- STEP 6: 실시간 동기화를 위한 헬퍼 함수
-- ========================================

-- 현재 퀴즈 상태 가져오기
CREATE OR REPLACE FUNCTION get_current_quiz_state()
RETURNS TABLE (
    status VARCHAR,
    current_question INTEGER,
    current_session INTEGER,
    timer_end TIMESTAMP WITH TIME ZONE,
    total_participants INTEGER,
    total_responses INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.status,
        s.current_question,
        s.current_session,
        s.timer_end,
        (SELECT COUNT(*)::INTEGER FROM participants WHERE is_active = true) as total_participants,
        (SELECT COUNT(*)::INTEGER FROM responses WHERE question_id = s.current_question) as total_responses
    FROM survey_state s
    ORDER BY s.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 질문별 응답 통계
CREATE OR REPLACE FUNCTION get_question_responses(q_id INTEGER)
RETURNS TABLE (
    answer_text TEXT,
    answer_count INTEGER,
    percentage NUMERIC
) AS $$
DECLARE
    total_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM responses WHERE question_id = q_id;
    
    IF total_count = 0 THEN
        total_count := 1;
    END IF;
    
    RETURN QUERY
    SELECT 
        r.answer_text,
        COUNT(*)::INTEGER as answer_count,
        ROUND((COUNT(*) * 100.0 / total_count), 1) as percentage
    FROM responses r
    WHERE r.question_id = q_id
    GROUP BY r.answer_text
    ORDER BY answer_count DESC;
END;
$$ LANGUAGE plpgsql;

-- 참여자 실시간 상태
CREATE OR REPLACE FUNCTION get_participants_status()
RETURNS TABLE (
    user_id VARCHAR,
    nickname VARCHAR,
    gender VARCHAR,
    color_hex VARCHAR,
    answered_count INTEGER,
    last_active TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.user_id,
        p.nickname,
        p.gender,
        p.color_hex,
        (SELECT COUNT(*)::INTEGER FROM responses r WHERE r.user_id = p.user_id) as answered_count,
        p.last_active
    FROM participants p
    WHERE p.is_active = true
    ORDER BY p.joined_at;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- STEP 7: 실시간 뷰 생성
-- ========================================

-- 실시간 대시보드 뷰
CREATE OR REPLACE VIEW realtime_dashboard AS
SELECT 
    (SELECT status FROM survey_state ORDER BY created_at DESC LIMIT 1) as quiz_status,
    (SELECT current_question FROM survey_state ORDER BY created_at DESC LIMIT 1) as current_question,
    (SELECT current_session FROM survey_state ORDER BY created_at DESC LIMIT 1) as current_session,
    (SELECT COUNT(*) FROM participants WHERE is_active = true) as total_participants,
    (SELECT COUNT(DISTINCT user_id) FROM responses 
     WHERE question_id = (SELECT current_question FROM survey_state ORDER BY created_at DESC LIMIT 1)) as current_responses,
    (SELECT COUNT(*) FROM questions) as total_questions,
    NOW() as last_updated;

-- 실시간 리더보드 뷰
CREATE OR REPLACE VIEW realtime_leaderboard AS
SELECT 
    p.nickname,
    p.gender,
    p.color_hex,
    COUNT(r.id) as answers_count,
    AVG(r.response_time_ms) as avg_response_time,
    MIN(r.submitted_at) as first_answer,
    MAX(r.submitted_at) as last_answer
FROM participants p
LEFT JOIN responses r ON p.user_id = r.user_id
WHERE p.is_active = true
GROUP BY p.user_id, p.nickname, p.gender, p.color_hex
ORDER BY answers_count DESC, avg_response_time ASC;

-- ========================================
-- STEP 8: 인덱스 최적화 (실시간 성능 향상)
-- ========================================

-- 기존 인덱스 삭제 후 재생성
DROP INDEX IF EXISTS idx_responses_realtime;
DROP INDEX IF EXISTS idx_participants_realtime;
DROP INDEX IF EXISTS idx_survey_state_realtime;

-- 실시간 쿼리 최적화 인덱스
CREATE INDEX idx_responses_realtime ON responses(question_id, user_id, submitted_at DESC);
CREATE INDEX idx_participants_realtime ON participants(is_active, joined_at DESC);
CREATE INDEX idx_survey_state_realtime ON survey_state(status, created_at DESC);
CREATE INDEX idx_activity_logs_realtime ON activity_logs(user_id, created_at DESC);

-- ========================================
-- STEP 9: Webhook 함수 (선택사항)
-- ========================================

-- 외부 서비스 알림용 Webhook 함수
CREATE OR REPLACE FUNCTION send_quiz_update_webhook()
RETURNS TRIGGER AS $$
DECLARE
    webhook_url TEXT := 'YOUR_WEBHOOK_URL'; -- 실제 webhook URL로 변경
    payload JSON;
BEGIN
    -- Webhook 페이로드 생성
    payload := json_build_object(
        'event', 'quiz_state_changed',
        'status', NEW.status,
        'current_question', NEW.current_question,
        'timestamp', NOW()
    );
    
    -- HTTP POST 요청 (pg_net extension 필요)
    -- PERFORM net.http_post(webhook_url, payload::text, '{"Content-Type": "application/json"}');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- STEP 10: 권한 설정
-- ========================================

-- anon 및 authenticated 사용자에게 실시간 권한 부여
GRANT SELECT ON realtime_dashboard TO anon, authenticated;
GRANT SELECT ON realtime_leaderboard TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_current_quiz_state() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_question_responses(INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_participants_status() TO anon, authenticated;

-- ========================================
-- 완료 메시지
-- ========================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Supabase 실시간 기능 설정 완료!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '활성화된 기능:';
    RAISE NOTICE '✅ Realtime Publication 설정';
    RAISE NOTICE '✅ 실시간 트리거 (상태, 응답, 참여자)';
    RAISE NOTICE '✅ 실시간 뷰 (대시보드, 리더보드)';
    RAISE NOTICE '✅ 헬퍼 함수 (상태, 통계, 참여자)';
    RAISE NOTICE '✅ 성능 최적화 인덱스';
    RAISE NOTICE '';
    RAISE NOTICE '사용 방법:';
    RAISE NOTICE '1. Supabase Dashboard > Database > Replication 확인';
    RAISE NOTICE '2. JavaScript에서 supabase.channel() 사용';
    RAISE NOTICE '3. survey_state, responses, participants 테이블 구독';
    RAISE NOTICE '========================================';
END $$;