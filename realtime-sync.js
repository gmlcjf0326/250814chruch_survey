// 실시간 동기화 모듈
// 모든 페이지에서 공통으로 사용

const RealtimeSync = {
    // 초기화
    init: function(pageType) {
        this.pageType = pageType; // 'user', 'admin', 'result'
        this.lastState = null;
        this.syncInterval = null;
        
        // Storage 이벤트 리스너
        window.addEventListener('storage', this.handleStorageChange.bind(this));
        
        // 주기적 동기화 (1초마다)
        this.startPeriodicSync();
        
        // 페이지별 초기화
        this.initializePage();
    },
    
    // 주기적 동기화 시작
    startPeriodicSync: function() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        this.syncInterval = setInterval(() => {
            this.checkStateUpdate();
        }, 1000); // 1초마다 체크
    },
    
    // Storage 변경 감지
    handleStorageChange: function(event) {
        if (event.key === 'survey_state' || 
            event.key === 'survey_responses' || 
            event.key === 'survey_participants') {
            this.checkStateUpdate();
        }
    },
    
    // 상태 업데이트 체크
    checkStateUpdate: function() {
        const currentState = JSON.parse(localStorage.getItem('survey_state') || '{}');
        
        // 상태가 변경되었는지 확인
        if (JSON.stringify(currentState) !== JSON.stringify(this.lastState)) {
            this.lastState = currentState;
            this.handleStateChange(currentState);
        }
        
        // 타이머 업데이트 (활성 상태일 때만)
        if (currentState.status === 'active' && currentState.timerEnd) {
            this.updateTimer(currentState.timerEnd);
        }
    },
    
    // 상태 변경 처리
    handleStateChange: function(state) {
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
    
    // 사용자 페이지 상태 변경 처리
    handleUserStateChange: function(state) {
        // APP_STATE가 있는지 확인
        if (typeof APP_STATE === 'undefined') return;
        
        // 등록된 사용자인지 확인
        if (!APP_STATE.userInfo || !APP_STATE.userInfo.registered) return;
        
        const currentScreen = document.querySelector('.screen.active')?.id;
        
        // 제출 중이면 화면 전환하지 않음
        if (APP_STATE.isSubmitting) {
            return;
        }
        
        // 사용자가 답변 중인 경우 화면 전환하지 않음
        if (currentScreen === 'question-screen') {
            // 현재 문제가 변경되었는지 확인
            if (APP_STATE.currentQuestion !== state.currentQuestion) {
                // 문제가 변경된 경우에만 처리
                const responses = JSON.parse(localStorage.getItem('survey_responses') || '{}');
                const hasAnswered = responses[state.currentQuestion] && 
                                   responses[state.currentQuestion][APP_STATE.userInfo.userId];
                
                if (!hasAnswered && state.status === 'active' && state.currentQuestion) {
                    // 새 문제로 전환
                    if (typeof displayQuestion === 'function') {
                        displayQuestion(state.currentQuestion);
                    }
                } else if (hasAnswered) {
                    // 이미 답변한 문제면 대기 화면으로
                    this.showWaitingScreen('답변 제출 완료!', '다음 문제를 기다리고 있습니다...');
                }
            }
            // 같은 문제를 보고 있는 중이면 화면 전환하지 않음
            return;
        }
        
        if (state.status === 'waiting' || !state.currentQuestion) {
            // 대기 상태
            if (currentScreen !== 'waiting-screen' && currentScreen !== 'submitted-screen') {
                this.showWaitingScreen('퀴즈가 곧 시작됩니다', '관리자가 문제를 준비하고 있습니다...');
            }
        } else if (state.status === 'active' && state.currentQuestion) {
            // 활성 상태 - 새 문제 확인
            const responses = JSON.parse(localStorage.getItem('survey_responses') || '{}');
            const hasAnswered = responses[state.currentQuestion] && 
                               responses[state.currentQuestion][APP_STATE.userInfo.userId];
            
            if (!hasAnswered && currentScreen !== 'question-screen' && currentScreen !== 'submitted-screen') {
                // 새 문제 표시
                if (typeof displayQuestion === 'function') {
                    displayQuestion(state.currentQuestion);
                } else if (typeof showQuestion === 'function') {
                    showQuestion(state.currentQuestion);
                }
            } else if (hasAnswered && currentScreen !== 'waiting-screen' && currentScreen !== 'submitted-screen') {
                // 답변 완료 - 대기 화면으로
                this.showWaitingScreen('답변 제출 완료!', '다음 문제를 기다리고 있습니다...');
            }
        } else if (state.status === 'finished') {
            // 종료
            if (currentScreen !== 'final-screen' && typeof showFinalScreen === 'function') {
                showFinalScreen();
            }
        }
    },
    
    // 관리자 페이지 상태 변경 처리
    handleAdminStateChange: function(state) {
        // 관리자 UI 업데이트
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
    
    // 결과 페이지 상태 변경 처리
    handleResultStateChange: function(state) {
        // 결과 페이지 업데이트
        if (typeof loadCurrentState === 'function') {
            loadCurrentState();
        }
    },
    
    // 대기 화면 표시
    showWaitingScreen: function(title, message) {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(s => s.classList.remove('active'));
        
        const waitingScreen = document.getElementById('waiting-screen');
        if (waitingScreen) {
            waitingScreen.classList.add('active');
            const h2 = waitingScreen.querySelector('h2');
            const p = waitingScreen.querySelector('p');
            if (h2) h2.textContent = title;
            if (p) p.textContent = message;
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
    
    // 페이지별 초기화
    initializePage: function() {
        // 초기 상태 체크
        this.checkStateUpdate();
        
        // 참여자 버블 업데이트
        if (typeof updateParticipantsBubbles === 'function') {
            updateParticipantsBubbles();
        }
    },
    
    // 정리
    cleanup: function() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        window.removeEventListener('storage', this.handleStorageChange);
    }
};

// 페이지 언로드시 정리
window.addEventListener('beforeunload', () => {
    RealtimeSync.cleanup();
});

// 전역으로 내보내기
window.RealtimeSync = RealtimeSync;