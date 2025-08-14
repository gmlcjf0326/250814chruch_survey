// 통합 버전 - Supabase 실시간 동기화 + 버그 수정

// 전역 상태 관리
const APP_STATE = {
    surveyStatus: 'waiting',
    currentQuestion: 0,
    totalQuestions: 15,
    timerSeconds: 20,
    timerInterval: null,
    syncInterval: null,
    participants: [],
    responses: {},
    questions: [],
    useSupabase: false,
    channel: null
};

// LocalStorage 키
const STORAGE_KEYS = {
    SURVEY_STATE: 'survey_state',
    QUESTIONS: 'survey_questions',
    RESPONSES: 'survey_responses',
    PARTICIPANTS: 'survey_participants'
};

// 초기 문제 데이터 설정
function initializeQuestions() {
    const defaultQuestions = [
        {
            id: 1,
            type: 'multiple',
            question: '오늘 예배는 어떠셨나요?',
            options: ['매우 은혜로웠다', '은혜로웠다', '보통이다', '집중하기 어려웠다', '잘 모르겠다']
        },
        {
            id: 2,
            type: 'multiple',
            question: '청년부에서 가장 중요하게 생각하는 가치는?',
            options: ['진정한 예배', '따뜻한 공동체', '말씀 공부', '전도와 선교', '섬김과 봉사']
        },
        {
            id: 3,
            type: 'text',
            question: '나에게 청년부란? (한 단어로)',
            options: []
        },
        {
            id: 4,
            type: 'multiple',
            question: '가장 좋아하는 성경 인물은?',
            options: ['다윗', '다니엘', '바울', '베드로', '에스더']
        },
        {
            id: 5,
            type: 'multiple',
            question: '청년부 활동 중 가장 참여하고 싶은 것은?',
            options: ['캠프/수련회', '성경공부 소모임', '찬양팀', '봉사활동', '친교모임']
        },
        {
            id: 6,
            type: 'text',
            question: '최근 받은 은혜나 감동을 나눠주세요',
            options: []
        },
        {
            id: 7,
            type: 'multiple',
            question: '평소 기도 시간은 언제인가요?',
            options: ['새벽', '아침', '점심', '저녁', '자기 전']
        },
        {
            id: 8,
            type: 'multiple',
            question: '청년부 모임 적정 인원은?',
            options: ['10명 이하', '10-20명', '20-30명', '30-50명', '50명 이상']
        },
        {
            id: 9,
            type: 'text',
            question: '올해 이루고 싶은 소원 하나는?',
            options: []
        },
        {
            id: 10,
            type: 'multiple',
            question: '가장 도전받고 싶은 신앙 분야는?',
            options: ['성경 통독', '전도', '중보기도', '금식기도', 'QT 생활화']
        },
        {
            id: 11,
            type: 'multiple',
            question: '청년부 SNS/단톡방 활용도는?',
            options: ['매우 자주 확인', '하루 1-2번', '가끔 확인', '거의 안 봄', '참여 안 함']
        },
        {
            id: 12,
            type: 'text',
            question: '청년부에 새로 오신 분께 한마디!',
            options: []
        },
        {
            id: 13,
            type: 'multiple',
            question: '신앙생활의 가장 큰 기쁨은?',
            options: ['예배드릴 때', '기도 응답받을 때', '말씀 깨달을 때', '섬길 때', '교제할 때']
        },
        {
            id: 14,
            type: 'multiple',
            question: '청년부 리더십으로 섬기고 싶은 분야는?',
            options: ['찬양팀', '새가족팀', '미디어팀', '교육팀', '아직 모르겠음']
        },
        {
            id: 15,
            type: 'text',
            question: '2025년 청년부 표어를 제안한다면?',
            options: []
        }
    ];

    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(defaultQuestions));
    return defaultQuestions;
}

// Supabase 실시간 채널 설정
async function setupRealtimeChannel() {
    if (!supabaseClient) return;
    
    APP_STATE.channel = supabaseClient.channel('survey-room', {
        config: {
            broadcast: {
                self: true
            }
        }
    });
    
    APP_STATE.channel.on('broadcast', { event: 'survey-state' }, (payload) => {
        console.log('상태 업데이트:', payload.payload);
        handleStateUpdate(payload.payload);
    });
    
    APP_STATE.channel.on('broadcast', { event: 'new-response' }, (payload) => {
        console.log('새 응답:', payload.payload);
        handleNewResponse(payload.payload);
    });
    
    await APP_STATE.channel.subscribe();
    console.log('실시간 채널 연결됨');
}

// 상태 브로드캐스트
async function broadcastState(state) {
    if (APP_STATE.useSupabase && APP_STATE.channel) {
        await APP_STATE.channel.send({
            type: 'broadcast',
            event: 'survey-state',
            payload: state
        });
    }
    localStorage.setItem(STORAGE_KEYS.SURVEY_STATE, JSON.stringify(state));
}

// 응답 브로드캐스트
async function broadcastResponse(questionId, userId, answer) {
    const response = {
        questionId,
        userId,
        answer,
        timestamp: Date.now()
    };
    
    if (APP_STATE.useSupabase && APP_STATE.channel) {
        await APP_STATE.channel.send({
            type: 'broadcast',
            event: 'new-response',
            payload: response
        });
    }
    
    const responses = JSON.parse(localStorage.getItem(STORAGE_KEYS.RESPONSES) || '{}');
    if (!responses[questionId]) responses[questionId] = {};
    responses[questionId][userId] = { answer, timestamp: Date.now() };
    localStorage.setItem(STORAGE_KEYS.RESPONSES, JSON.stringify(responses));
}

// 상태 업데이트 핸들러
function handleStateUpdate(state) {
    localStorage.setItem(STORAGE_KEYS.SURVEY_STATE, JSON.stringify(state));
    
    if (window.location.pathname.includes('admin.html')) {
        updateAdminDisplay();
    }
}

// 새 응답 핸들러
function handleNewResponse(response) {
    const responses = JSON.parse(localStorage.getItem(STORAGE_KEYS.RESPONSES) || '{}');
    if (!responses[response.questionId]) {
        responses[response.questionId] = {};
    }
    responses[response.questionId][response.userId] = {
        answer: response.answer,
        timestamp: response.timestamp
    };
    localStorage.setItem(STORAGE_KEYS.RESPONSES, JSON.stringify(responses));
    
    if (window.location.pathname.includes('result.html')) {
        updateResultDisplay();
    }
    if (window.location.pathname.includes('admin.html')) {
        updateRealtimeChart();
    }
}

// 사용자 화면 초기화
function initUserScreen() {
    let userId = sessionStorage.getItem('userId');
    if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        sessionStorage.setItem('userId', userId);
    }

    startUserSync();
    
    const form = document.getElementById('answer-form');
    if (form) {
        form.addEventListener('submit', handleAnswerSubmit);
    }
}

// 관리자 화면 초기화
function initAdminScreen() {
    APP_STATE.questions = JSON.parse(localStorage.getItem(STORAGE_KEYS.QUESTIONS)) || initializeQuestions();
    
    const questionSelect = document.getElementById('question-select');
    if (questionSelect) {
        for (let i = 1; i <= 15; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `문제 ${i}`;
            questionSelect.appendChild(option);
        }
        questionSelect.addEventListener('change', loadQuestionForEdit);
    }

    displayQuestionList();
    
    document.getElementById('start-survey')?.addEventListener('click', startSurvey);
    document.getElementById('next-question')?.addEventListener('click', nextQuestion);
    document.getElementById('end-survey')?.addEventListener('click', endSurvey);
    document.getElementById('save-question')?.addEventListener('click', saveQuestion);
    document.getElementById('question-type')?.addEventListener('change', toggleOptionsEditor);
    document.getElementById('reset-data')?.addEventListener('click', resetSurveyData);
    
    initializeAdminChart();
    startAdminSync();
    loadQuestionForEdit();
}

// 결과 화면 초기화
function initResultScreen() {
    initializeResultCharts();
    initializeCumulativeStatistics();
    
    // 탭 버튼 이벤트 리스너
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            showCumulativeTab(tabName);
        });
    });
    
    document.getElementById('toggle-auto-refresh')?.addEventListener('click', toggleAutoRefresh);
    document.getElementById('export-csv')?.addEventListener('click', exportToCSV);
    document.getElementById('export-json')?.addEventListener('click', exportToJSON);
    document.getElementById('print-results')?.addEventListener('click', printResults);
    startResultSync();
    updateCumulativeStatistics();
}

// 설문 시작
async function startSurvey() {
    const state = {
        status: 'active',
        currentQuestion: 1,
        startTime: Date.now(),
        timerEnd: Date.now() + (APP_STATE.timerSeconds * 1000)
    };
    
    await broadcastState(state);
    
    document.getElementById('start-survey').disabled = true;
    document.getElementById('next-question').disabled = false;
    document.getElementById('end-survey').disabled = false;
    
    startTimer();
    updateAdminDisplay();
}

// 다음 문제로 이동 (관리자만 호출)
async function nextQuestion() {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEYS.SURVEY_STATE)) || {};
    
    if (state.currentQuestion < APP_STATE.totalQuestions) {
        state.currentQuestion++;
        state.timerEnd = Date.now() + (APP_STATE.timerSeconds * 1000);
        
        await broadcastState(state);
        
        clearInterval(APP_STATE.timerInterval);
        startTimer();
        updateAdminDisplay();
    } else {
        endSurvey();
    }
}

// 설문 종료
async function endSurvey() {
    const state = {
        status: 'finished',
        currentQuestion: 0,
        endTime: Date.now()
    };
    
    await broadcastState(state);
    
    clearInterval(APP_STATE.timerInterval);
    
    document.getElementById('start-survey').disabled = false;
    document.getElementById('next-question').disabled = true;
    document.getElementById('end-survey').disabled = true;
    
    updateAdminDisplay();
}

// 타이머 시작 (자동 다음 문제 제거)
function startTimer() {
    APP_STATE.timerInterval = setInterval(() => {
        const state = JSON.parse(localStorage.getItem(STORAGE_KEYS.SURVEY_STATE)) || {};
        const remaining = Math.max(0, Math.floor((state.timerEnd - Date.now()) / 1000));
        
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const adminTimer = document.getElementById('admin-timer');
        if (adminTimer) adminTimer.textContent = display;
        const timer = document.getElementById('timer');
        if (timer) timer.textContent = display;
        
        // 시간 초과시 알림만 표시 (자동 넘어가지 않음)
        if (remaining === 0) {
            clearInterval(APP_STATE.timerInterval);
            if (document.getElementById('admin-timer')) {
                document.getElementById('admin-timer').textContent = '시간 종료';
            }
        }
    }, 1000);
}

// 답변 제출 처리
async function handleAnswerSubmit(e) {
    e.preventDefault();
    
    const userId = sessionStorage.getItem('userId');
    const state = JSON.parse(localStorage.getItem(STORAGE_KEYS.SURVEY_STATE)) || {};
    const responses = JSON.parse(localStorage.getItem(STORAGE_KEYS.RESPONSES)) || {};
    
    // 이미 답변한 경우 체크
    if (responses[state.currentQuestion]?.[userId]) {
        alert('이미 답변하셨습니다.');
        return;
    }
    
    const questionData = APP_STATE.questions[state.currentQuestion - 1];
    let answer = '';
    
    if (questionData.type === 'multiple') {
        const selected = document.querySelector('input[name="answer"]:checked');
        if (selected) {
            answer = selected.value;
        } else {
            alert('답변을 선택해주세요.');
            return;
        }
    } else {
        answer = document.getElementById('text-answer')?.value?.trim() || '';
        if (!answer) {
            alert('답변을 입력해주세요.');
            return;
        }
    }
    
    if (answer) {
        // 제출 버튼 비활성화 (중복 제출 방지)
        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) submitBtn.disabled = true;
        
        await broadcastResponse(state.currentQuestion, userId, answer);
        
        // 현재 문제 번호 리셋 (다음 문제 표시 준비)
        currentQuestionShown = 0;
        
        // 화면 전환 (다음 문제로 넘어가지 않음)
        document.getElementById('question-screen').classList.remove('active');
        document.getElementById('submitted-screen').classList.add('active');
        document.getElementById('submitted-answer').textContent = answer;
    }
}

// 사용자 화면 동기화
function startUserSync() {
    APP_STATE.syncInterval = setInterval(() => {
        const state = JSON.parse(localStorage.getItem(STORAGE_KEYS.SURVEY_STATE)) || {};
        const questions = JSON.parse(localStorage.getItem(STORAGE_KEYS.QUESTIONS)) || [];
        const userId = sessionStorage.getItem('userId');
        const responses = JSON.parse(localStorage.getItem(STORAGE_KEYS.RESPONSES)) || {};
        
        // 타이머만 업데이트 (사용자가 입력 중일 때 방해하지 않음)
        if (state.status === 'active' && state.currentQuestion > 0) {
            const remaining = Math.max(0, Math.floor((state.timerEnd - Date.now()) / 1000));
            const minutes = Math.floor(remaining / 60);
            const seconds = remaining % 60;
            const timerEl = document.getElementById('timer');
            if (timerEl) {
                timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
            
            const questionNumEl = document.querySelector('.question-number');
            if (questionNumEl) {
                questionNumEl.textContent = `문제 ${state.currentQuestion} / ${APP_STATE.totalQuestions}`;
            }
        }
        
        // 화면 전환은 상태가 변경될 때만
        if (state.status === 'active' && state.currentQuestion > 0) {
            const currentQ = questions[state.currentQuestion - 1];
            const hasAnswered = responses[state.currentQuestion]?.[userId];
            
            if (!hasAnswered && currentQ) {
                // 현재 화면이 문제 화면이 아닐 때만 전환
                if (!document.getElementById('question-screen').classList.contains('active')) {
                    showQuestion(currentQ, state.currentQuestion);
                } else {
                    // 문제 번호가 변경되었을 때만 새로운 문제 표시
                    if (currentQuestionShown !== state.currentQuestion) {
                        currentQuestionShown = 0; // 리셋하여 새 문제 표시
                        // 제출 버튼 재활성화
                        const submitBtn = document.getElementById('submit-btn');
                        if (submitBtn) submitBtn.disabled = false;
                        showQuestion(currentQ, state.currentQuestion);
                    }
                }
            } else if (hasAnswered) {
                // 이미 답변한 경우 제출 완료 화면
                if (!document.getElementById('submitted-screen').classList.contains('active')) {
                    document.getElementById('waiting-screen').classList.remove('active');
                    document.getElementById('question-screen').classList.remove('active');
                    document.getElementById('submitted-screen').classList.add('active');
                    document.getElementById('finished-screen').classList.remove('active');
                }
            }
        } else if (state.status === 'finished') {
            if (!document.getElementById('finished-screen').classList.contains('active')) {
                currentQuestionShown = 0; // 리셋
                document.getElementById('waiting-screen').classList.remove('active');
                document.getElementById('question-screen').classList.remove('active');
                document.getElementById('submitted-screen').classList.remove('active');
                document.getElementById('finished-screen').classList.add('active');
            }
        } else {
            if (!document.getElementById('waiting-screen').classList.contains('active')) {
                currentQuestionShown = 0; // 리셋
                document.getElementById('waiting-screen').classList.add('active');
                document.getElementById('question-screen').classList.remove('active');
                document.getElementById('submitted-screen').classList.remove('active');
                document.getElementById('finished-screen').classList.remove('active');
            }
        }
    }, 500);
}

// 문제 표시
let currentQuestionShown = 0; // 현재 표시된 문제 번호 추적

function showQuestion(question, questionNumber) {
    // 이미 표시된 문제면 다시 렌더링하지 않음
    if (currentQuestionShown === questionNumber) {
        return;
    }
    
    currentQuestionShown = questionNumber;
    
    document.getElementById('waiting-screen').classList.remove('active');
    document.getElementById('question-screen').classList.add('active');
    document.getElementById('submitted-screen').classList.remove('active');
    
    document.getElementById('question-title').textContent = `Q${questionNumber}. ${question.question}`;
    
    const optionsContainer = document.getElementById('options-container');
    const textContainer = document.getElementById('text-answer-container');
    
    // 제출 버튼 활성화 (새 문제마다)
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
        submitBtn.disabled = false;
    }
    
    if (question.type === 'multiple') {
        optionsContainer.style.display = 'block';
        textContainer.style.display = 'none';
        
        // 선택된 값 저장
        const selectedValue = document.querySelector('input[name="answer"]:checked')?.value;
        
        optionsContainer.innerHTML = '';
        question.options.forEach((option, index) => {
            const div = document.createElement('div');
            div.className = 'option-item';
            const isSelected = selectedValue === option;
            if (isSelected) div.classList.add('selected');
            
            div.innerHTML = `
                <input type="radio" id="option-${index}" name="answer" value="${option}" ${isSelected ? 'checked' : ''}>
                <label for="option-${index}">${option}</label>
            `;
            div.addEventListener('click', () => {
                document.getElementById(`option-${index}`).checked = true;
                document.querySelectorAll('.option-item').forEach(item => item.classList.remove('selected'));
                div.classList.add('selected');
            });
            optionsContainer.appendChild(div);
        });
    } else {
        // 단답형 문제
        optionsContainer.style.display = 'none';
        textContainer.style.display = 'block';
        
        // 텍스트 입력 필드 초기화 및 포커스
        const textInput = document.getElementById('text-answer');
        if (textInput) {
            textInput.value = ''; // 새 문제일 때 입력값 초기화
            textInput.disabled = false; // 입력 필드 활성화
            setTimeout(() => textInput.focus(), 100); // 약간의 지연 후 포커스
        }
    }
}

// 관리자 화면 동기화
function startAdminSync() {
    APP_STATE.syncInterval = setInterval(() => {
        updateAdminDisplay();
        updateRealtimeChart();
    }, 1000);
}

// 관리자 화면 업데이트
function updateAdminDisplay() {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEYS.SURVEY_STATE)) || {};
    const responses = JSON.parse(localStorage.getItem(STORAGE_KEYS.RESPONSES)) || {};
    
    const currentQuestionNum = document.getElementById('current-question-num');
    if (currentQuestionNum) {
        currentQuestionNum.textContent = state.currentQuestion || '-';
    }
    
    const allParticipants = new Set();
    Object.values(responses).forEach(questionResponses => {
        Object.keys(questionResponses).forEach(userId => allParticipants.add(userId));
    });
    
    const participantCount = document.getElementById('participant-count');
    if (participantCount) {
        participantCount.textContent = allParticipants.size;
    }
    
    const currentResponses = responses[state.currentQuestion] || {};
    const responseCount = document.getElementById('response-count');
    if (responseCount) {
        responseCount.textContent = Object.keys(currentResponses).length;
    }
    
    if (state.currentQuestion > 0 && APP_STATE.questions[state.currentQuestion - 1]) {
        const currentQ = APP_STATE.questions[state.currentQuestion - 1];
        const previewQuestion = document.getElementById('preview-question');
        if (previewQuestion) {
            previewQuestion.textContent = currentQ.question;
        }
        
        const previewOptions = document.getElementById('preview-options');
        if (previewOptions) {
            previewOptions.innerHTML = '';
            if (currentQ.type === 'multiple') {
                currentQ.options.forEach(option => {
                    const div = document.createElement('div');
                    div.className = 'option-preview';
                    div.textContent = `• ${option}`;
                    previewOptions.appendChild(div);
                });
            } else {
                previewOptions.innerHTML = '<div class="option-preview">단답형 문제</div>';
            }
        }
    }
    
    updateQuestionListStatus();
}

// 차트 관련 전역 변수
let adminChart = null;
let currentQuestionChart = null;
let participationTrendChart = null;

// 관리자 실시간 차트 초기화
function initializeAdminChart() {
    const ctx = document.getElementById('real-time-chart');
    if (!ctx) return;
    
    adminChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: '응답 수',
                data: [],
                backgroundColor: 'rgba(74, 144, 226, 0.6)',
                borderColor: 'rgba(74, 144, 226, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// 실시간 차트 업데이트
function updateRealtimeChart() {
    if (!adminChart) return;
    
    const state = JSON.parse(localStorage.getItem(STORAGE_KEYS.SURVEY_STATE)) || {};
    const responses = JSON.parse(localStorage.getItem(STORAGE_KEYS.RESPONSES)) || {};
    
    if (state.currentQuestion > 0 && APP_STATE.questions[state.currentQuestion - 1]) {
        const currentQ = APP_STATE.questions[state.currentQuestion - 1];
        const currentResponses = responses[state.currentQuestion] || {};
        
        if (currentQ.type === 'multiple') {
            const counts = {};
            currentQ.options.forEach(option => { counts[option] = 0; });
            
            Object.values(currentResponses).forEach(response => {
                if (counts.hasOwnProperty(response.answer)) {
                    counts[response.answer]++;
                }
            });
            
            adminChart.data.labels = Object.keys(counts);
            adminChart.data.datasets[0].data = Object.values(counts);
        } else {
            adminChart.data.labels = ['응답'];
            adminChart.data.datasets[0].data = [Object.keys(currentResponses).length];
        }
        
        adminChart.update();
        updateResultsSummary(currentQ, currentResponses);
    }
}

// 결과 화면 차트 초기화 (버그 수정)
function initializeResultCharts() {
    const ctx1 = document.getElementById('current-question-chart');
    if (ctx1) {
        // 기존 차트가 있으면 제거
        if (currentQuestionChart) {
            currentQuestionChart.destroy();
        }
        
        const gradients = [];
        const colors = [
            ['rgba(102, 126, 234, 0.9)', 'rgba(118, 75, 162, 0.9)'],
            ['rgba(72, 187, 120, 0.9)', 'rgba(56, 161, 105, 0.9)'],
            ['rgba(240, 147, 251, 0.9)', 'rgba(245, 87, 108, 0.9)'],
            ['rgba(254, 202, 87, 0.9)', 'rgba(255, 159, 10, 0.9)'],
            ['rgba(155, 89, 182, 0.9)', 'rgba(142, 68, 173, 0.9)']
        ];
        
        colors.forEach((color, index) => {
            const gradient = ctx1.getContext('2d').createLinearGradient(0, 0, 200, 200);
            gradient.addColorStop(0, color[0]);
            gradient.addColorStop(1, color[1]);
            gradients.push(gradient);
        });
        
        currentQuestionChart = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: gradients,
                    borderColor: '#fff',
                    borderWidth: 3,
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                cutout: '50%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            padding: 15,
                            font: {
                                size: 12
                            },
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            size: 14
                        },
                        bodyFont: {
                            size: 13
                        },
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return label + ': ' + value + '명 (' + percentage + '%)';
                            }
                        }
                    }
                }
            }
        });
    }
    
    const ctx2 = document.getElementById('participation-trend');
    if (ctx2) {
        // 기존 차트가 있으면 제거
        if (participationTrendChart) {
            participationTrendChart.destroy();
        }
        
        participationTrendChart = new Chart(ctx2, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '누적 참여자',
                    data: [],
                    borderColor: 'rgba(74, 144, 226, 1)',
                    backgroundColor: 'rgba(74, 144, 226, 0.1)',
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

// 결과 화면 동기화
let autoRefreshActive = true;
let resultSyncInterval = null;

function startResultSync() {
    // 기존 interval 제거
    if (resultSyncInterval) {
        clearInterval(resultSyncInterval);
    }
    
    resultSyncInterval = setInterval(() => {
        if (autoRefreshActive) {
            updateResultDisplay();
        }
    }, 1000);
}

// 나머지 함수들은 기존 app.js와 동일...
// (문제 편집, 저장, 내보내기 등)

// 초기화
document.addEventListener('DOMContentLoaded', async function() {
    // Supabase 초기화
    APP_STATE.useSupabase = initSupabase();
    
    if (APP_STATE.useSupabase) {
        console.log('Supabase 모드로 실행');
        await setupRealtimeChannel();
    } else {
        console.log('LocalStorage 모드로 실행');
    }
    
    // 문제 초기화
    APP_STATE.questions = JSON.parse(localStorage.getItem(STORAGE_KEYS.QUESTIONS)) || initializeQuestions();
    
    // 페이지별 초기화
    if (window.location.pathname.includes('index.html')) {
        initUserScreen();
    } else if (window.location.pathname.includes('admin.html')) {
        initAdminScreen();
    } else if (window.location.pathname.includes('result.html')) {
        initResultScreen();
    }
});

// 페이지 언로드시 정리
window.addEventListener('beforeunload', () => {
    clearInterval(APP_STATE.timerInterval);
    clearInterval(APP_STATE.syncInterval);
    clearInterval(resultSyncInterval);
});

// 나머지 필요한 함수들 추가
function displayQuestionList() {
    const container = document.getElementById('questions-container');
    if (!container) return;
    
    container.innerHTML = '';
    APP_STATE.questions.forEach((q, index) => {
        const div = document.createElement('div');
        div.className = 'question-item';
        div.dataset.questionId = index + 1;
        div.innerHTML = `
            <span>문제 ${index + 1}</span>
            <span class="question-preview-text">${q.question.substring(0, 30)}...</span>
        `;
        div.addEventListener('click', () => {
            document.getElementById('question-select').value = index + 1;
            loadQuestionForEdit();
        });
        container.appendChild(div);
    });
}

function updateQuestionListStatus() {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEYS.SURVEY_STATE)) || {};
    const responses = JSON.parse(localStorage.getItem(STORAGE_KEYS.RESPONSES)) || {};
    
    document.querySelectorAll('.question-item').forEach(item => {
        const qId = parseInt(item.dataset.questionId);
        item.classList.remove('active', 'completed');
        
        if (qId === state.currentQuestion && state.status === 'active') {
            item.classList.add('active');
        } else if (responses[qId] && Object.keys(responses[qId]).length > 0) {
            item.classList.add('completed');
        }
    });
}

function loadQuestionForEdit() {
    const questionId = parseInt(document.getElementById('question-select').value);
    const question = APP_STATE.questions[questionId - 1];
    
    if (question) {
        document.getElementById('question-text').value = question.question;
        document.getElementById('question-type').value = question.type;
        
        if (question.type === 'multiple') {
            document.getElementById('options-editor').style.display = 'block';
            document.querySelectorAll('.option-input').forEach((input, index) => {
                input.value = question.options[index] || '';
            });
        } else {
            document.getElementById('options-editor').style.display = 'none';
        }
    }
}

function saveQuestion() {
    const questionId = parseInt(document.getElementById('question-select').value);
    const questionText = document.getElementById('question-text').value;
    const questionType = document.getElementById('question-type').value;
    
    const question = {
        id: questionId,
        type: questionType,
        question: questionText,
        options: []
    };
    
    if (questionType === 'multiple') {
        document.querySelectorAll('.option-input').forEach(input => {
            if (input.value.trim()) {
                question.options.push(input.value.trim());
            }
        });
    }
    
    APP_STATE.questions[questionId - 1] = question;
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(APP_STATE.questions));
    
    displayQuestionList();
    alert('문제가 저장되었습니다!');
}

function toggleOptionsEditor() {
    const type = document.getElementById('question-type').value;
    document.getElementById('options-editor').style.display = 
        type === 'multiple' ? 'block' : 'none';
}

function updateResultsSummary(question, responses) {
    const summary = document.getElementById('results-summary');
    if (!summary) return;
    
    const total = Object.keys(responses).length;
    
    if (question.type === 'multiple') {
        const counts = {};
        question.options.forEach(option => { counts[option] = 0; });
        
        Object.values(responses).forEach(response => {
            if (counts.hasOwnProperty(response.answer)) {
                counts[response.answer]++;
            }
        });
        
        let html = '<div class="summary-list">';
        Object.entries(counts).forEach(([option, count]) => {
            const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
            html += `
                <div class="summary-item">
                    <span>${option}</span>
                    <span>${count}명 (${percentage}%)</span>
                </div>
            `;
        });
        html += '</div>';
        summary.innerHTML = html;
    } else {
        const recentAnswers = Object.values(responses)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 5)
            .map(r => r.answer);
        
        let html = '<div class="text-answers">';
        html += '<h4>최근 응답:</h4>';
        recentAnswers.forEach(answer => {
            html += `<div class="text-answer-item">"${answer}"</div>`;
        });
        html += '</div>';
        summary.innerHTML = html;
    }
}

function updateResultDisplay() {
    if (!autoRefreshActive) return;
    
    const state = JSON.parse(localStorage.getItem(STORAGE_KEYS.SURVEY_STATE)) || {};
    const responses = JSON.parse(localStorage.getItem(STORAGE_KEYS.RESPONSES)) || {};
    const questions = JSON.parse(localStorage.getItem(STORAGE_KEYS.QUESTIONS)) || [];
    
    // 누적 통계도 업데이트
    updateCumulativeStatistics();
    
    // 전체 문제 결과 업데이트
    updateAllQuestionsResults(questions, responses);
    
    const now = new Date();
    const lastUpdateTime = document.getElementById('last-update-time');
    if (lastUpdateTime) {
        lastUpdateTime.textContent = now.toLocaleTimeString('ko-KR');
    }
    
    const allParticipants = new Set();
    Object.values(responses).forEach(questionResponses => {
        Object.keys(questionResponses).forEach(userId => allParticipants.add(userId));
    });
    
    const totalParticipants = document.getElementById('total-participants');
    if (totalParticipants) {
        totalParticipants.textContent = allParticipants.size;
    }
    
    const currentQuestionResult = document.getElementById('current-question-result');
    if (currentQuestionResult) {
        currentQuestionResult.textContent = state.currentQuestion || '-';
    }
    
    if (state.currentQuestion > 0 && allParticipants.size > 0) {
        const currentResponses = responses[state.currentQuestion] || {};
        const responseRate = ((Object.keys(currentResponses).length / allParticipants.size) * 100).toFixed(0);
        const responseRateEl = document.getElementById('response-rate');
        if (responseRateEl) {
            responseRateEl.textContent = responseRate;
        }
    }
    
    const statusText = state.status === 'active' ? '진행중' : 
                      state.status === 'finished' ? '완료' : '대기중';
    const surveyStatus = document.getElementById('survey-status');
    if (surveyStatus) {
        surveyStatus.textContent = statusText;
    }
    
    if (state.currentQuestion > 0 && questions[state.currentQuestion - 1]) {
        updateCurrentQuestionResult(questions[state.currentQuestion - 1], responses[state.currentQuestion] || {});
    }
    
    const completedQuestions = Object.keys(responses).filter(q => 
        Object.keys(responses[q]).length > 0
    ).length;
    const completedQuestionsEl = document.getElementById('completed-questions');
    if (completedQuestionsEl) {
        completedQuestionsEl.textContent = `${completedQuestions} / 15`;
    }
    
    updateAllResults(questions, responses);
    updateParticipationTrend(responses);
}

function updateCurrentQuestionResult(question, responses) {
    const currentQuestionText = document.getElementById('current-question-text');
    if (currentQuestionText) {
        currentQuestionText.textContent = question.question;
    }
    
    const currentResponses = document.getElementById('current-responses');
    if (currentResponses) {
        currentResponses.textContent = Object.keys(responses).length;
    }
    
    if (!currentQuestionChart) return;
    
    if (question.type === 'multiple') {
        const counts = {};
        question.options.forEach(option => { counts[option] = 0; });
        
        Object.values(responses).forEach(response => {
            if (counts.hasOwnProperty(response.answer)) {
                counts[response.answer]++;
            }
        });
        
        currentQuestionChart.data.labels = Object.keys(counts);
        currentQuestionChart.data.datasets[0].data = Object.values(counts);
        currentQuestionChart.update();
        
        const optionsResults = document.getElementById('options-results');
        if (optionsResults) {
            optionsResults.innerHTML = '';
            
            const total = Object.keys(responses).length;
            Object.entries(counts).forEach(([option, count]) => {
                const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
                const div = document.createElement('div');
                div.className = 'option-result';
                div.innerHTML = `
                    <span class="option-text">${option}</span>
                    <div class="option-bar" style="width: ${percentage}%"></div>
                    <span class="option-percentage">${count}명 (${percentage}%)</span>
                `;
                optionsResults.appendChild(div);
            });
        }
    }
}

function updateAllResults(questions, allResponses) {
    const container = document.getElementById('all-results');
    if (!container) return;
    
    let html = '';
    questions.forEach((question, index) => {
        const qNum = index + 1;
        const responses = allResponses[qNum] || {};
        const responseCount = Object.keys(responses).length;
        
        if (responseCount > 0) {
            html += `
                <div class="question-result-card">
                    <h4>문제 ${qNum}: ${question.question}</h4>
                    <p>응답: ${responseCount}명</p>
            `;
            
            if (question.type === 'multiple') {
                const counts = {};
                question.options.forEach(opt => { counts[opt] = 0; });
                Object.values(responses).forEach(r => {
                    if (counts.hasOwnProperty(r.answer)) counts[r.answer]++;
                });
                
                html += '<div class="result-options">';
                Object.entries(counts).forEach(([opt, count]) => {
                    const pct = ((count / responseCount) * 100).toFixed(1);
                    html += `<div>${opt}: ${count}명 (${pct}%)</div>`;
                });
                html += '</div>';
            } else {
                html += '<div class="text-responses">';
                const answers = Object.values(responses).slice(0, 3);
                answers.forEach(r => {
                    html += `<div>"${r.answer}"</div>`;
                });
                if (responseCount > 3) {
                    html += `<div>... 외 ${responseCount - 3}개</div>`;
                }
                html += '</div>';
            }
            
            html += '</div>';
        }
    });
    
    container.innerHTML = html || '<p>아직 응답이 없습니다.</p>';
}

function updateParticipationTrend(responses) {
    if (!participationTrendChart) return;
    
    const trendData = [];
    const labels = [];
    
    for (let i = 1; i <= 15; i++) {
        if (responses[i]) {
            const count = Object.keys(responses[i]).length;
            if (count > 0) {
                labels.push(`문제 ${i}`);
                trendData.push(count);
            }
        }
    }
    
    participationTrendChart.data.labels = labels;
    participationTrendChart.data.datasets[0].data = trendData;
    participationTrendChart.update();
}

function toggleAutoRefresh() {
    autoRefreshActive = !autoRefreshActive;
    const btn = document.getElementById('toggle-auto-refresh');
    if (btn) {
        btn.textContent = autoRefreshActive ? '자동 새로고침 ON' : '자동 새로고침 OFF';
        btn.classList.toggle('active', autoRefreshActive);
    }
    
    if (autoRefreshActive) {
        startResultSync();
    }
}

function exportToCSV() {
    const responses = JSON.parse(localStorage.getItem(STORAGE_KEYS.RESPONSES)) || {};
    const questions = JSON.parse(localStorage.getItem(STORAGE_KEYS.QUESTIONS)) || [];
    
    let csv = '문제번호,문제,사용자ID,답변,시간\n';
    
    Object.entries(responses).forEach(([qNum, qResponses]) => {
        const question = questions[parseInt(qNum) - 1];
        if (question) {
            Object.entries(qResponses).forEach(([userId, response]) => {
                const time = new Date(response.timestamp).toLocaleString('ko-KR');
                csv += `${qNum},"${question.question}","${userId}","${response.answer}","${time}"\n`;
            });
        }
    });
    
    downloadFile(csv, 'survey_results.csv', 'text/csv');
}

function exportToJSON() {
    const data = {
        surveyState: JSON.parse(localStorage.getItem(STORAGE_KEYS.SURVEY_STATE)) || {},
        questions: JSON.parse(localStorage.getItem(STORAGE_KEYS.QUESTIONS)) || [],
        responses: JSON.parse(localStorage.getItem(STORAGE_KEYS.RESPONSES)) || {},
        exportTime: new Date().toISOString()
    };
    
    downloadFile(JSON.stringify(data, null, 2), 'survey_results.json', 'application/json');
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function printResults() {
    window.print();
}

// 데이터 초기화 함수
function resetSurveyData() {
    // 확인 다이얼로그
    const confirmMsg = '⚠️ 주의: 모든 응답 데이터가 삭제됩니다!\n\n' +
                       '- 모든 참여자 응답 삭제\n' +
                       '- 참여자 정보 삭제\n' +
                       '- 설문 상태 초기화\n' +
                       '(문제 데이터는 유지됩니다)\n\n' +
                       '정말 초기화하시겠습니까?';
    
    if (!confirm(confirmMsg)) {
        return;
    }
    
    // 2차 확인
    if (!confirm('마지막 확인: 정말로 모든 데이터를 삭제하시겠습니까?')) {
        return;
    }
    
    try {
        // 백업 생성
        backupSurveyData();
        
        // 세션 데이터 저장 (누적 통계용)
        saveSurveySession();
        
        // 데이터 초기화
        localStorage.removeItem(STORAGE_KEYS.RESPONSES);
        localStorage.removeItem(STORAGE_KEYS.PARTICIPANTS);
        
        // 설문 상태 초기화
        const initialState = {
            status: 'waiting',
            currentQuestion: 0,
            startTime: null,
            endTime: null
        };
        localStorage.setItem(STORAGE_KEYS.SURVEY_STATE, JSON.stringify(initialState));
        
        // 차트 초기화
        if (adminChart) {
            adminChart.data.labels = [];
            adminChart.data.datasets[0].data = [];
            adminChart.update();
        }
        
        // UI 업데이트
        document.getElementById('participant-count').textContent = '0';
        document.getElementById('response-count').textContent = '0';
        document.getElementById('current-question-num').textContent = '-';
        
        // 버튼 상태 초기화
        document.getElementById('start-survey').disabled = false;
        document.getElementById('next-question').disabled = true;
        document.getElementById('end-survey').disabled = true;
        
        // 문제 목록 상태 초기화
        document.querySelectorAll('.question-item').forEach(item => {
            item.classList.remove('active', 'completed');
        });
        
        alert('✅ 데이터가 성공적으로 초기화되었습니다.\n백업 파일이 생성되었습니다.');
        
        // 페이지 새로고침
        location.reload();
        
    } catch (error) {
        console.error('데이터 초기화 오류:', error);
        alert('❌ 초기화 중 오류가 발생했습니다.');
    }
}

// 데이터 백업 함수
function backupSurveyData() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupData = {
        timestamp: timestamp,
        state: localStorage.getItem(STORAGE_KEYS.SURVEY_STATE),
        responses: localStorage.getItem(STORAGE_KEYS.RESPONSES),
        participants: localStorage.getItem(STORAGE_KEYS.PARTICIPANTS),
        questions: localStorage.getItem(STORAGE_KEYS.QUESTIONS)
    };
    
    // 백업 저장
    localStorage.setItem(`survey_backup_${timestamp}`, JSON.stringify(backupData));
    
    // 백업 목록 관리 (최대 5개 유지)
    const backups = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('survey_backup_')) {
            backups.push(key);
        }
    }
    
    // 오래된 백업 삭제
    if (backups.length > 5) {
        backups.sort();
        const toDelete = backups.slice(0, backups.length - 5);
        toDelete.forEach(key => localStorage.removeItem(key));
    }
    
    console.log('백업 생성됨:', `survey_backup_${timestamp}`);
    return timestamp;
}

// 세션별 통계 저장
function saveSurveySession() {
    const responses = JSON.parse(localStorage.getItem(STORAGE_KEYS.RESPONSES) || '{}');
    const participants = JSON.parse(localStorage.getItem(STORAGE_KEYS.PARTICIPANTS) || '[]');
    
    if (Object.keys(responses).length === 0) return;
    
    const sessionData = {
        timestamp: Date.now(),
        date: new Date().toLocaleString('ko-KR'),
        totalParticipants: participants.length,
        totalResponses: Object.keys(responses).length,
        responses: responses,
        completionRate: calculateCompletionRate(responses)
    };
    
    // 세션 기록 저장
    const sessions = JSON.parse(localStorage.getItem('survey_sessions') || '[]');
    sessions.push(sessionData);
    
    // 최대 10개 세션 유지
    if (sessions.length > 10) {
        sessions.shift();
    }
    
    localStorage.setItem('survey_sessions', JSON.stringify(sessions));
    return sessionData;
}

// 완료율 계산
function calculateCompletionRate(responses) {
    const totalQuestions = 15;
    let totalParticipants = 0;
    let completedParticipants = 0;
    
    // 모든 참여자 ID 수집
    const allParticipants = new Set();
    Object.values(responses).forEach(questionResponses => {
        Object.keys(questionResponses).forEach(userId => {
            allParticipants.add(userId);
        });
    });
    
    totalParticipants = allParticipants.size;
    
    // 모든 문제에 답한 참여자 수 계산
    allParticipants.forEach(userId => {
        let answeredCount = 0;
        for (let i = 1; i <= totalQuestions; i++) {
            if (responses[i] && responses[i][userId]) {
                answeredCount++;
            }
        }
        if (answeredCount === totalQuestions) {
            completedParticipants++;
        }
    });
    
    return totalParticipants > 0 ? 
        ((completedParticipants / totalParticipants) * 100).toFixed(1) : 0;
}

// 누적 통계 차트 변수
let overallChart = null;
let questionsResponseChart = null;
let sessionsComparisonChart = null;
let trendsChart = null;

// 누적 통계 초기화
function initializeCumulativeStatistics() {
    // 전체 개요 차트
    const ctx1 = document.getElementById('overall-chart');
    if (ctx1) {
        const gradient1 = ctx1.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradient1.addColorStop(0, 'rgba(72, 187, 120, 0.9)');
        gradient1.addColorStop(1, 'rgba(56, 161, 105, 0.9)');
        
        const gradient2 = ctx1.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradient2.addColorStop(0, 'rgba(102, 126, 234, 0.9)');
        gradient2.addColorStop(1, 'rgba(118, 75, 162, 0.9)');
        
        const gradient3 = ctx1.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradient3.addColorStop(0, 'rgba(160, 174, 192, 0.9)');
        gradient3.addColorStop(1, 'rgba(129, 136, 148, 0.9)');
        
        overallChart = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: ['완료', '진행중', '미시작'],
                datasets: [{
                    label: '참여 현황',
                    data: [0, 0, 0],
                    backgroundColor: [gradient1, gradient2, gradient3],
                    borderColor: ['#fff', '#fff', '#fff'],
                    borderWidth: 3,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            font: {
                                size: 13,
                                family: "'Segoe UI', sans-serif"
                            },
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            size: 14
                        },
                        bodyFont: {
                            size: 13
                        },
                        padding: 12,
                        cornerRadius: 8,
                        displayColors: false
                    }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true
                }
            }
        });
    }
    
    // 문항별 응답 차트
    const ctx2 = document.getElementById('questions-response-chart');
    if (ctx2) {
        const gradientBar = ctx2.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradientBar.addColorStop(0, 'rgba(102, 126, 234, 0.8)');
        gradientBar.addColorStop(1, 'rgba(118, 75, 162, 0.6)');
        
        questionsResponseChart = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: '응답 수',
                    data: [],
                    backgroundColor: gradientBar,
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false,
                    hoverBackgroundColor: 'rgba(102, 126, 234, 0.9)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            size: 14
                        },
                        bodyFont: {
                            size: 13
                        },
                        padding: 12,
                        cornerRadius: 8
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            stepSize: 1,
                            font: {
                                size: 11
                            }
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    }
    
    // 세션별 비교 차트
    const ctx3 = document.getElementById('sessions-comparison-chart');
    if (ctx3) {
        const gradientLine1 = ctx3.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradientLine1.addColorStop(0, 'rgba(102, 126, 234, 0.3)');
        gradientLine1.addColorStop(1, 'rgba(102, 126, 234, 0.01)');
        
        const gradientLine2 = ctx3.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradientLine2.addColorStop(0, 'rgba(72, 187, 120, 0.3)');
        gradientLine2.addColorStop(1, 'rgba(72, 187, 120, 0.01)');
        
        sessionsComparisonChart = new Chart(ctx3, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '참여자 수',
                    data: [],
                    borderColor: 'rgba(102, 126, 234, 1)',
                    backgroundColor: gradientLine1,
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 5,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: 'rgba(102, 126, 234, 1)',
                    pointBorderWidth: 2,
                    pointHoverRadius: 7,
                    fill: true
                }, {
                    label: '완료율 (%)',
                    data: [],
                    borderColor: 'rgba(72, 187, 120, 1)',
                    backgroundColor: gradientLine2,
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 5,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: 'rgba(72, 187, 120, 1)',
                    pointBorderWidth: 2,
                    pointHoverRadius: 7,
                    yAxisID: 'y1',
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            padding: 15,
                            font: {
                                size: 12
                            },
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            size: 14
                        },
                        bodyFont: {
                            size: 13
                        },
                        padding: 12,
                        cornerRadius: 8,
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            font: {
                                size: 11
                            },
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    }
    
    // 추세 분석 차트
    const ctx4 = document.getElementById('trends-chart');
    if (ctx4) {
        const gradientArea = ctx4.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradientArea.addColorStop(0, 'rgba(102, 126, 234, 0.4)');
        gradientArea.addColorStop(0.5, 'rgba(118, 75, 162, 0.2)');
        gradientArea.addColorStop(1, 'rgba(118, 75, 162, 0.01)');
        
        trendsChart = new Chart(ctx4, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '누적 참여자',
                    data: [],
                    borderColor: 'rgba(102, 126, 234, 1)',
                    backgroundColor: gradientArea,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 3,
                    pointRadius: 6,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: 'rgba(102, 126, 234, 1)',
                    pointBorderWidth: 2,
                    pointHoverRadius: 8,
                    pointHoverBackgroundColor: 'rgba(102, 126, 234, 1)',
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            size: 14
                        },
                        bodyFont: {
                            size: 13
                        },
                        padding: 12,
                        cornerRadius: 8,
                        callbacks: {
                            label: function(context) {
                                return '누적: ' + context.parsed.y + '명';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: 11
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            font: {
                                size: 11
                            },
                            callback: function(value) {
                                return value + '명';
                            }
                        }
                    }
                },
                animation: {
                    duration: 1500,
                    easing: 'easeOutQuart'
                }
            }
        });
    }
}

// 누적 통계 업데이트
function updateCumulativeStatistics() {
    const sessions = JSON.parse(localStorage.getItem('survey_sessions') || '[]');
    const currentResponses = JSON.parse(localStorage.getItem(STORAGE_KEYS.RESPONSES) || '{}');
    const participants = JSON.parse(localStorage.getItem(STORAGE_KEYS.PARTICIPANTS) || '[]');
    
    // 전체 통계 계산
    let totalAllParticipants = participants.length;
    let totalAllResponses = 0;
    let totalSessions = sessions.length;
    
    // 세션 데이터 포함한 총계
    sessions.forEach(session => {
        totalAllParticipants += session.totalParticipants;
        totalAllResponses += session.totalResponses;
    });
    
    // 현재 세션 데이터 추가
    Object.values(currentResponses).forEach(qResponses => {
        totalAllResponses += Object.keys(qResponses).length;
    });
    
    // UI 업데이트
    const totalParticipantsEl = document.getElementById('total-all-participants');
    if (totalParticipantsEl) {
        totalParticipantsEl.textContent = totalAllParticipants;
    }
    
    const totalSessionsEl = document.getElementById('total-sessions');
    if (totalSessionsEl) {
        totalSessionsEl.textContent = totalSessions;
    }
    
    // 평균 완료율 계산
    let avgCompletionRate = 0;
    if (sessions.length > 0) {
        const totalRate = sessions.reduce((sum, session) => {
            return sum + parseFloat(session.completionRate || 0);
        }, 0);
        avgCompletionRate = (totalRate / sessions.length).toFixed(1);
    }
    
    const avgCompletionEl = document.getElementById('avg-completion-rate');
    if (avgCompletionEl) {
        avgCompletionEl.textContent = avgCompletionRate + '%';
    }
    
    const completionBar = document.getElementById('completion-bar');
    if (completionBar) {
        completionBar.style.width = avgCompletionRate + '%';
    }
    
    // 추세 지표 업데이트
    const trendIndicator = document.getElementById('participant-trend');
    if (trendIndicator && sessions.length > 1) {
        const lastSession = sessions[sessions.length - 1];
        const prevSession = sessions[sessions.length - 2];
        const diff = lastSession.totalParticipants - prevSession.totalParticipants;
        
        if (diff > 0) {
            trendIndicator.textContent = `+${diff} ↑`;
            trendIndicator.className = 'trend-indicator';
        } else if (diff < 0) {
            trendIndicator.textContent = `${diff} ↓`;
            trendIndicator.className = 'trend-indicator down';
        } else {
            trendIndicator.textContent = '━';
            trendIndicator.className = 'trend-indicator';
        }
    }
    
    // 차트 업데이트
    updateCumulativeCharts(sessions, currentResponses);
    
    // 문항별 통계 테이블 업데이트
    updateQuestionsStatsTable(sessions, currentResponses);
    
    // 세션 목록 업데이트
    updateSessionsList(sessions);
    
    // 추세 인사이트 업데이트
    updateTrendInsights(sessions, currentResponses);
}

// 누적 차트 업데이트
function updateCumulativeCharts(sessions, currentResponses) {
    // 전체 개요 차트
    if (overallChart) {
        const completed = sessions.filter(s => parseFloat(s.completionRate) === 100).length;
        const inProgress = currentResponses && Object.keys(currentResponses).length > 0 ? 1 : 0;
        const notStarted = Math.max(0, 10 - completed - inProgress); // 예상 세션 수 10개 기준
        
        overallChart.data.datasets[0].data = [completed, inProgress, notStarted];
        overallChart.update();
    }
    
    // 문항별 응답 차트
    if (questionsResponseChart) {
        const questionStats = {};
        for (let i = 1; i <= 15; i++) {
            questionStats[i] = 0;
        }
        
        // 현재 세션 데이터
        Object.entries(currentResponses).forEach(([qNum, responses]) => {
            questionStats[qNum] = Object.keys(responses).length;
        });
        
        // 과거 세션 데이터
        sessions.forEach(session => {
            if (session.responses) {
                Object.entries(session.responses).forEach(([qNum, responses]) => {
                    questionStats[qNum] += Object.keys(responses).length;
                });
            }
        });
        
        questionsResponseChart.data.labels = Object.keys(questionStats).map(q => `문제 ${q}`);
        questionsResponseChart.data.datasets[0].data = Object.values(questionStats);
        questionsResponseChart.update();
    }
    
    // 세션별 비교 차트
    if (sessionsComparisonChart && sessions.length > 0) {
        const labels = sessions.map(s => new Date(s.timestamp).toLocaleDateString('ko-KR'));
        const participants = sessions.map(s => s.totalParticipants);
        const completionRates = sessions.map(s => parseFloat(s.completionRate || 0));
        
        sessionsComparisonChart.data.labels = labels;
        sessionsComparisonChart.data.datasets[0].data = participants;
        sessionsComparisonChart.data.datasets[1].data = completionRates;
        sessionsComparisonChart.update();
    }
    
    // 추세 차트
    if (trendsChart) {
        let cumulativeData = [];
        let cumulative = 0;
        
        sessions.forEach((session, index) => {
            cumulative += session.totalParticipants;
            cumulativeData.push(cumulative);
        });
        
        trendsChart.data.labels = sessions.map((s, i) => `세션 ${i + 1}`);
        trendsChart.data.datasets[0].data = cumulativeData;
        trendsChart.update();
    }
}

// 문항별 통계 테이블 업데이트
function updateQuestionsStatsTable(sessions, currentResponses) {
    const tbody = document.getElementById('questions-stats-body');
    if (!tbody) return;
    
    const questions = APP_STATE.questions || [];
    let html = '';
    
    questions.forEach((question, index) => {
        const qNum = index + 1;
        let totalResponses = 0;
        let responseRates = [];
        let mostCommonAnswer = '-';
        const answerCounts = {};
        
        // 현재 세션 데이터
        if (currentResponses[qNum]) {
            const responses = currentResponses[qNum];
            totalResponses += Object.keys(responses).length;
            
            Object.values(responses).forEach(r => {
                answerCounts[r.answer] = (answerCounts[r.answer] || 0) + 1;
            });
        }
        
        // 과거 세션 데이터
        sessions.forEach(session => {
            if (session.responses && session.responses[qNum]) {
                const responses = session.responses[qNum];
                totalResponses += Object.keys(responses).length;
                
                Object.values(responses).forEach(r => {
                    answerCounts[r.answer] = (answerCounts[r.answer] || 0) + 1;
                });
            }
        });
        
        // 가장 많은 답변 찾기
        if (Object.keys(answerCounts).length > 0) {
            mostCommonAnswer = Object.entries(answerCounts)
                .sort((a, b) => b[1] - a[1])[0][0];
        }
        
        // 응답률 계산
        const totalPossible = sessions.reduce((sum, s) => sum + s.totalParticipants, 0) + 
                             (currentResponses[qNum] ? Object.keys(currentResponses[qNum]).length : 0);
        const responseRate = totalPossible > 0 ? ((totalResponses / totalPossible) * 100).toFixed(1) : 0;
        
        html += `
            <tr>
                <td>문제 ${qNum}</td>
                <td>${totalResponses}</td>
                <td>${responseRate}%</td>
                <td>-</td>
                <td>${mostCommonAnswer.substring(0, 20)}${mostCommonAnswer.length > 20 ? '...' : ''}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// 세션 목록 업데이트
function updateSessionsList(sessions) {
    const container = document.getElementById('sessions-list');
    if (!container) return;
    
    let html = '';
    sessions.slice(-5).reverse().forEach((session, index) => {
        html += `
            <div class="session-item">
                <div class="session-date">${session.date}</div>
                <div class="session-stats">
                    <span class="session-stat">참여: ${session.totalParticipants}명</span>
                    <span class="session-stat">응답: ${session.totalResponses}개</span>
                    <span class="session-stat">완료율: ${session.completionRate}%</span>
                </div>
            </div>
        `;
    });
    
    if (sessions.length === 0) {
        html = '<p style="text-align: center; color: #7F8C8D;">아직 완료된 세션이 없습니다.</p>';
    }
    
    container.innerHTML = html;
}

// 추세 인사이트 업데이트
function updateTrendInsights(sessions, currentResponses) {
    const insights = document.getElementById('trend-insights-list');
    if (!insights) return;
    
    let insightsList = [];
    
    // 참여율 추세
    if (sessions.length > 1) {
        const recentAvg = sessions.slice(-3).reduce((sum, s) => sum + s.totalParticipants, 0) / 3;
        const overallAvg = sessions.reduce((sum, s) => sum + s.totalParticipants, 0) / sessions.length;
        
        if (recentAvg > overallAvg * 1.2) {
            insightsList.push('최근 참여율이 상승 추세입니다 (20% 이상 증가)');
        } else if (recentAvg < overallAvg * 0.8) {
            insightsList.push('최근 참여율이 하락 추세입니다 (20% 이상 감소)');
        }
    }
    
    // 완료율 추세
    if (sessions.length > 0) {
        const avgCompletion = sessions.reduce((sum, s) => sum + parseFloat(s.completionRate || 0), 0) / sessions.length;
        if (avgCompletion > 80) {
            insightsList.push(`평균 완료율이 ${avgCompletion.toFixed(1)}%로 매우 높습니다`);
        } else if (avgCompletion < 50) {
            insightsList.push(`평균 완료율이 ${avgCompletion.toFixed(1)}%로 개선이 필요합니다`);
        }
    }
    
    // 가장 인기 있는 문항
    const questionStats = {};
    Object.entries(currentResponses).forEach(([qNum, responses]) => {
        questionStats[qNum] = Object.keys(responses).length;
    });
    
    if (Object.keys(questionStats).length > 0) {
        const mostAnswered = Object.entries(questionStats)
            .sort((a, b) => b[1] - a[1])[0];
        insightsList.push(`문제 ${mostAnswered[0]}번이 가장 많은 응답을 받았습니다 (${mostAnswered[1]}명)`);
    }
    
    // 세션 간격
    if (sessions.length > 1) {
        const intervals = [];
        for (let i = 1; i < sessions.length; i++) {
            intervals.push(sessions[i].timestamp - sessions[i-1].timestamp);
        }
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const days = Math.floor(avgInterval / (1000 * 60 * 60 * 24));
        insightsList.push(`평균 설문 실시 간격: ${days}일`);
    }
    
    if (insightsList.length === 0) {
        insightsList.push('더 많은 데이터가 쌓이면 추세 분석이 가능합니다');
    }
    
    insights.innerHTML = insightsList.map(insight => `<li>${insight}</li>`).join('');
}

// 전체 문제 결과 업데이트
function updateAllQuestionsResults(questions, responses) {
    const tabsContainer = document.getElementById('questions-tabs');
    const resultsContainer = document.getElementById('all-results');
    
    if (!tabsContainer || !resultsContainer) return;
    
    // 탭 생성
    let tabsHTML = '';
    questions.forEach((q, index) => {
        const qNum = index + 1;
        const responseCount = responses[qNum] ? Object.keys(responses[qNum]).length : 0;
        tabsHTML += `
            <div class="question-tab ${qNum === 1 ? 'active' : ''}" data-question="${qNum}">
                문제 ${qNum} (${responseCount})
            </div>
        `;
    });
    tabsContainer.innerHTML = tabsHTML;
    
    // 결과 카드 생성
    let cardsHTML = '';
    questions.forEach((question, index) => {
        const qNum = index + 1;
        const qResponses = responses[qNum] || {};
        const total = Object.keys(qResponses).length;
        
        let resultHTML = '';
        
        if (question.type === 'multiple') {
            const counts = {};
            question.options.forEach(option => { counts[option] = 0; });
            
            Object.values(qResponses).forEach(response => {
                if (counts.hasOwnProperty(response.answer)) {
                    counts[response.answer]++;
                }
            });
            
            Object.entries(counts).forEach(([option, count]) => {
                const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
                resultHTML += `
                    <div class="result-bar">
                        <span class="option-name">${option}</span>
                        <span class="option-count">${count}명</span>
                        <span class="option-percent">${percentage}%</span>
                    </div>
                `;
            });
        } else {
            // 텍스트 답변
            const textAnswers = Object.values(qResponses).map(r => r.answer);
            const uniqueAnswers = [...new Set(textAnswers)];
            
            uniqueAnswers.slice(0, 5).forEach(answer => {
                const count = textAnswers.filter(a => a === answer).length;
                resultHTML += `
                    <div class="result-bar">
                        <span class="option-name">"${answer}"</span>
                        <span class="option-count">${count}명</span>
                    </div>
                `;
            });
            
            if (uniqueAnswers.length > 5) {
                resultHTML += `
                    <div class="result-bar">
                        <span class="option-name">외 ${uniqueAnswers.length - 5}개 답변...</span>
                    </div>
                `;
            }
        }
        
        cardsHTML += `
            <div class="question-result-card">
                <h4>문제 ${qNum}: ${question.question}</h4>
                <div class="response-info">응답: ${total}명</div>
                ${resultHTML}
            </div>
        `;
    });
    
    resultsContainer.innerHTML = cardsHTML;
    
    // 탭 클릭 이벤트
    document.querySelectorAll('.question-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.question-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            const qNum = parseInt(this.dataset.question);
            // 특정 문제로 스크롤 (필요시)
            const targetCard = document.querySelectorAll('.question-result-card')[qNum - 1];
            if (targetCard) {
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    });
}

// 탭 전환 함수
function showCumulativeTab(tabName) {
    // 모든 탭 버튼과 컨텐츠 비활성화
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // 선택된 탭 활성화
    document.querySelector(`.tab-btn[data-tab="${tabName}"]`)?.classList.add('active');
    document.getElementById(`${tabName}-tab`)?.classList.add('active');
    
    // 차트 다시 그리기 (탭 전환 시 차트 크기 문제 해결)
    setTimeout(() => {
        if (tabName === 'overall' && overallChart) overallChart.update();
        if (tabName === 'questions' && questionsResponseChart) questionsResponseChart.update();
        if (tabName === 'sessions' && sessionsComparisonChart) sessionsComparisonChart.update();
        if (tabName === 'trends' && trendsChart) trendsChart.update();
    }, 100);
}