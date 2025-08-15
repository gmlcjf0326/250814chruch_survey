// ===================================================
// 통합 동기화 관리자
// ===================================================

const SyncManager = {
    DEBUG: true,
    pageType: null, // 'user', 'admin', 'result'
    lastState: null,
    syncInterval: null,
    
    // 로깅
    log: function(message, data = null) {
        if (this.DEBUG) {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] [SyncManager] ${message}`, data || '');
        }
    },
    
    // 초기화
    init: async function(pageType) {
        this.log(`초기화 시작 - ${pageType} 페이지`);
        this.pageType = pageType;
        
        // 1. Supabase 실시간 동기화 초기화
        if (typeof SupabaseRealtime !== 'undefined') {
            const connected = await SupabaseRealtime.init();
            this.log(`Supabase 연결 상태: ${connected}`);
        }
        
        // 2. 세션 관리자 초기화
        if (typeof SessionManager !== 'undefined') {
            SessionManager.init();
        }
        
        // 3. 이벤트 리스너 설정
        this.setupEventListeners();
        
        // 4. 주기적 동기화 시작 (fallback)
        this.startPeriodicSync();
        
        // 5. 초기 상태 체크
        this.checkStateUpdate();
        
        this.log('초기화 완료');
    },
    
    // 이벤트 리스너 설정
    setupEventListeners: function() {
        // Supabase 이벤트
        window.addEventListener('supabase:stateChanged', (event) => {
            this.log('Supabase 상태 변경 이벤트', event.detail);
            this.handleStateChange(event.detail.newState);
        });
        
        window.addEventListener('supabase:responseAdded', (event) => {
            this.log('Supabase 응답 추가 이벤트', event.detail);
            this.handleResponseAdded(event.detail);
        });
        
        window.addEventListener('supabase:participantChanged', (event) => {
            this.log('Supabase 참여자 변경 이벤트', event.detail);
            this.handleParticipantChanged(event.detail);
        });
        
        // Storage 이벤트 (크로스탭)
        window.addEventListener('storage', (event) => {
            if (event.key === 'survey_state' || event.key === 'quiz_data') {
                this.log('Storage 이벤트', event.key);
                this.checkStateUpdate();
            }
        });
        
        // 커스텀 이벤트
        window.addEventListener('responseUpdated', (event) => {
            this.log('응답 업데이트 이벤트', event.detail);
            if (typeof updateParticipantsBubbles === 'function') {
                updateParticipantsBubbles();
            }
        });
    },
    
    // 주기적 동기화 (fallback)
    startPeriodicSync: function() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        // 1초마다 상태 체크
        this.syncInterval = setInterval(() => {
            this.checkStateUpdate();
        }, 1000);
    },
    
    // 상태 업데이트 체크
    checkStateUpdate: function() {
        const currentState = this.getCurrentState();
        
        // 상태가 변경되었는지 확인
        if (JSON.stringify(currentState) !== JSON.stringify(this.lastState)) {
            this.log('상태 변경 감지', { 
                old: this.lastState, 
                new: currentState 
            });
            
            this.lastState = currentState;
            this.handleStateChange(currentState);
        }
        
        // 타이머 업데이트
        if (currentState.status === 'active' && currentState.timerEnd) {
            this.updateTimer(currentState.timerEnd);
        }
    },
    
    // 현재 상태 가져오기 (정규화)
    getCurrentState: function() {
        const state = JSON.parse(localStorage.getItem('survey_state') || '{}');
        
        return {
            status: state.status || 'waiting',
            currentQuestion: state.currentQuestion || state.current_question || 0,
            currentSession: state.currentSession || state.current_session || 0,
            timerEnd: state.timerEnd || (state.timer_end ? new Date(state.timer_end).getTime() : null),
            startTime: state.startTime || state.start_time,
            endTime: state.endTime || state.end_time
        };
    },
    
    // 상태 변경 처리
    handleStateChange: function(state) {
        this.log(`상태 변경 처리 - ${this.pageType}`, state);
        
        switch (this.pageType) {
            case 'user':
                this.handleUserStateChange(state);
                break;
            case 'admin':
                this.handleAdminStateChange(state);
                break;
            case 'result':
                this.handleResultStateChange(state);
                break;
        }
    },
    
    // 사용자 페이지 상태 변경
    handleUserStateChange: function(state) {
        // APP_STATE 확인
        if (typeof APP_STATE === 'undefined') {
            this.log('APP_STATE 없음');
            return;
        }
        
        // 사용자 정보 확인
        const userInfo = SessionManager ? SessionManager.getUserInfo() : 
                        (APP_STATE.userInfo || null);
        
        if (!userInfo || !userInfo.registered) {
            this.log('미등록 사용자');
            return;
        }
        
        // 현재 화면
        const currentScreen = document.querySelector('.screen.active')?.id;
        
        // 제출 중이면 무시
        if (APP_STATE.isSubmitting) {
            this.log('제출 중 - 화면 전환 무시');
            return;
        }
        
        // 문제 번호 변경 확인
        const questionChanged = state.currentQuestion && 
                              state.currentQuestion !== APP_STATE.currentQuestion;
        
        if (questionChanged) {
            this.log(`문제 변경: ${APP_STATE.currentQuestion} → ${state.currentQuestion}`);
            
            // 응답 여부 확인
            const responses = JSON.parse(localStorage.getItem('survey_responses') || '{}');
            const hasAnswered = responses[state.currentQuestion] && 
                               responses[state.currentQuestion][userInfo.userId || userInfo.user_id];
            
            if (!hasAnswered && state.status === 'active') {
                // 새 문제 표시
                this.log('새 문제 표시');
                APP_STATE.currentQuestion = state.currentQuestion;
                APP_STATE.hasShownStats = false;
                
                if (typeof showQuestion === 'function') {
                    // 질문 데이터 가져오기
                    const quizData = JSON.parse(localStorage.getItem('quiz_data') || '{}');
                    let questionData = null;
                    
                    // 질문 찾기
                    if (quizData.sessions) {
                        for (const session of quizData.sessions) {
                            const question = session.questions.find(q => 
                                q.question_number === state.currentQuestion
                            );
                            if (question) {
                                questionData = question;
                                break;
                            }
                        }
                    }
                    
                    // 백업: APP_STATE.questions에서 찾기
                    if (!questionData && APP_STATE.questions) {
                        questionData = APP_STATE.questions[state.currentQuestion - 1];
                    }
                    
                    if (questionData) {
                        showQuestion(questionData, state.currentQuestion);
                    } else {
                        this.log('질문 데이터 없음', state.currentQuestion);
                    }
                }
            } else if (hasAnswered) {
                // 이미 답변한 문제 - 통계 표시
                this.log('이미 답변한 문제 - 통계 표시');
                APP_STATE.currentQuestion = state.currentQuestion;
                
                if (typeof showWaitingScreenWithStats === 'function') {
                    showWaitingScreenWithStats();
                }
            }
            
            return;
        }
        
        // 대기 상태
        if (state.status === 'waiting' || !state.currentQuestion) {
            if (currentScreen !== 'waiting-screen' && 
                currentScreen !== 'submitted-screen' && 
                currentScreen !== 'registration-screen') {
                this.log('대기 화면으로 전환');
                this.showWaitingScreen('퀴즈가 곧 시작됩니다', '관리자가 문제를 준비하고 있습니다...');
            }
        }
        
        // 종료 상태
        if (state.status === 'finished') {
            if (currentScreen !== 'final-screen' && typeof showFinalScreen === 'function') {
                this.log('종료 화면으로 전환');
                showFinalScreen();
            }
        }
    },
    
    // 관리자 페이지 상태 변경
    handleAdminStateChange: function(state) {
        this.log('관리자 상태 업데이트');
        
        // UI 업데이트
        if (typeof updateStatusDisplay === 'function') {
            updateStatusDisplay();
        }
        if (typeof updateControlButtons === 'function') {
            updateControlButtons();
        }
        if (typeof updateParticipantsBubbles === 'function') {
            updateParticipantsBubbles();
        }
        if (typeof updateRealTimeChart === 'function') {
            updateRealTimeChart();
        }
    },
    
    // 결과 페이지 상태 변경
    handleResultStateChange: function(state) {
        this.log('결과 페이지 업데이트');
        
        // 결과 업데이트
        if (typeof updateResults === 'function') {
            updateResults();
        }
    },
    
    // 응답 추가 처리
    handleResponseAdded: function(response) {
        this.log('응답 추가 처리', response);
        
        // UI 업데이트
        if (typeof updateParticipantsBubbles === 'function') {
            updateParticipantsBubbles();
        }
        if (typeof updateRealtimeStats === 'function') {
            updateRealtimeStats();
        }
        if (this.pageType === 'admin' && typeof updateRealTimeChart === 'function') {
            updateRealTimeChart();
        }
    },
    
    // 참여자 변경 처리
    handleParticipantChanged: function(participant) {
        this.log('참여자 변경 처리', participant);
        
        // UI 업데이트
        if (typeof updateParticipantsBubbles === 'function') {
            updateParticipantsBubbles();
        }
    },
    
    // 대기 화면 표시
    showWaitingScreen: function(title, message) {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(s => s.classList.remove('active'));
        
        const waitingScreen = document.getElementById('waiting-screen');
        if (waitingScreen) {
            waitingScreen.classList.add('active');
            
            const titleEl = waitingScreen.querySelector('h2');
            if (titleEl) titleEl.textContent = title;
            
            const messageEl = waitingScreen.querySelector('p');
            if (messageEl) messageEl.textContent = message;
        }
    },
    
    // 타이머 업데이트
    updateTimer: function(timerEnd) {
        const remaining = Math.max(0, Math.floor((timerEnd - Date.now()) / 1000));
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // 타이머 엘리먼트 업데이트
        const timerElements = document.querySelectorAll('#timer, #admin-timer, #timer-display');
        timerElements.forEach(el => {
            if (el) el.textContent = display;
        });
    },
    
    // 상태 업데이트 (관리자용)
    updateQuizState: async function(state) {
        this.log('퀴즈 상태 업데이트 요청', state);
        
        // Supabase 사용 가능한 경우
        if (typeof SupabaseRealtime !== 'undefined' && SupabaseRealtime.isConnected) {
            const result = await SupabaseRealtime.updateQuizState(state);
            this.log('Supabase 업데이트 결과', result);
            return result;
        }
        
        // localStorage만 사용
        localStorage.setItem('survey_state', JSON.stringify(state));
        
        // Storage 이벤트 강제 발생
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'survey_state',
            newValue: JSON.stringify(state),
            url: window.location.href
        }));
        
        return { success: true, local: true };
    },
    
    // 응답 저장
    saveResponse: async function(response) {
        this.log('응답 저장 요청', response);
        
        // Supabase 사용 가능한 경우
        if (typeof SupabaseRealtime !== 'undefined' && SupabaseRealtime.isConnected) {
            const result = await SupabaseRealtime.saveResponse(response);
            this.log('Supabase 응답 저장 결과', result);
            return result;
        }
        
        // localStorage만 사용
        const responses = JSON.parse(localStorage.getItem('survey_responses') || '{}');
        if (!responses[response.question_id]) {
            responses[response.question_id] = {};
        }
        responses[response.question_id][response.user_id] = response;
        localStorage.setItem('survey_responses', JSON.stringify(responses));
        
        return { success: true, local: true };
    },
    
    // 참여자 등록
    registerParticipant: async function(participant) {
        this.log('참여자 등록 요청', participant);
        
        // Supabase 사용 가능한 경우
        if (typeof SupabaseRealtime !== 'undefined' && SupabaseRealtime.isConnected) {
            const result = await SupabaseRealtime.registerParticipant(participant);
            this.log('Supabase 참여자 등록 결과', result);
            return result;
        }
        
        // localStorage만 사용
        const participants = JSON.parse(localStorage.getItem('survey_participants') || '[]');
        participants.push(participant);
        localStorage.setItem('survey_participants', JSON.stringify(participants));
        
        return { success: true, local: true };
    },
    
    // 정리
    cleanup: function() {
        this.log('정리 시작');
        
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        if (typeof SupabaseRealtime !== 'undefined') {
            SupabaseRealtime.cleanup();
        }
        
        this.log('정리 완료');
    }
};

// 전역으로 내보내기
window.SyncManager = SyncManager;

// 페이지 언로드시 정리
window.addEventListener('beforeunload', () => {
    SyncManager.cleanup();
});