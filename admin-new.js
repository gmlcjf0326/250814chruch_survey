// 청년부 수련회 퀴즈 시스템 - 관리자 JavaScript
// 60문제 지원, 세션별 관리

// 전역 상태 관리
const ADMIN_STATE = {
    surveyStatus: 'waiting',
    currentSession: 0,
    currentQuestion: 0,
    totalQuestions: 60,
    timerSeconds: 10,
    timerInterval: null,
    syncInterval: null,
    participants: [],
    responses: {},
    questions: [],
    quizData: null,
    useSupabase: false,
    channel: null,
    realTimeChart: null
};

// LocalStorage 키
const STORAGE_KEYS = {
    SURVEY_STATE: 'survey_state',
    QUESTIONS: 'survey_questions',
    RESPONSES: 'survey_responses',
    PARTICIPANTS: 'survey_participants',
    QUIZ_DATA: 'quiz_data_60'
};

// 세션 정보
const SESSIONS = [
    { number: 1, name: '오프닝 & 워밍업', questions: 5 },
    { number: 2, name: '신앙 관련', questions: 7 },
    { number: 3, name: '연애 & 관계', questions: 8 },
    { number: 4, name: '청년부 어워즈', questions: 10 },
    { number: 5, name: '커플 매칭', questions: 5 },
    { number: 6, name: '재미있는 질문', questions: 7 },
    { number: 7, name: 'TMI & 비밀', questions: 5 },
    { number: 8, name: '청년부 RPG', questions: 5 },
    { number: 9, name: '따뜻한 마음', questions: 5 },
    { number: 10, name: '타임캡슐 & 미래', questions: 3 }
];

// 퀴즈 데이터 로드
async function loadQuizData() {
    try {
        const response = await fetch('quiz-data-60.json');
        ADMIN_STATE.quizData = await response.json();
        
        // 질문 배열 생성
        ADMIN_STATE.questions = [];
        ADMIN_STATE.quizData.sessions.forEach(session => {
            session.questions.forEach(q => {
                ADMIN_STATE.questions.push({
                    ...q,
                    session_number: session.session_number,
                    session_name: session.session_name
                });
            });
        });
        
        ADMIN_STATE.totalQuestions = ADMIN_STATE.questions.length;
        localStorage.setItem(STORAGE_KEYS.QUIZ_DATA, JSON.stringify(ADMIN_STATE.quizData));
        return true;
    } catch (error) {
        console.error('퀴즈 데이터 로드 실패:', error);
        const backupData = localStorage.getItem(STORAGE_KEYS.QUIZ_DATA);
        if (backupData) {
            ADMIN_STATE.quizData = JSON.parse(backupData);
            // 질문 배열 재생성
            ADMIN_STATE.questions = [];
            ADMIN_STATE.quizData.sessions.forEach(session => {
                session.questions.forEach(q => {
                    ADMIN_STATE.questions.push({
                        ...q,
                        session_number: session.session_number,
                        session_name: session.session_name
                    });
                });
            });
            ADMIN_STATE.totalQuestions = ADMIN_STATE.questions.length;
            return true;
        }
        return false;
    }
}

// 관리자 화면 초기화
function initAdminScreen() {
    // 비밀번호 인증 제거 - 바로 관리자 화면 진입
    console.log('관리자 화면 초기화');
    
    // 퀴즈 데이터 로드
    loadQuizData().then(success => {
        if (!success) {
            alert('퀴즈 데이터를 불러올 수 없습니다.');
            return;
        }
        
        // UI 초기화
        initializeUI();
        loadCurrentState();
        updateParticipantsBubbles();
        displayQuestionList();
        displaySessionProgress();
        
        // 실시간 동기화 시작
        startAdminSync();
        
        // 차트 초기화
        initializeChart();
    });
}

// UI 초기화
function initializeUI() {
    // 제어 버튼 이벤트
    document.getElementById('start-quiz').addEventListener('click', startQuiz);
    document.getElementById('next-question').addEventListener('click', nextQuestion);
    document.getElementById('prev-question').addEventListener('click', prevQuestion);
    document.getElementById('end-quiz').addEventListener('click', endQuiz);
    document.getElementById('reset-data').addEventListener('click', resetData);
    
    // 세션 선택
    document.getElementById('session-select').addEventListener('change', handleSessionChange);
    
    // 탭 버튼
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filterQuestionsBySession(this.dataset.session);
        });
    });
}

// 현재 상태 로드
function loadCurrentState() {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEYS.SURVEY_STATE) || '{}');
    const participants = JSON.parse(localStorage.getItem(STORAGE_KEYS.PARTICIPANTS) || '[]');
    const responses = JSON.parse(localStorage.getItem(STORAGE_KEYS.RESPONSES) || '{}');
    
    ADMIN_STATE.surveyStatus = state.status || 'waiting';
    ADMIN_STATE.currentSession = state.currentSession || 0;
    ADMIN_STATE.currentQuestion = state.currentQuestion || 0;
    ADMIN_STATE.participants = participants;
    ADMIN_STATE.responses = responses;
    
    updateStatusDisplay();
    updateControlButtons();
}

// 상태 표시 업데이트
function updateStatusDisplay() {
    const currentQ = ADMIN_STATE.currentQuestion > 0 ? 
        ADMIN_STATE.questions[ADMIN_STATE.currentQuestion - 1] : null;
    
    // 현재 세션
    document.getElementById('current-session').textContent = 
        currentQ ? `${currentQ.session_number}. ${currentQ.session_name}` : '-';
    
    // 현재 문제 번호
    document.getElementById('current-question-num').textContent = 
        ADMIN_STATE.currentQuestion || '-';
    document.getElementById('admin-question-num').textContent = 
        currentQ ? `세션 ${currentQ.session_number} - 문제 ${ADMIN_STATE.currentQuestion} / 60` : '대기 중...';
    
    // 참여자 수
    document.getElementById('participant-count').textContent = 
        ADMIN_STATE.participants.length;
    
    // 응답 수
    const currentResponses = ADMIN_STATE.responses[ADMIN_STATE.currentQuestion] || {};
    const responseCount = Object.keys(currentResponses).length;
    document.getElementById('response-count').textContent = responseCount;
    
    // 응답률
    const responseRate = ADMIN_STATE.participants.length > 0 ? 
        Math.round((responseCount / ADMIN_STATE.participants.length) * 100) : 0;
    document.getElementById('response-rate').textContent = responseRate;
    
    // 문제 미리보기
    if (currentQ) {
        showQuestionPreview(currentQ);
    }
}

// 문제 미리보기 표시
function showQuestionPreview(question) {
    document.getElementById('preview-number').textContent = `Q${question.question_number}`;
    document.getElementById('preview-type').textContent = getQuestionTypeLabel(question.question_type);
    document.getElementById('preview-question').textContent = question.question_text;
    document.getElementById('preview-timer').textContent = question.timer_seconds;
    document.getElementById('preview-chart').textContent = question.chart_type;
    
    const optionsContainer = document.getElementById('preview-options');
    optionsContainer.innerHTML = '';
    
    if (question.options && Array.isArray(question.options)) {
        const optionsList = document.createElement('ul');
        optionsList.style.listStyle = 'none';
        optionsList.style.padding = '0';
        
        question.options.forEach(option => {
            const li = document.createElement('li');
            li.style.padding = '0.5rem';
            li.style.background = 'var(--gray-50)';
            li.style.marginBottom = '0.5rem';
            li.style.borderRadius = 'var(--radius-md)';
            li.textContent = option;
            optionsList.appendChild(li);
        });
        
        optionsContainer.appendChild(optionsList);
    } else if (question.options === 'dynamic_all_participants') {
        optionsContainer.innerHTML = '<p style="color: var(--gray-500)">동적 참여자 목록</p>';
    }
}

// 질문 유형 라벨
function getQuestionTypeLabel(type) {
    const labels = {
        'radio': '단일선택',
        'checkbox': '복수선택',
        'text': '텍스트',
        'slider': '슬라이더',
        'emoji': '이모지',
        'dropdown': '드롭다운',
        'conditional': '조건부',
        'voting': '투표'
    };
    return labels[type] || type;
}

// 제어 버튼 업데이트
function updateControlButtons() {
    const startBtn = document.getElementById('start-quiz');
    const nextBtn = document.getElementById('next-question');
    const prevBtn = document.getElementById('prev-question');
    const endBtn = document.getElementById('end-quiz');
    
    if (ADMIN_STATE.surveyStatus === 'waiting') {
        startBtn.disabled = false;
        nextBtn.disabled = true;
        prevBtn.disabled = true;
        endBtn.disabled = true;
    } else if (ADMIN_STATE.surveyStatus === 'active') {
        startBtn.disabled = true;
        nextBtn.disabled = ADMIN_STATE.currentQuestion >= ADMIN_STATE.totalQuestions;
        prevBtn.disabled = ADMIN_STATE.currentQuestion <= 1;
        endBtn.disabled = false;
    } else if (ADMIN_STATE.surveyStatus === 'finished') {
        startBtn.disabled = false;
        nextBtn.disabled = true;
        prevBtn.disabled = true;
        endBtn.disabled = true;
    }
}

// 퀴즈 시작
function startQuiz() {
    if (confirm('퀴즈를 시작하시겠습니까?')) {
        const state = {
            status: 'active',
            currentSession: 1,
            currentQuestion: 1,
            timerEnd: Date.now() + (ADMIN_STATE.questions[0].timer_seconds * 1000),
            startTime: Date.now()
        };
        
        localStorage.setItem(STORAGE_KEYS.SURVEY_STATE, JSON.stringify(state));
        ADMIN_STATE.surveyStatus = 'active';
        ADMIN_STATE.currentSession = 1;
        ADMIN_STATE.currentQuestion = 1;
        
        startTimer(ADMIN_STATE.questions[0].timer_seconds);
        updateStatusDisplay();
        updateControlButtons();
    }
}

// 다음 문제
function nextQuestion() {
    if (ADMIN_STATE.currentQuestion < ADMIN_STATE.totalQuestions) {
        ADMIN_STATE.currentQuestion++;
        const question = ADMIN_STATE.questions[ADMIN_STATE.currentQuestion - 1];
        
        const state = {
            status: 'active',
            currentSession: question.session_number,
            currentQuestion: ADMIN_STATE.currentQuestion,
            timerEnd: Date.now() + (question.timer_seconds * 1000)
        };
        
        localStorage.setItem(STORAGE_KEYS.SURVEY_STATE, JSON.stringify(state));
        ADMIN_STATE.currentSession = question.session_number;
        
        startTimer(question.timer_seconds);
        updateStatusDisplay();
        updateControlButtons();
        updateRealTimeChart();
    }
}

// 이전 문제
function prevQuestion() {
    if (ADMIN_STATE.currentQuestion > 1) {
        ADMIN_STATE.currentQuestion--;
        const question = ADMIN_STATE.questions[ADMIN_STATE.currentQuestion - 1];
        
        const state = {
            status: 'active',
            currentSession: question.session_number,
            currentQuestion: ADMIN_STATE.currentQuestion,
            timerEnd: Date.now() + (question.timer_seconds * 1000)
        };
        
        localStorage.setItem(STORAGE_KEYS.SURVEY_STATE, JSON.stringify(state));
        ADMIN_STATE.currentSession = question.session_number;
        
        startTimer(question.timer_seconds);
        updateStatusDisplay();
        updateControlButtons();
        updateRealTimeChart();
    }
}

// 퀴즈 종료
function endQuiz() {
    if (confirm('퀴즈를 종료하시겠습니까?')) {
        const state = {
            status: 'finished',
            currentSession: 0,
            currentQuestion: 0,
            endTime: Date.now()
        };
        
        localStorage.setItem(STORAGE_KEYS.SURVEY_STATE, JSON.stringify(state));
        ADMIN_STATE.surveyStatus = 'finished';
        ADMIN_STATE.currentSession = 0;
        ADMIN_STATE.currentQuestion = 0;
        
        clearInterval(ADMIN_STATE.timerInterval);
        updateStatusDisplay();
        updateControlButtons();
        
        alert('퀴즈가 종료되었습니다. 결과 화면에서 확인하세요.');
    }
}

// 데이터 초기화
async function resetData() {
    const confirmMsg = '모든 데이터를 초기화하시겠습니까?\n\n' +
                      '삭제될 내용:\n' +
                      '- 모든 참여자 정보\n' +
                      '- 모든 응답 데이터\n' +
                      '- 활동 로그\n' +
                      '- 현재 퀴즈 상태\n\n' +
                      '이 작업은 되돌릴 수 없습니다!';
    
    if (!confirm(confirmMsg)) {
        return;
    }
    
    // 두 번째 확인
    if (!confirm('정말로 모든 데이터를 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        // Supabase 사용 가능한 경우
        if (typeof SupabaseSync !== 'undefined' && SupabaseSync.useSupabase && SupabaseSync.client) {
            console.log('Supabase에서 데이터 삭제 중...');
            
            // 모든 테이블 데이터 삭제 (테이블 구조는 유지)
            const { error: logsError } = await SupabaseSync.client
                .from('activity_logs')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // 모든 행 삭제
            
            const { error: responsesError } = await SupabaseSync.client
                .from('responses')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000');
            
            const { error: participantsError } = await SupabaseSync.client
                .from('participants')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000');
            
            // 기존 survey_state 삭제
            const { error: stateDeleteError } = await SupabaseSync.client
                .from('survey_state')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000');
            
            // 새로운 초기 상태 삽입
            const { error: stateInsertError } = await SupabaseSync.client
                .from('survey_state')
                .insert({
                    current_question: 0,
                    status: 'waiting',
                    timer_end: null,
                    current_session: 0,
                    is_result_visible: false
                });
            
            if (logsError || responsesError || participantsError || stateDeleteError || stateInsertError) {
                console.error('Supabase 초기화 오류:', {
                    logsError,
                    responsesError,
                    participantsError,
                    stateDeleteError,
                    stateInsertError
                });
                alert('Supabase 데이터 초기화 중 일부 오류가 발생했습니다. 콘솔을 확인하세요.');
            } else {
                console.log('Supabase 데이터 초기화 완료');
            }
        }
        
        // LocalStorage 초기화
        localStorage.removeItem(STORAGE_KEYS.SURVEY_STATE);
        localStorage.removeItem(STORAGE_KEYS.RESPONSES);
        localStorage.removeItem(STORAGE_KEYS.PARTICIPANTS);
        localStorage.removeItem('activity_logs');
        
        // 관리자 상태 초기화
        ADMIN_STATE.surveyStatus = 'waiting';
        ADMIN_STATE.currentSession = 0;
        ADMIN_STATE.currentQuestion = 0;
        ADMIN_STATE.participants = [];
        ADMIN_STATE.responses = {};
        
        // 초기 상태 설정
        const initialState = {
            status: 'waiting',
            currentQuestion: 0,
            currentSession: 0,
            timerEnd: null,
            startTime: null,
            endTime: null
        };
        localStorage.setItem(STORAGE_KEYS.SURVEY_STATE, JSON.stringify(initialState));
        
        // UI 업데이트
        clearInterval(ADMIN_STATE.timerInterval);
        updateStatusDisplay();
        updateControlButtons();
        updateParticipantsBubbles();
        
        // 차트 초기화
        if (ADMIN_STATE.realTimeChart) {
            ADMIN_STATE.realTimeChart.data.labels = [];
            ADMIN_STATE.realTimeChart.data.datasets[0].data = [];
            ADMIN_STATE.realTimeChart.update();
        }
        
        // 성공 메시지
        alert('✅ 모든 데이터가 성공적으로 초기화되었습니다.\n\n새로운 퀴즈를 시작할 수 있습니다.');
        
    } catch (error) {
        console.error('데이터 초기화 중 오류:', error);
        alert('데이터 초기화 중 오류가 발생했습니다.\n콘솔에서 자세한 내용을 확인하세요.');
    }
}

// 타이머 시작
function startTimer(seconds) {
    clearInterval(ADMIN_STATE.timerInterval);
    
    let remaining = seconds;
    updateTimerDisplay(remaining);
    
    ADMIN_STATE.timerInterval = setInterval(() => {
        remaining--;
        updateTimerDisplay(remaining);
        
        if (remaining <= 0) {
            clearInterval(ADMIN_STATE.timerInterval);
            // 자동으로 다음 문제로 이동하지 않음 (관리자가 제어)
        }
    }, 1000);
}

// 타이머 표시 업데이트
function updateTimerDisplay(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const display = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    document.getElementById('timer-display').textContent = display;
    document.getElementById('admin-timer').textContent = display;
}

// 세션 변경 처리
function handleSessionChange(e) {
    const sessionNum = parseInt(e.target.value);
    
    if (sessionNum === 0) {
        // 전체 세션
        displayQuestionList();
    } else {
        // 특정 세션
        filterQuestionsBySession(sessionNum);
    }
}

// 문제 목록 표시
function displayQuestionList(sessionFilter = 0) {
    const container = document.getElementById('questions-container');
    container.innerHTML = '';
    
    const questions = sessionFilter > 0 ? 
        ADMIN_STATE.questions.filter(q => q.session_number === sessionFilter) :
        ADMIN_STATE.questions;
    
    questions.forEach((question, index) => {
        const actualIndex = sessionFilter > 0 ? 
            ADMIN_STATE.questions.indexOf(question) : index;
        
        const card = document.createElement('div');
        card.className = 'question-card';
        if (actualIndex + 1 === ADMIN_STATE.currentQuestion) {
            card.classList.add('current');
        }
        
        card.innerHTML = `
            <div class="question-card-header">
                <span class="question-number">Q${question.question_number}</span>
                <span class="question-session">${question.session_name}</span>
            </div>
            <div class="question-card-body">
                <p>${question.question_text}</p>
            </div>
            <div class="question-card-footer">
                <span class="question-type">${getQuestionTypeLabel(question.question_type)}</span>
                <span class="question-timer">⏱️ ${question.timer_seconds}초</span>
                <button class="jump-btn" onclick="jumpToQuestion(${actualIndex + 1})">이동</button>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// 세션별로 문제 필터링
function filterQuestionsBySession(sessionNum) {
    displayQuestionList(parseInt(sessionNum));
}

// 특정 문제로 이동
window.jumpToQuestion = function(questionNum) {
    if (ADMIN_STATE.surveyStatus !== 'active') {
        alert('퀴즈가 진행 중이 아닙니다.');
        return;
    }
    
    if (confirm(`문제 ${questionNum}번으로 이동하시겠습니까?`)) {
        ADMIN_STATE.currentQuestion = questionNum;
        const question = ADMIN_STATE.questions[questionNum - 1];
        
        const state = {
            status: 'active',
            currentSession: question.session_number,
            currentQuestion: questionNum,
            timerEnd: Date.now() + (question.timer_seconds * 1000)
        };
        
        localStorage.setItem(STORAGE_KEYS.SURVEY_STATE, JSON.stringify(state));
        ADMIN_STATE.currentSession = question.session_number;
        
        startTimer(question.timer_seconds);
        updateStatusDisplay();
        updateControlButtons();
        updateRealTimeChart();
    }
};

// 세션 진행 현황 표시
function displaySessionProgress() {
    const container = document.querySelector('.session-cards');
    if (!container) return;
    
    container.innerHTML = '';
    
    SESSIONS.forEach(session => {
        const sessionQuestions = ADMIN_STATE.questions.filter(q => q.session_number === session.number);
        const sessionResponses = sessionQuestions.filter(q => {
            const responses = ADMIN_STATE.responses[q.question_number] || {};
            return Object.keys(responses).length > 0;
        });
        
        const progress = sessionQuestions.length > 0 ? 
            Math.round((sessionResponses.length / sessionQuestions.length) * 100) : 0;
        
        const card = document.createElement('div');
        card.className = 'session-card';
        if (session.number === ADMIN_STATE.currentSession) {
            card.classList.add('active');
        }
        
        card.innerHTML = `
            <h4>세션 ${session.number}</h4>
            <p>${session.name}</p>
            <div class="session-stats">
                <span>${sessionResponses.length}/${session.questions} 완료</span>
                <span>${progress}%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// 참여자 버블 업데이트
function updateParticipantsBubbles() {
    const container = document.getElementById('participants-bar');
    const gridContainer = document.getElementById('participants-grid');
    
    if (!container) return;
    
    const participants = JSON.parse(localStorage.getItem(STORAGE_KEYS.PARTICIPANTS) || '[]');
    const responses = JSON.parse(localStorage.getItem(STORAGE_KEYS.RESPONSES) || '{}');
    
    // 버블 바 업데이트
    container.innerHTML = '';
    
    participants.forEach(participant => {
        const bubble = document.createElement('div');
        bubble.className = `participant-bubble ${participant.gender}`;
        bubble.style.backgroundColor = participant.color;
        
        const hasAnswered = ADMIN_STATE.currentQuestion && 
            responses[ADMIN_STATE.currentQuestion] && 
            responses[ADMIN_STATE.currentQuestion][participant.userId];
        
        if (hasAnswered) {
            bubble.classList.add('answered');
        }
        
        bubble.innerHTML = `<span class="bubble-name">${participant.nickname.substring(0, 2)}</span>`;
        container.appendChild(bubble);
    });
    
    // 참여자 수 표시
    const countEl = document.createElement('div');
    countEl.className = 'participant-count';
    countEl.textContent = `${participants.length}명`;
    container.appendChild(countEl);
    
    // 참여자 그리드 업데이트
    if (gridContainer) {
        gridContainer.innerHTML = '';
        participants.forEach(participant => {
            const card = document.createElement('div');
            card.className = 'participant-card';
            
            const answeredCount = Object.keys(responses).filter(qNum => {
                return responses[qNum] && responses[qNum][participant.userId];
            }).length;
            
            card.innerHTML = `
                <div class="participant-avatar" style="background: ${participant.color}">
                    ${participant.nickname.substring(0, 2)}
                </div>
                <div class="participant-info">
                    <h4>${participant.nickname}</h4>
                    <span>${participant.gender === 'male' ? '남' : '여'}</span>
                    <span>${answeredCount}/${ADMIN_STATE.totalQuestions} 답변</span>
                </div>
            `;
            
            gridContainer.appendChild(card);
        });
    }
}

// 실시간 차트 초기화
function initializeChart() {
    const ctx = document.getElementById('real-time-chart');
    if (!ctx) return;
    
    ADMIN_STATE.realTimeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: '응답 수',
                data: [],
                backgroundColor: 'rgba(37, 99, 235, 0.5)',
                borderColor: 'rgba(37, 99, 235, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    },
                    max: 30
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: 10
                    }
                }
            }
        }
    });
}

// 실시간 차트 업데이트
function updateRealTimeChart() {
    if (!ADMIN_STATE.realTimeChart || ADMIN_STATE.currentQuestion === 0) return;
    
    const question = ADMIN_STATE.questions[ADMIN_STATE.currentQuestion - 1];
    const responses = ADMIN_STATE.responses[ADMIN_STATE.currentQuestion] || {};
    
    // 차트 타입 변경
    const chartType = getChartType(question.chart_type);
    if (ADMIN_STATE.realTimeChart.config.type !== chartType) {
        ADMIN_STATE.realTimeChart.config.type = chartType;
    }
    
    // 데이터 집계
    const responseData = {};
    
    if (question.question_type === 'text') {
        // 텍스트 답변은 워드클라우드로 표시
        Object.values(responses).forEach(r => {
            const answer = r.answer_text || r.answer || '-';
            responseData[answer] = (responseData[answer] || 0) + 1;
        });
    } else if (question.options && Array.isArray(question.options)) {
        // 옵션이 있는 경우
        question.options.forEach(option => {
            responseData[option] = 0;
        });
        
        Object.values(responses).forEach(r => {
            const answer = r.answer_text || r.answer || (r.answer_options && r.answer_options[0]);
            if (answer && responseData[answer] !== undefined) {
                responseData[answer]++;
            }
        });
    } else {
        // 동적 참여자 목록 등
        Object.values(responses).forEach(r => {
            const answer = r.answer_text || r.answer || '-';
            responseData[answer] = (responseData[answer] || 0) + 1;
        });
    }
    
    // 차트 데이터 업데이트
    ADMIN_STATE.realTimeChart.data.labels = Object.keys(responseData);
    ADMIN_STATE.realTimeChart.data.datasets[0].data = Object.values(responseData);
    
    // 색상 업데이트
    if (chartType === 'pie' || chartType === 'doughnut') {
        const colors = generateColors(Object.keys(responseData).length);
        ADMIN_STATE.realTimeChart.data.datasets[0].backgroundColor = colors;
        ADMIN_STATE.realTimeChart.data.datasets[0].borderColor = colors;
    }
    
    ADMIN_STATE.realTimeChart.update();
    
    // 결과 요약 업데이트
    updateResultsSummary(responseData);
}

// 차트 타입 매핑
function getChartType(type) {
    const mapping = {
        'bar': 'bar',
        'pie': 'pie',
        'donut': 'doughnut',
        'histogram': 'bar',
        'ranking': 'bar',
        'heatmap': 'bar',
        'word_cloud': 'bar'
    };
    return mapping[type] || 'bar';
}

// 색상 생성
function generateColors(count) {
    const colors = [];
    for (let i = 0; i < count; i++) {
        const hue = (i * 360 / count) % 360;
        colors.push(`hsl(${hue}, 70%, 60%)`);
    }
    return colors;
}

// 결과 요약 업데이트
function updateResultsSummary(data) {
    const container = document.getElementById('results-summary');
    if (!container) return;
    
    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
    
    let html = '<div class="summary-list">';
    sorted.slice(0, 5).forEach(([answer, count]) => {
        const percentage = ADMIN_STATE.participants.length > 0 ? 
            Math.round((count / ADMIN_STATE.participants.length) * 100) : 0;
        
        html += `
            <div class="summary-item">
                <span class="answer-text">${answer}</span>
                <span class="answer-count">${count}명 (${percentage}%)</span>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}

// 관리자 동기화
function startAdminSync() {
    ADMIN_STATE.syncInterval = setInterval(() => {
        // 상태 새로고침
        loadCurrentState();
        updateParticipantsBubbles();
        displaySessionProgress();
        updateRealTimeChart();
        
        // 타이머 업데이트
        const state = JSON.parse(localStorage.getItem(STORAGE_KEYS.SURVEY_STATE) || '{}');
        if (state.status === 'active' && state.timerEnd) {
            const remaining = Math.max(0, Math.floor((state.timerEnd - Date.now()) / 1000));
            updateTimerDisplay(remaining);
        }
    }, 1000);
}

// 페이지 언로드시 정리
window.addEventListener('beforeunload', () => {
    clearInterval(ADMIN_STATE.timerInterval);
    clearInterval(ADMIN_STATE.syncInterval);
});

// 전역 함수로 내보내기
window.initAdminScreen = initAdminScreen;