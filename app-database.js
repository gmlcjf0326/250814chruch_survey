// Supabase 데이터베이스 연동 버전
// Realtime을 DB와 연동하여 영구 저장 + 실시간 동기화

// 데이터베이스 기반 설문 시작
async function startSurveyWithDB() {
    if (!supabaseClient) return;
    
    try {
        // 현재 상태 업데이트
        const { data, error } = await supabaseClient
            .from('survey_state')
            .update({
                status: 'active',
                current_question: 1,
                start_time: new Date().toISOString(),
                timer_end: new Date(Date.now() + 20000).toISOString()
            })
            .eq('id', getSurveyStateId())
            .select();
        
        if (error) throw error;
        console.log('설문 시작됨:', data);
        
        // 로컬 상태도 업데이트
        updateLocalState(data[0]);
        
    } catch (error) {
        console.error('설문 시작 오류:', error);
        // 폴백: LocalStorage 사용
        startSurvey();
    }
}

// 응답 저장 (DB)
async function saveResponseToDB(questionId, userId, answer) {
    if (!supabaseClient) return;
    
    try {
        // 응답 저장
        const { data, error } = await supabaseClient
            .from('responses')
            .insert({
                question_id: questionId,
                user_id: userId,
                answer: answer
            })
            .select();
        
        if (error) throw error;
        console.log('응답 저장됨:', data);
        
        // 참여자 업데이트
        await updateParticipant(userId);
        
    } catch (error) {
        console.error('응답 저장 오류:', error);
        // 폴백: LocalStorage 사용
        saveResponseLocal(questionId, userId, answer);
    }
}

// 참여자 정보 업데이트
async function updateParticipant(userId) {
    if (!supabaseClient) return;
    
    try {
        const { error } = await supabaseClient
            .from('participants')
            .upsert({
                user_id: userId,
                last_active: new Date().toISOString()
            });
        
        if (error) throw error;
        
    } catch (error) {
        console.error('참여자 업데이트 오류:', error);
    }
}

// 실시간 구독 설정 (DB 기반)
async function setupDatabaseSubscription() {
    if (!supabaseClient) return;
    
    // survey_state 테이블 구독
    supabaseClient
        .channel('survey-state-changes')
        .on('postgres_changes', 
            { 
                event: '*', 
                schema: 'public', 
                table: 'survey_state' 
            },
            (payload) => {
                console.log('상태 변경:', payload);
                handleStateChange(payload.new);
            }
        )
        .subscribe();
    
    // responses 테이블 구독
    supabaseClient
        .channel('response-changes')
        .on('postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'responses'
            },
            (payload) => {
                console.log('새 응답:', payload);
                handleNewResponseDB(payload.new);
            }
        )
        .subscribe();
    
    // participants 테이블 구독
    supabaseClient
        .channel('participant-changes')
        .on('postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'participants'
            },
            (payload) => {
                console.log('참여자 변경:', payload);
                updateParticipantCount();
            }
        )
        .subscribe();
    
    console.log('데이터베이스 실시간 구독 활성화');
}

// 상태 변경 핸들러
function handleStateChange(newState) {
    // UI 업데이트
    if (newState.status === 'active') {
        updateQuestionDisplay(newState.current_question);
        startTimerDisplay(newState.timer_end);
    } else if (newState.status === 'finished') {
        showFinishedScreen();
    }
    
    // 관리자 화면 업데이트
    if (window.location.pathname.includes('admin.html')) {
        updateAdminDisplay();
    }
}

// 새 응답 핸들러 (DB)
function handleNewResponseDB(response) {
    // 결과 화면 업데이트
    if (window.location.pathname.includes('result.html')) {
        updateResultChart(response.question_id);
    }
    
    // 관리자 화면 업데이트
    if (window.location.pathname.includes('admin.html')) {
        updateResponseCount(response.question_id);
    }
}

// 초기 데이터 로드
async function loadInitialData() {
    if (!supabaseClient) return;
    
    try {
        // 현재 설문 상태 가져오기
        const { data: stateData, error: stateError } = await supabaseClient
            .from('survey_state')
            .select('*')
            .single();
        
        if (stateError) throw stateError;
        updateLocalState(stateData);
        
        // 문제 목록 가져오기
        const { data: questionsData, error: questionsError } = await supabaseClient
            .from('questions')
            .select('*')
            .order('question_number');
        
        if (questionsError) throw questionsError;
        APP_STATE.questions = questionsData;
        
        // 기존 응답 가져오기
        const { data: responsesData, error: responsesError } = await supabaseClient
            .from('responses')
            .select('*');
        
        if (responsesError) throw responsesError;
        processResponses(responsesData);
        
        console.log('초기 데이터 로드 완료');
        
    } catch (error) {
        console.error('데이터 로드 오류:', error);
    }
}

// 로컬 상태 업데이트
function updateLocalState(dbState) {
    APP_STATE.surveyStatus = dbState.status;
    APP_STATE.currentQuestion = dbState.current_question;
    
    // LocalStorage도 업데이트 (폴백용)
    localStorage.setItem('survey_state', JSON.stringify({
        status: dbState.status,
        currentQuestion: dbState.current_question,
        timerEnd: new Date(dbState.timer_end).getTime()
    }));
}

// 응답 데이터 처리
function processResponses(responses) {
    const grouped = {};
    responses.forEach(r => {
        if (!grouped[r.question_id]) {
            grouped[r.question_id] = [];
        }
        grouped[r.question_id].push(r);
    });
    APP_STATE.responses = grouped;
}

// 참여자 수 업데이트
async function updateParticipantCount() {
    if (!supabaseClient) return;
    
    try {
        const { count, error } = await supabaseClient
            .from('participants')
            .select('*', { count: 'exact', head: true });
        
        if (error) throw error;
        
        document.querySelectorAll('#participant-count').forEach(el => {
            el.textContent = count || 0;
        });
        
    } catch (error) {
        console.error('참여자 수 조회 오류:', error);
    }
}

// 결과 통계 가져오기
async function getResultStatistics(questionId) {
    if (!supabaseClient) return;
    
    try {
        const { data, error } = await supabaseClient
            .from('responses')
            .select('answer')
            .eq('question_id', questionId);
        
        if (error) throw error;
        
        // 답변별 집계
        const counts = {};
        data.forEach(r => {
            counts[r.answer] = (counts[r.answer] || 0) + 1;
        });
        
        return counts;
        
    } catch (error) {
        console.error('통계 조회 오류:', error);
        return {};
    }
}

// 설문 상태 ID 가져오기 (단일 레코드 사용)
function getSurveyStateId() {
    // 실제로는 첫 번째 레코드 사용 또는 특정 ID 지정
    return localStorage.getItem('survey_state_id') || '';
}

// 초기화 시 설문 상태 확인
async function initSurveyState() {
    if (!supabaseClient) return;
    
    try {
        const { data, error } = await supabaseClient
            .from('survey_state')
            .select('id')
            .limit(1)
            .single();
        
        if (data) {
            localStorage.setItem('survey_state_id', data.id);
        }
        
    } catch (error) {
        console.error('설문 상태 초기화 오류:', error);
    }
}

// DB 모드 초기화
async function initDatabaseMode() {
    if (supabaseClient) {
        console.log('데이터베이스 모드 시작');
        await initSurveyState();
        await loadInitialData();
        await setupDatabaseSubscription();
        
        // 전역 함수 교체
        window.startSurvey = startSurveyWithDB;
        window.saveResponse = saveResponseToDB;
    }
}

// 페이지 로드시 DB 모드 초기화
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initDatabaseMode, 1000); // Supabase 초기화 대기
});