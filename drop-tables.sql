-- ===================================================
-- DROP TABLES SQL - 기존 테이블 및 객체 삭제
-- ===================================================
-- 이 스크립트는 모든 기존 테이블과 관련 객체를 삭제합니다
-- 주의: 모든 데이터가 영구적으로 삭제됩니다!

-- 1. 기존 테이블 삭제 (CASCADE로 관련 객체도 함께 삭제)
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS responses CASCADE;
DROP TABLE IF EXISTS survey_state CASCADE;
DROP TABLE IF EXISTS participants CASCADE;

-- 2. 기존 함수 삭제
DROP FUNCTION IF EXISTS get_color_for_gender CASCADE;
DROP FUNCTION IF EXISTS get_current_quiz_state CASCADE;
DROP FUNCTION IF EXISTS notify_state_change CASCADE;
DROP FUNCTION IF EXISTS notify_response_change CASCADE;
DROP FUNCTION IF EXISTS notify_participant_change CASCADE;

-- 3. 기존 뷰 삭제
DROP VIEW IF EXISTS quiz_statistics CASCADE;
DROP VIEW IF EXISTS session_results CASCADE;

-- 4. 기존 Publication 삭제
DROP PUBLICATION IF EXISTS quiz_realtime;

-- 5. 기존 정책 삭제는 테이블 삭제시 자동으로 처리됨

-- 완료 메시지
SELECT 'All tables and related objects have been dropped successfully' AS status;