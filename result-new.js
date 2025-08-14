// 청년부 수련회 퀴즈 시스템 - 결과 JavaScript
// 60문제 실시간 결과 표시

// 전역 상태 관리
const RESULT_STATE = {
    surveyStatus: 'waiting',
    currentSession: 0,
    currentQuestion: 0,
    totalQuestions: 60,
    participants: [],
    responses: {},
    questions: [],
    quizData: null,
    autoRefresh: true,
    refreshInterval: null,
    charts: {},
    lastUpdateTime: null
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

// 실시간 업데이트 처리
function handleRealtimeUpdate(event) {
    // 즉시 상태 업데이트
    loadCurrentState();
}

// Storage 변경 감지 (다른 탭/창에서의 변경)
function handleStorageChange(event) {
    if (event.key === STORAGE_KEYS.RESPONSES || 
        event.key === STORAGE_KEYS.SURVEY_STATE ||
        event.key === STORAGE_KEYS.PARTICIPANTS) {
        loadCurrentState();
    }
}

// 퀴즈 데이터 로드
async function loadQuizData() {
    try {
        const response = await fetch('quiz-data-60.json');
        RESULT_STATE.quizData = await response.json();
        
        // 질문 배열 생성
        RESULT_STATE.questions = [];
        RESULT_STATE.quizData.sessions.forEach(session => {
            session.questions.forEach(q => {
                RESULT_STATE.questions.push({
                    ...q,
                    session_number: session.session_number,
                    session_name: session.session_name
                });
            });
        });
        
        RESULT_STATE.totalQuestions = RESULT_STATE.questions.length;
        localStorage.setItem(STORAGE_KEYS.QUIZ_DATA, JSON.stringify(RESULT_STATE.quizData));
        return true;
    } catch (error) {
        console.error('퀴즈 데이터 로드 실패:', error);
        const backupData = localStorage.getItem(STORAGE_KEYS.QUIZ_DATA);
        if (backupData) {
            RESULT_STATE.quizData = JSON.parse(backupData);
            // 질문 배열 재생성
            RESULT_STATE.questions = [];
            RESULT_STATE.quizData.sessions.forEach(session => {
                session.questions.forEach(q => {
                    RESULT_STATE.questions.push({
                        ...q,
                        session_number: session.session_number,
                        session_name: session.session_name
                    });
                });
            });
            RESULT_STATE.totalQuestions = RESULT_STATE.questions.length;
            return true;
        }
        return false;
    }
}

// 결과 화면 초기화
function initResultScreen() {
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
        
        // 차트 초기화
        initializeCharts();
        
        // 자동 새로고침 시작
        startAutoRefresh();
        
        // 실시간 업데이트 리스너
        window.addEventListener('responseUpdated', handleRealtimeUpdate);
        window.addEventListener('storage', handleStorageChange);
    });
}

// UI 초기화
function initializeUI() {
    // 자동 새로고침 토글
    document.getElementById('toggle-auto-refresh').addEventListener('click', toggleAutoRefresh);
    
    // 내보내기 버튼
    document.getElementById('export-csv').addEventListener('click', exportCSV);
    document.getElementById('export-json').addEventListener('click', exportJSON);
    document.getElementById('export-pdf').addEventListener('click', exportPDF);
    document.getElementById('print-results').addEventListener('click', printResults);
    
    // 세션 탭
    document.querySelectorAll('.session-tabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.session-tabs .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            this.classList.add('active');
            const tabId = `${this.dataset.tab}-tab`;
            const tabContent = document.getElementById(tabId);
            if (tabContent) {
                tabContent.classList.add('active');
            }
            
            // 세션별 결과 로드
            if (this.dataset.tab !== 'overview') {
                const sessionNum = parseInt(this.dataset.tab.replace('session', ''));
                loadSessionResults(sessionNum);
            } else {
                loadOverview();
            }
        });
    });
}

// 현재 상태 로드
function loadCurrentState() {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEYS.SURVEY_STATE) || '{}');
    const participants = JSON.parse(localStorage.getItem(STORAGE_KEYS.PARTICIPANTS) || '[]');
    const responses = JSON.parse(localStorage.getItem(STORAGE_KEYS.RESPONSES) || '{}');
    
    RESULT_STATE.surveyStatus = state.status || 'waiting';
    RESULT_STATE.currentSession = state.currentSession || 0;
    RESULT_STATE.currentQuestion = state.currentQuestion || 0;
    RESULT_STATE.participants = participants;
    RESULT_STATE.responses = responses;
    
    updateSummaryCards();
    updateCurrentQuestion();
    updateStatistics();
    updateParticipantStats();
    updateAwardsResults();
    loadOverview();
    
    // 마지막 업데이트 시간
    const now = new Date();
    document.getElementById('last-update-time').textContent = 
        `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    // 업데이트 애니메이션 효과
    const updateIndicator = document.querySelector('.live-indicator');
    if (updateIndicator) {
        updateIndicator.classList.add('pulse');
        setTimeout(() => updateIndicator.classList.remove('pulse'), 500);
    }
}

// 요약 카드 업데이트
function updateSummaryCards() {
    // 참여자 수
    document.getElementById('total-participants').textContent = RESULT_STATE.participants.length;
    
    // 현재 문제
    document.getElementById('current-question-result').textContent = 
        RESULT_STATE.currentQuestion || '-';
    
    // 응답률
    const currentResponses = RESULT_STATE.responses[RESULT_STATE.currentQuestion] || {};
    const responseCount = Object.keys(currentResponses).length;
    const responseRate = RESULT_STATE.participants.length > 0 ? 
        Math.round((responseCount / RESULT_STATE.participants.length) * 100) : 0;
    document.getElementById('response-rate').textContent = responseRate;
    
    // 진행 상태
    const statusText = {
        'waiting': '대기중',
        'active': '진행중',
        'finished': '완료'
    };
    document.getElementById('survey-status').textContent = statusText[RESULT_STATE.surveyStatus];
}

// 현재 문제 업데이트
function updateCurrentQuestion() {
    if (RESULT_STATE.currentQuestion === 0) {
        document.getElementById('current-question-text').textContent = '문제를 기다리는 중...';
        document.getElementById('question-number').textContent = 'Q-';
        document.getElementById('current-session').textContent = '-';
        return;
    }
    
    const question = RESULT_STATE.questions[RESULT_STATE.currentQuestion - 1];
    if (!question) return;
    
    // 문제 정보
    document.getElementById('current-question-text').textContent = question.question_text;
    document.getElementById('question-number').textContent = `Q${question.question_number}`;
    document.getElementById('current-session').textContent = `세션 ${question.session_number}: ${question.session_name}`;
    
    // 응답 수
    const currentResponses = RESULT_STATE.responses[RESULT_STATE.currentQuestion] || {};
    const responseCount = Object.keys(currentResponses).length;
    document.getElementById('current-responses').textContent = responseCount;
    document.getElementById('total-participants-count').textContent = RESULT_STATE.participants.length;
    
    // 차트 업데이트
    updateCurrentQuestionChart(question, currentResponses);
    
    // 옵션별 결과
    updateOptionsResults(question, currentResponses);
}

// 현재 문제 차트 업데이트
function updateCurrentQuestionChart(question, responses) {
    const chart = RESULT_STATE.charts.currentQuestion;
    if (!chart) return;
    
    // 데이터 집계
    const responseData = aggregateResponses(question, responses);
    
    // 차트 타입 변경
    const chartType = getChartType(question.chart_type);
    if (chart.config.type !== chartType) {
        chart.config.type = chartType;
    }
    
    // 데이터 업데이트
    chart.data.labels = Object.keys(responseData);
    chart.data.datasets[0].data = Object.values(responseData);
    
    // 색상 업데이트
    if (chartType === 'pie' || chartType === 'doughnut') {
        const colors = generateColors(Object.keys(responseData).length);
        chart.data.datasets[0].backgroundColor = colors;
        chart.data.datasets[0].borderColor = colors;
    }
    
    chart.update();
}

// 응답 데이터 집계
function aggregateResponses(question, responses) {
    const responseData = {};
    
    if (question.question_type === 'text') {
        // 텍스트 답변
        Object.values(responses).forEach(r => {
            const answer = r.answer_text || r.answer || '-';
            responseData[answer] = (responseData[answer] || 0) + 1;
        });
    } else if (question.question_type === 'slider') {
        // 슬라이더 답변을 구간별로 집계
        const min = question.constraints?.min_value || 0;
        const max = question.constraints?.max_value || 100;
        const step = Math.ceil((max - min) / 10);
        
        for (let i = min; i <= max; i += step) {
            responseData[`${i}-${Math.min(i + step - 1, max)}`] = 0;
        }
        
        Object.values(responses).forEach(r => {
            const value = r.answer_number || 0;
            const bucket = Math.floor((value - min) / step) * step + min;
            const key = `${bucket}-${Math.min(bucket + step - 1, max)}`;
            if (responseData[key] !== undefined) {
                responseData[key]++;
            }
        });
    } else if (question.options && Array.isArray(question.options)) {
        // 옵션이 있는 경우
        question.options.forEach(option => {
            responseData[option] = 0;
        });
        
        Object.values(responses).forEach(r => {
            if (r.answer_options) {
                // 복수 선택
                r.answer_options.forEach(answer => {
                    if (responseData[answer] !== undefined) {
                        responseData[answer]++;
                    }
                });
            } else {
                // 단일 선택
                const answer = r.answer_text || r.answer || r.answer_emoji;
                if (answer && responseData[answer] !== undefined) {
                    responseData[answer]++;
                }
            }
        });
    } else {
        // 동적 참여자 목록 등
        Object.values(responses).forEach(r => {
            const answer = r.answer_text || r.answer || '-';
            responseData[answer] = (responseData[answer] || 0) + 1;
        });
    }
    
    return responseData;
}

// 옵션별 결과 표시
function updateOptionsResults(question, responses) {
    const container = document.getElementById('options-results');
    container.innerHTML = '';
    
    const responseData = aggregateResponses(question, responses);
    const sorted = Object.entries(responseData).sort((a, b) => b[1] - a[1]);
    
    sorted.forEach(([option, count]) => {
        const percentage = RESULT_STATE.participants.length > 0 ? 
            Math.round((count / RESULT_STATE.participants.length) * 100) : 0;
        
        const item = document.createElement('div');
        item.className = 'option-result-item';
        item.innerHTML = `
            <div class="option-label">${option}</div>
            <div class="option-bar">
                <div class="option-bar-fill" style="width: ${percentage}%"></div>
            </div>
            <div class="option-stats">
                <span class="option-count">${count}명</span>
                <span class="option-percentage">${percentage}%</span>
            </div>
        `;
        container.appendChild(item);
    });
}

// 통계 업데이트
function updateStatistics() {
    // 가장 인기 있는 답변
    let mostPopular = { question: '', answer: '', count: 0 };
    
    Object.entries(RESULT_STATE.responses).forEach(([qNum, responses]) => {
        const question = RESULT_STATE.questions[qNum - 1];
        if (!question) return;
        
        const aggregated = aggregateResponses(question, responses);
        Object.entries(aggregated).forEach(([answer, count]) => {
            if (count > mostPopular.count) {
                mostPopular = {
                    question: question.question_text,
                    answer: answer,
                    count: count
                };
            }
        });
    });
    
    const mostSelectedEl = document.getElementById('most-selected');
    if (mostPopular.count > 0) {
        mostSelectedEl.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">${mostPopular.answer}</span>
                <span class="stat-value">${mostPopular.count}명</span>
            </div>
        `;
    }
    
    // 평균 응답 시간
    let totalTime = 0;
    let timeCount = 0;
    
    Object.values(RESULT_STATE.responses).forEach(questionResponses => {
        Object.values(questionResponses).forEach(response => {
            if (response.response_time_ms) {
                totalTime += response.response_time_ms;
                timeCount++;
            }
        });
    });
    
    const avgTime = timeCount > 0 ? (totalTime / timeCount / 1000).toFixed(1) : '-';
    document.querySelector('#avg-response-time .big-stat').textContent = avgTime;
    
    // 완료된 문제
    const completedQuestions = Object.keys(RESULT_STATE.responses).filter(qNum => {
        const responses = RESULT_STATE.responses[qNum];
        return Object.keys(responses).length > 0;
    }).length;
    
    document.querySelector('#completed-questions .big-stat').textContent = completedQuestions;
    
    // 세션별 참여율 차트 업데이트
    updateParticipationTrend();
}

// 세션별 참여율 차트
function updateParticipationTrend() {
    const chart = RESULT_STATE.charts.participationTrend;
    if (!chart) return;
    
    const sessionData = SESSIONS.map(session => {
        let totalResponses = 0;
        let totalPossible = 0;
        
        RESULT_STATE.questions.forEach(q => {
            if (q.session_number === session.number) {
                const responses = RESULT_STATE.responses[q.question_number] || {};
                totalResponses += Object.keys(responses).length;
                totalPossible += RESULT_STATE.participants.length;
            }
        });
        
        return totalPossible > 0 ? Math.round((totalResponses / totalPossible) * 100) : 0;
    });
    
    chart.data.labels = SESSIONS.map(s => `세션${s.number}`);
    chart.data.datasets[0].data = sessionData;
    chart.update();
}

// 참여자별 통계
function updateParticipantStats() {
    const container = document.getElementById('participant-stats-grid');
    container.innerHTML = '';
    
    RESULT_STATE.participants.forEach(participant => {
        let answeredCount = 0;
        let totalTime = 0;
        let timeCount = 0;
        
        Object.entries(RESULT_STATE.responses).forEach(([qNum, responses]) => {
            if (responses[participant.userId]) {
                answeredCount++;
                if (responses[participant.userId].response_time_ms) {
                    totalTime += responses[participant.userId].response_time_ms;
                    timeCount++;
                }
            }
        });
        
        const avgTime = timeCount > 0 ? (totalTime / timeCount / 1000).toFixed(1) : '-';
        const completionRate = Math.round((answeredCount / RESULT_STATE.totalQuestions) * 100);
        
        const card = document.createElement('div');
        card.className = 'participant-stat-card';
        card.innerHTML = `
            <div class="participant-header">
                <div class="participant-avatar" style="background: ${participant.color}">
                    ${participant.nickname.substring(0, 2)}
                </div>
                <div class="participant-name">${participant.nickname}</div>
            </div>
            <div class="participant-stats">
                <div class="stat">
                    <span class="stat-label">답변</span>
                    <span class="stat-value">${answeredCount}/${RESULT_STATE.totalQuestions}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">완료율</span>
                    <span class="stat-value">${completionRate}%</span>
                </div>
                <div class="stat">
                    <span class="stat-label">평균시간</span>
                    <span class="stat-value">${avgTime}초</span>
                </div>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${completionRate}%"></div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// 어워즈 결과 업데이트
function updateAwardsResults() {
    const container = document.getElementById('awards-grid');
    container.innerHTML = '';
    
    // 세션 4의 어워즈 문제들 (21-30번)
    const awardQuestions = RESULT_STATE.questions.filter(q => q.session_number === 4);
    
    awardQuestions.forEach(question => {
        const responses = RESULT_STATE.responses[question.question_number] || {};
        const aggregated = aggregateResponses(question, responses);
        
        // 상위 3명 추출
        const sorted = Object.entries(aggregated).sort((a, b) => b[1] - a[1]).slice(0, 3);
        
        if (sorted.length > 0) {
            const card = document.createElement('div');
            card.className = 'award-card';
            card.innerHTML = `
                <h4>${question.question_text}</h4>
                <div class="award-winners">
                    ${sorted.map(([name, count], index) => `
                        <div class="winner winner-${index + 1}">
                            <span class="winner-rank">${index + 1}</span>
                            <span class="winner-name">${name}</span>
                            <span class="winner-votes">${count}표</span>
                        </div>
                    `).join('')}
                </div>
            `;
            container.appendChild(card);
        }
    });
}

// 세션별 결과 로드
function loadSessionResults(sessionNum) {
    const container = document.querySelector(`#session${sessionNum}-tab .session-questions-grid`);
    if (!container) return;
    
    container.innerHTML = '';
    
    const sessionQuestions = RESULT_STATE.questions.filter(q => q.session_number === sessionNum);
    
    sessionQuestions.forEach(question => {
        const responses = RESULT_STATE.responses[question.question_number] || {};
        const responseCount = Object.keys(responses).length;
        
        const card = document.createElement('div');
        card.className = 'question-result-card';
        card.innerHTML = `
            <div class="question-header">
                <span class="question-number">Q${question.question_number}</span>
                <span class="response-count">${responseCount}명 응답</span>
            </div>
            <h4>${question.question_text}</h4>
            <div class="mini-chart" id="chart-q${question.question_number}"></div>
        `;
        
        container.appendChild(card);
        
        // 미니 차트 생성
        setTimeout(() => {
            createMiniChart(`chart-q${question.question_number}`, question, responses);
        }, 100);
    });
}

// 미니 차트 생성
function createMiniChart(elementId, question, responses) {
    const canvas = document.getElementById(elementId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const responseData = aggregateResponses(question, responses);
    
    new Chart(ctx, {
        type: getChartType(question.chart_type),
        data: {
            labels: Object.keys(responseData).slice(0, 5),
            datasets: [{
                data: Object.values(responseData).slice(0, 5),
                backgroundColor: generateColors(5)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    display: false
                },
                x: {
                    display: false
                }
            }
        }
    });
}

// 전체 개요 로드
function loadOverview() {
    const container = document.querySelector('#overview-tab .overview-grid');
    if (!container) return;
    
    container.innerHTML = '';
    
    SESSIONS.forEach(session => {
        const sessionQuestions = RESULT_STATE.questions.filter(q => q.session_number === session.number);
        let totalResponses = 0;
        let totalPossible = 0;
        
        sessionQuestions.forEach(q => {
            const responses = RESULT_STATE.responses[q.question_number] || {};
            totalResponses += Object.keys(responses).length;
            totalPossible += RESULT_STATE.participants.length;
        });
        
        const completionRate = totalPossible > 0 ? 
            Math.round((totalResponses / totalPossible) * 100) : 0;
        
        const card = document.createElement('div');
        card.className = 'overview-card';
        card.innerHTML = `
            <h4>세션 ${session.number}</h4>
            <p>${session.name}</p>
            <div class="session-stats">
                <span>${session.questions}문제</span>
                <span>${completionRate}% 완료</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${completionRate}%"></div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// 참여자 버블 업데이트
function updateParticipantsBubbles() {
    const container = document.getElementById('participants-bar');
    if (!container) return;
    
    container.innerHTML = '';
    
    RESULT_STATE.participants.forEach(participant => {
        const bubble = document.createElement('div');
        bubble.className = `participant-bubble ${participant.gender}`;
        bubble.style.backgroundColor = participant.color;
        
        const answeredCount = Object.keys(RESULT_STATE.responses).filter(qNum => {
            return RESULT_STATE.responses[qNum] && RESULT_STATE.responses[qNum][participant.userId];
        }).length;
        
        if (answeredCount === RESULT_STATE.totalQuestions) {
            bubble.classList.add('completed');
        }
        
        bubble.innerHTML = `<span class="bubble-name">${participant.nickname.substring(0, 2)}</span>`;
        bubble.title = `${participant.nickname} (${answeredCount}/${RESULT_STATE.totalQuestions})`;
        
        container.appendChild(bubble);
    });
    
    // 참여자 수 표시
    const countEl = document.createElement('div');
    countEl.className = 'participant-count';
    countEl.textContent = `${RESULT_STATE.participants.length}명`;
    container.appendChild(countEl);
}

// 차트 초기화
function initializeCharts() {
    // 현재 문제 차트
    const currentCtx = document.getElementById('current-question-chart');
    if (currentCtx) {
        RESULT_STATE.charts.currentQuestion = new Chart(currentCtx, {
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
    
    // 참여율 추세 차트
    const trendCtx = document.getElementById('participation-trend');
    if (trendCtx) {
        RESULT_STATE.charts.participationTrend = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: '참여율 (%)',
                    data: [],
                    borderColor: 'rgba(37, 99, 235, 1)',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }
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

// 자동 새로고침 토글
function toggleAutoRefresh() {
    RESULT_STATE.autoRefresh = !RESULT_STATE.autoRefresh;
    const btn = document.getElementById('toggle-auto-refresh');
    
    if (RESULT_STATE.autoRefresh) {
        btn.textContent = '자동 새로고침 ON';
        btn.classList.add('active');
        startAutoRefresh();
    } else {
        btn.textContent = '자동 새로고침 OFF';
        btn.classList.remove('active');
        stopAutoRefresh();
    }
}

// 자동 새로고침 시작
function startAutoRefresh() {
    if (RESULT_STATE.refreshInterval) {
        clearInterval(RESULT_STATE.refreshInterval);
    }
    
    RESULT_STATE.refreshInterval = setInterval(() => {
        if (RESULT_STATE.autoRefresh) {
            loadCurrentState();
        }
    }, 1000); // 1초마다 새로고침 (더 빠른 업데이트)
}

// 자동 새로고침 중지
function stopAutoRefresh() {
    if (RESULT_STATE.refreshInterval) {
        clearInterval(RESULT_STATE.refreshInterval);
        RESULT_STATE.refreshInterval = null;
    }
}

// CSV 내보내기
function exportCSV() {
    let csv = 'Question Number,Session,Question,Participant,Answer,Response Time(ms)\n';
    
    Object.entries(RESULT_STATE.responses).forEach(([qNum, responses]) => {
        const question = RESULT_STATE.questions[qNum - 1];
        if (!question) return;
        
        Object.entries(responses).forEach(([userId, response]) => {
            const participant = RESULT_STATE.participants.find(p => p.userId === userId);
            const answer = response.answer_text || response.answer || 
                          (response.answer_options && response.answer_options.join(', ')) || 
                          response.answer_number || response.answer_emoji || '-';
            
            csv += `${qNum},"${question.session_name}","${question.question_text}","${participant?.nickname || userId}","${answer}",${response.response_time_ms || ''}\n`;
        });
    });
    
    downloadFile('quiz_results.csv', csv, 'text/csv');
}

// JSON 내보내기
function exportJSON() {
    const data = {
        exportDate: new Date().toISOString(),
        participants: RESULT_STATE.participants,
        questions: RESULT_STATE.questions,
        responses: RESULT_STATE.responses,
        statistics: {
            totalParticipants: RESULT_STATE.participants.length,
            totalQuestions: RESULT_STATE.totalQuestions,
            completedQuestions: Object.keys(RESULT_STATE.responses).length
        }
    };
    
    downloadFile('quiz_results.json', JSON.stringify(data, null, 2), 'application/json');
}

// PDF 내보내기 (간단한 구현)
function exportPDF() {
    alert('PDF 내보내기 기능은 별도의 라이브러리가 필요합니다.\n대신 인쇄 기능을 사용해주세요.');
}

// 인쇄
function printResults() {
    window.print();
}

// 파일 다운로드
function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 페이지 언로드시 정리
window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
    window.removeEventListener('responseUpdated', handleRealtimeUpdate);
    window.removeEventListener('storage', handleStorageChange);
});

// 전역 함수로 내보내기
window.initResultScreen = initResultScreen;