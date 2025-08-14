-- Supabase SQL Editor에서 실행하세요
-- 청년부 설문조사 시스템 데이터베이스 스키마

-- 1. 설문 상태 테이블
CREATE TABLE IF NOT EXISTS survey_state (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'waiting', -- waiting, active, finished
    current_question INTEGER DEFAULT 0,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    timer_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 문제 테이블
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    question_number INTEGER NOT NULL,
    question_type VARCHAR(20) NOT NULL, -- multiple, text
    question_text TEXT NOT NULL,
    options JSONB, -- 5지선다 옵션들을 JSON 배열로 저장
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 응답 테이블
CREATE TABLE IF NOT EXISTS responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    question_id INTEGER REFERENCES questions(id),
    user_id VARCHAR(100) NOT NULL, -- 익명 사용자 ID
    answer TEXT NOT NULL,
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 참여자 테이블
CREATE TABLE IF NOT EXISTS participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id VARCHAR(100) UNIQUE NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 실시간 이벤트 테이블 (옵션)
CREATE TABLE IF NOT EXISTS survey_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL, -- state_change, new_response, question_update
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_responses_question_id ON responses(question_id);
CREATE INDEX idx_responses_user_id ON responses(user_id);
CREATE INDEX idx_participants_user_id ON participants(user_id);
CREATE INDEX idx_survey_events_created_at ON survey_events(created_at);

-- 업데이트 시간 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
CREATE TRIGGER update_survey_state_updated_at BEFORE UPDATE ON survey_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 기본 설문 상태 삽입
INSERT INTO survey_state (status, current_question) 
VALUES ('waiting', 0)
ON CONFLICT DO NOTHING;

-- 샘플 문제 데이터 삽입
INSERT INTO questions (question_number, question_type, question_text, options) VALUES
(1, 'multiple', '오늘 예배는 어떠셨나요?', '["매우 은혜로웠다", "은혜로웠다", "보통이다", "집중하기 어려웠다", "잘 모르겠다"]'::jsonb),
(2, 'multiple', '청년부에서 가장 중요하게 생각하는 가치는?', '["진정한 예배", "따뜻한 공동체", "말씀 공부", "전도와 선교", "섬김과 봉사"]'::jsonb),
(3, 'text', '나에게 청년부란? (한 단어로)', NULL),
(4, 'multiple', '가장 좋아하는 성경 인물은?', '["다윗", "다니엘", "바울", "베드로", "에스더"]'::jsonb),
(5, 'multiple', '청년부 활동 중 가장 참여하고 싶은 것은?', '["캠프/수련회", "성경공부 소모임", "찬양팀", "봉사활동", "친교모임"]'::jsonb),
(6, 'text', '최근 받은 은혜나 감동을 나눠주세요', NULL),
(7, 'multiple', '평소 기도 시간은 언제인가요?', '["새벽", "아침", "점심", "저녁", "자기 전"]'::jsonb),
(8, 'multiple', '청년부 모임 적정 인원은?', '["10명 이하", "10-20명", "20-30명", "30-50명", "50명 이상"]'::jsonb),
(9, 'text', '올해 이루고 싶은 소원 하나는?', NULL),
(10, 'multiple', '가장 도전받고 싶은 신앙 분야는?', '["성경 통독", "전도", "중보기도", "금식기도", "QT 생활화"]'::jsonb),
(11, 'multiple', '청년부 SNS/단톡방 활용도는?', '["매우 자주 확인", "하루 1-2번", "가끔 확인", "거의 안 봄", "참여 안 함"]'::jsonb),
(12, 'text', '청년부에 새로 오신 분께 한마디!', NULL),
(13, 'multiple', '신앙생활의 가장 큰 기쁨은?', '["예배드릴 때", "기도 응답받을 때", "말씀 깨달을 때", "섬길 때", "교제할 때"]'::jsonb),
(14, 'multiple', '청년부 리더십으로 섬기고 싶은 분야는?', '["찬양팀", "새가족팀", "미디어팀", "교육팀", "아직 모르겠음"]'::jsonb),
(15, 'text', '2025년 청년부 표어를 제안한다면?', NULL)
ON CONFLICT DO NOTHING;

-- Row Level Security (RLS) 활성화
ALTER TABLE survey_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_events ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽기 가능
CREATE POLICY "Public read access" ON survey_state FOR SELECT USING (true);
CREATE POLICY "Public read questions" ON questions FOR SELECT USING (true);
CREATE POLICY "Public read responses" ON responses FOR SELECT USING (true);
CREATE POLICY "Public read participants" ON participants FOR SELECT USING (true);

-- 모든 사용자가 쓰기 가능 (익명 참여를 위해)
CREATE POLICY "Public insert responses" ON responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert participants" ON participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update survey_state" ON survey_state FOR UPDATE USING (true);
CREATE POLICY "Public insert events" ON survey_events FOR INSERT WITH CHECK (true);

-- 실시간 구독을 위한 Publication 생성
DROP PUBLICATION IF EXISTS supabase_realtime CASCADE;
CREATE PUBLICATION supabase_realtime FOR TABLE survey_state, responses, survey_events;

-- 권한 부여
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon;