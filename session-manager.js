// ===================================================
// 세션 관리 모듈 (localStorage + 쿠키)
// ===================================================

const SessionManager = {
    DEBUG: true,
    
    // 로깅
    log: function(message, data = null) {
        if (this.DEBUG) {
            console.log(`[SessionManager] ${message}`, data || '');
        }
    },
    
    // 쿠키 설정
    setCookie: function(name, value, days = 7) {
        const expires = new Date();
        expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
        document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
        this.log(`쿠키 설정: ${name}`, value);
    },
    
    // 쿠키 가져오기
    getCookie: function(name) {
        const nameEQ = name + "=";
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) {
                const value = c.substring(nameEQ.length, c.length);
                this.log(`쿠키 읽기: ${name}`, value);
                return value;
            }
        }
        return null;
    },
    
    // 쿠키 삭제
    deleteCookie: function(name) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
        this.log(`쿠키 삭제: ${name}`);
    },
    
    // 사용자 정보 저장 (영구)
    saveUserInfo: function(userInfo) {
        this.log('사용자 정보 저장', userInfo);
        
        // localStorage에 저장 (영구)
        localStorage.setItem('user_info', JSON.stringify(userInfo));
        
        // 쿠키에도 userId 저장 (7일)
        this.setCookie('userId', userInfo.userId || userInfo.user_id, 7);
        this.setCookie('nickname', userInfo.nickname, 7);
        
        // sessionStorage에도 저장 (현재 탭용)
        sessionStorage.setItem('user_info', JSON.stringify(userInfo));
        
        return true;
    },
    
    // 사용자 정보 불러오기
    getUserInfo: function() {
        this.log('사용자 정보 불러오기 시도');
        
        // 1. sessionStorage 확인 (현재 탭)
        let userInfo = sessionStorage.getItem('user_info');
        if (userInfo) {
            this.log('sessionStorage에서 사용자 정보 발견');
            return JSON.parse(userInfo);
        }
        
        // 2. localStorage 확인 (영구 저장)
        userInfo = localStorage.getItem('user_info');
        if (userInfo) {
            this.log('localStorage에서 사용자 정보 발견');
            const parsed = JSON.parse(userInfo);
            // sessionStorage에도 복사
            sessionStorage.setItem('user_info', JSON.stringify(parsed));
            return parsed;
        }
        
        // 3. 쿠키에서 userId로 복구 시도
        const userId = this.getCookie('userId');
        const nickname = this.getCookie('nickname');
        
        if (userId && nickname) {
            this.log('쿠키에서 사용자 정보 복구');
            
            // 참여자 목록에서 추가 정보 찾기
            const participants = JSON.parse(localStorage.getItem('survey_participants') || '[]');
            const participant = participants.find(p => 
                p.user_id === userId || p.userId === userId
            );
            
            if (participant) {
                const recoveredInfo = {
                    userId: participant.user_id || participant.userId,
                    nickname: participant.nickname,
                    gender: participant.gender,
                    color: participant.color_hex || participant.color,
                    registered: true
                };
                
                // 복구한 정보 저장
                this.saveUserInfo(recoveredInfo);
                return recoveredInfo;
            }
        }
        
        this.log('저장된 사용자 정보 없음');
        return null;
    },
    
    // 사용자 정보 삭제
    clearUserInfo: function() {
        this.log('사용자 정보 삭제');
        
        // 모든 저장소에서 삭제
        localStorage.removeItem('user_info');
        sessionStorage.removeItem('user_info');
        this.deleteCookie('userId');
        this.deleteCookie('nickname');
    },
    
    // 사용자 등록 여부 확인
    isUserRegistered: function() {
        const userInfo = this.getUserInfo();
        return userInfo && userInfo.registered;
    },
    
    // 자동 재참여 처리
    autoRejoin: async function() {
        this.log('자동 재참여 시도');
        
        const userInfo = this.getUserInfo();
        if (!userInfo || !userInfo.registered) {
            this.log('등록된 사용자 정보 없음');
            return false;
        }
        
        // 참여자 목록에 있는지 확인
        const participants = JSON.parse(localStorage.getItem('survey_participants') || '[]');
        const exists = participants.some(p => 
            p.user_id === userInfo.userId || p.userId === userInfo.userId
        );
        
        if (!exists) {
            this.log('참여자 목록에 없음 - 재등록 필요');
            
            // Supabase에 재등록 시도
            if (typeof SupabaseRealtime !== 'undefined' && SupabaseRealtime.isConnected) {
                const result = await SupabaseRealtime.registerParticipant({
                    user_id: userInfo.userId,
                    nickname: userInfo.nickname,
                    gender: userInfo.gender,
                    color_hex: userInfo.color,
                    is_active: true
                });
                
                if (result.success) {
                    this.log('Supabase 재등록 성공');
                } else {
                    this.log('Supabase 재등록 실패', result.error);
                }
            } else {
                // localStorage에만 추가
                participants.push({
                    user_id: userInfo.userId,
                    nickname: userInfo.nickname,
                    gender: userInfo.gender,
                    color_hex: userInfo.color,
                    is_active: true,
                    joined_at: Date.now()
                });
                localStorage.setItem('survey_participants', JSON.stringify(participants));
            }
        }
        
        this.log('자동 재참여 성공', userInfo);
        return userInfo;
    },
    
    // 세션 상태 저장
    saveSessionState: function(state) {
        this.log('세션 상태 저장', state);
        
        // 현재 상태를 localStorage에 저장
        const sessionState = {
            lastQuestion: state.currentQuestion,
            lastSession: state.currentSession,
            timestamp: Date.now()
        };
        
        localStorage.setItem('session_state', JSON.stringify(sessionState));
    },
    
    // 세션 상태 복구
    getSessionState: function() {
        const state = localStorage.getItem('session_state');
        if (state) {
            const parsed = JSON.parse(state);
            // 24시간 이내의 세션만 유효
            if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
                this.log('세션 상태 복구', parsed);
                return parsed;
            }
        }
        return null;
    },
    
    // 초기화
    init: function() {
        this.log('세션 관리자 초기화');
        
        // 페이지 로드 시 자동 재참여 시도
        if (this.isUserRegistered()) {
            this.autoRejoin();
        }
        
        // 페이지 언로드 시 상태 저장
        window.addEventListener('beforeunload', () => {
            const state = JSON.parse(localStorage.getItem('survey_state') || '{}');
            if (state.currentQuestion) {
                this.saveSessionState(state);
            }
        });
    }
};

// 전역으로 내보내기
window.SessionManager = SessionManager;

// 자동 초기화
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        SessionManager.init();
    });
}