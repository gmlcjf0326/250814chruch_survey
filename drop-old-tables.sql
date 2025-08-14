-- 기존 테이블 및 관련 객체 완전 삭제
-- Supabase SQL Editor에서 실행하세요
-- 주의: 이 스크립트는 모든 기존 데이터를 삭제합니다!

-- 1. Publication 삭제 (실시간 구독)
DROP PUBLICATION IF EXISTS supabase_realtime CASCADE;

-- 2. 기존 테이블 삭제 (CASCADE로 관련 객체도 함께 삭제)
DROP TABLE IF EXISTS survey_events CASCADE;
DROP TABLE IF EXISTS emoji_reactions CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS responses CASCADE;
DROP TABLE IF EXISTS survey_state CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS participants CASCADE;

-- 3. 기존 함수 삭제
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS get_color_by_gender(VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS assign_color_on_insert() CASCADE;

-- 4. 기존 뷰 삭제
DROP VIEW IF EXISTS response_stats CASCADE;

-- 5. 기존 시퀀스 삭제 (테이블과 함께 삭제되지만 명시적으로 확인)
DROP SEQUENCE IF EXISTS questions_id_seq CASCADE;

-- 6. 확인 메시지
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '모든 기존 테이블과 관련 객체가 삭제되었습니다.';
    RAISE NOTICE '이제 new-schema.sql을 실행하세요.';
    RAISE NOTICE '========================================';
END $$;