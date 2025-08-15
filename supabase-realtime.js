// ===================================================
// Supabase 실시간 동기화 모듈 (완전 재구성)
// ===================================================

const SupabaseRealtime = {
    client: null,
    channel: null,
    isConnected: false,
    DEBUG: true,
    
    // 로깅 함수
    log: function(message, data = null) {
        if (this.DEBUG) {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] [SupabaseRealtime] ${message}`, data || '');
        }
    },
    
    // 초기화
    init: async function() {
        this.log('초기화 시작');
        
        // Supabase 클라이언트 생성
        if (typeof SUPABASE_CONFIG === 'undefined' || !SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
            this.log('Supabase 설정 없음 - LocalStorage 모드로 실행');
            return false;
        }
        
        try {
            // Supabase 클라이언트 생성
            this.client = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
                realtime: {
                    params: {
                        eventsPerSecond: 10
                    }
                }
            });
            
            this.log('Supabase 클라이언트 생성 완료');
            
            // 연결 테스트
            const { data, error } = await this.client
                .from('survey_state')
                .select('*')
                .limit(1);
            
            if (error) {
                throw error;
            }
            
            this.log('Supabase 연결 성공', data);
            
            // 실시간 채널 설정
            await this.setupRealtimeChannel();
            
            // 초기 데이터 동기화
            await this.syncInitialData();
            
            this.isConnected = true;
            return true;
            
        } catch (error) {
            this.log('Supabase 초기화 실패', error);
            this.isConnected = false;
            return false;
        }
    },
    
    // 실시간 채널 설정
    setupRealtimeChannel: async function() {
        this.log('실시간 채널 설정 시작');
        
        // 기존 채널 정리
        if (this.channel) {
            await this.channel.unsubscribe();
        }
        
        // 새 채널 생성
        this.channel = this.client.channel('quiz-room', {
            config: {
                broadcast: {
                    self: true  // 자신의 브로드캐스트도 받기
                }
            }
        });
        
        // 1. survey_state 테이블 변경 감지
        this.channel.on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'survey_state'
            },
            (payload) => {
                this.log('survey_state 변경 감지', payload);
                this.handleStateChange(payload);
            }
        );
        
        // 2. responses 테이블 변경 감지
        this.channel.on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'responses'
            },
            (payload) => {
                this.log('새 응답 감지', payload);
                this.handleResponseInsert(payload);
            }
        );
        
        // 3. participants 테이블 변경 감지
        this.channel.on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'participants'
            },
            (payload) => {
                this.log('참여자 변경 감지', payload);
                this.handleParticipantChange(payload);
            }
        );
        
        // 4. 브로드캐스트 이벤트 (크로스탭 통신)
        this.channel.on('broadcast', { event: 'quiz-update' }, (payload) => {
            this.log('브로드캐스트 수신', payload);
            this.handleBroadcast(payload);
        });
        
        // 채널 구독
        const status = await this.channel.subscribe((status) => {
            this.log('채널 구독 상태', status);
        });
        
        this.log('실시간 채널 설정 완료', status);
    },
    
    // 초기 데이터 동기화
    syncInitialData: async function() {
        this.log('초기 데이터 동기화 시작');
        
        try {
            // 1. 현재 퀴즈 상태 가져오기
            const { data: stateData, error: stateError } = await this.client
                .from('survey_state')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            
            if (stateData && !stateError) {
                const normalizedState = this.normalizeState(stateData);
                localStorage.setItem('survey_state', JSON.stringify(normalizedState));
                this.log('퀴즈 상태 동기화 완료', normalizedState);
            }
            
            // 2. 질문 데이터 가져오기 (questions 테이블에서)
            const { data: questionsData, error: questionsError } = await this.client
                .from('questions')
                .select('*')
                .order('question_number');
            
            if (questionsData && !questionsError) {
                // 세션별로 그룹화
                const sessions = {};
                questionsData.forEach(q => {
                    if (!sessions[q.session_number]) {
                        sessions[q.session_number] = {
                            session_number: q.session_number,
                            session_name: q.session_name,
                            questions: []
                        };
                    }
                    sessions[q.session_number].questions.push(q);
                });
                
                const quizData = {
                    title: "2025 청년부 수련회 퀴즈",
                    description: "60문제 완전판",
                    total_questions: questionsData.length,
                    sessions: Object.values(sessions)
                };
                
                localStorage.setItem('quiz_data', JSON.stringify(quizData));
                this.log('질문 데이터 동기화 완료', `${questionsData.length}개 문제`);
            }
            
            // 3. 참여자 목록 가져오기
            const { data: participantsData, error: participantsError } = await this.client
                .from('participants')
                .select('*')
                .eq('is_active', true);
            
            if (participantsData && !participantsError) {
                localStorage.setItem('survey_participants', JSON.stringify(participantsData));
                this.log('참여자 동기화 완료', `${participantsData.length}명`);
            }
            
            // 4. 현재 문제 응답 가져오기
            if (stateData && stateData.current_question > 0) {
                const { data: responsesData } = await this.client
                    .from('responses')
                    .select('*')
                    .eq('question_id', stateData.current_question);
                
                if (responsesData) {
                    const responses = {};
                    responses[stateData.current_question] = {};
                    responsesData.forEach(r => {
                        responses[stateData.current_question][r.user_id] = r;
                    });
                    
                    const existingResponses = JSON.parse(localStorage.getItem('survey_responses') || '{}');
                    localStorage.setItem('survey_responses', JSON.stringify({
                        ...existingResponses,
                        ...responses
                    }));
                    this.log('응답 동기화 완료', `${responsesData.length}개 응답`);
                }
            }
            
        } catch (error) {
            this.log('초기 데이터 동기화 실패', error);
        }
    },
    
    // 상태 정규화
    normalizeState: function(state) {
        return {
            status: state.status || 'waiting',
            currentQuestion: state.current_question || state.currentQuestion || 0,
            currentSession: state.current_session || state.currentSession || 0,
            timerEnd: state.timer_end ? new Date(state.timer_end).getTime() : state.timerEnd || null,
            startTime: state.start_time || state.startTime,
            endTime: state.end_time || state.endTime,
            isResultVisible: state.is_result_visible || false
        };
    },
    
    // survey_state 변경 처리
    handleStateChange: function(payload) {
        const newState = this.normalizeState(payload.new);
        const oldState = payload.old ? this.normalizeState(payload.old) : null;
        
        this.log('상태 변경', { old: oldState, new: newState });
        
        // localStorage 업데이트
        localStorage.setItem('survey_state', JSON.stringify(newState));
        
        // 커스텀 이벤트 발생
        window.dispatchEvent(new CustomEvent('supabase:stateChanged', {
            detail: {
                oldState: oldState,
                newState: newState,
                event: payload.eventType
            }
        }));
        
        // RealtimeSync 모듈과 연동
        if (typeof RealtimeSync !== 'undefined' && RealtimeSync.checkStateUpdate) {
            RealtimeSync.checkStateUpdate();
        }
    },
    
    // 응답 추가 처리
    handleResponseInsert: function(payload) {
        const response = payload.new;
        
        this.log('새 응답 추가', response);
        
        // localStorage 업데이트
        const responses = JSON.parse(localStorage.getItem('survey_responses') || '{}');
        if (!responses[response.question_id]) {
            responses[response.question_id] = {};
        }
        responses[response.question_id][response.user_id] = response;
        localStorage.setItem('survey_responses', JSON.stringify(responses));
        
        // 커스텀 이벤트 발생
        window.dispatchEvent(new CustomEvent('supabase:responseAdded', {
            detail: response
        }));
        
        // UI 업데이트
        if (typeof updateParticipantsBubbles === 'function') {
            updateParticipantsBubbles();
        }
        if (typeof updateRealtimeStats === 'function') {
            updateRealtimeStats();
        }
    },
    
    // 참여자 변경 처리
    handleParticipantChange: function(payload) {
        const participant = payload.new;
        
        this.log('참여자 변경', participant);
        
        // localStorage 업데이트
        const participants = JSON.parse(localStorage.getItem('survey_participants') || '[]');
        const index = participants.findIndex(p => p.user_id === participant.user_id);
        
        if (payload.eventType === 'DELETE') {
            participants.splice(index, 1);
        } else if (index !== -1) {
            participants[index] = participant;
        } else {
            participants.push(participant);
        }
        
        localStorage.setItem('survey_participants', JSON.stringify(participants));
        
        // 커스텀 이벤트 발생
        window.dispatchEvent(new CustomEvent('supabase:participantChanged', {
            detail: participant
        }));
        
        // UI 업데이트
        if (typeof updateParticipantsBubbles === 'function') {
            updateParticipantsBubbles();
        }
    },
    
    // 브로드캐스트 처리
    handleBroadcast: function(payload) {
        this.log('브로드캐스트 처리', payload);
        
        // 브로드캐스트 타입별 처리
        switch (payload.payload.type) {
            case 'state_updated':
                // 상태 업데이트 브로드캐스트
                const newState = this.normalizeState(payload.payload.state);
                localStorage.setItem('survey_state', JSON.stringify(newState));
                
                if (typeof RealtimeSync !== 'undefined' && RealtimeSync.checkStateUpdate) {
                    RealtimeSync.checkStateUpdate();
                }
                break;
                
            case 'next_question':
                // 다음 문제로 이동
                if (typeof RealtimeSync !== 'undefined' && RealtimeSync.checkStateUpdate) {
                    RealtimeSync.checkStateUpdate();
                }
                break;
                
            case 'quiz_ended':
                // 퀴즈 종료
                if (typeof showFinalScreen === 'function') {
                    showFinalScreen();
                }
                break;
                
            default:
                this.log('알 수 없는 브로드캐스트 타입', payload.payload.type);
        }
    },
    
    // 퀴즈 상태 업데이트 (관리자용)
    updateQuizState: async function(state) {
        this.log('퀴즈 상태 업데이트 요청', state);
        
        if (!this.isConnected) {
            this.log('Supabase 연결 안됨 - localStorage만 업데이트');
            localStorage.setItem('survey_state', JSON.stringify(state));
            return { success: true, local: true };
        }
        
        try {
            // Supabase 포맷으로 변환
            const supabaseState = {
                status: state.status,
                current_question: state.currentQuestion || state.current_question,
                current_session: state.currentSession || state.current_session,
                timer_end: state.timerEnd ? new Date(state.timerEnd).toISOString() : null,
                start_time: state.startTime ? new Date(state.startTime).toISOString() : null,
                end_time: state.endTime ? new Date(state.endTime).toISOString() : null,
                updated_at: new Date().toISOString()
            };
            
            // Supabase 업데이트
            const { data, error } = await this.client
                .from('survey_state')
                .upsert(supabaseState)
                .select()
                .single();
            
            if (error) throw error;
            
            this.log('Supabase 상태 업데이트 성공', data);
            
            // 브로드캐스트 전송
            await this.channel.send({
                type: 'broadcast',
                event: 'quiz-update',
                payload: {
                    type: 'state_updated',
                    state: data
                }
            });
            
            // localStorage도 업데이트
            const normalizedState = this.normalizeState(data);
            localStorage.setItem('survey_state', JSON.stringify(normalizedState));
            
            return { success: true, data: normalizedState };
            
        } catch (error) {
            this.log('Supabase 업데이트 실패', error);
            // 실패시 localStorage만 업데이트
            localStorage.setItem('survey_state', JSON.stringify(state));
            return { success: false, error: error.message };
        }
    },
    
    // 응답 저장
    saveResponse: async function(response) {
        this.log('응답 저장 요청', response);
        
        if (!this.isConnected) {
            this.log('Supabase 연결 안됨 - localStorage만 업데이트');
            const responses = JSON.parse(localStorage.getItem('survey_responses') || '{}');
            if (!responses[response.question_id]) {
                responses[response.question_id] = {};
            }
            responses[response.question_id][response.user_id] = response;
            localStorage.setItem('survey_responses', JSON.stringify(responses));
            return { success: true, local: true };
        }
        
        try {
            // Supabase에 저장
            const { data, error } = await this.client
                .from('responses')
                .insert({
                    user_id: response.user_id,
                    question_id: response.question_id,
                    question_text: response.question_text,
                    question_type: response.question_type,
                    selected_option: response.answer,
                    selected_options: response.answer_options,
                    answer_text: response.answer_text,
                    voted_for: response.voted_for,
                    slider_value: response.slider_value,
                    response_time_ms: response.response_time_ms,
                    session_number: response.session_number
                })
                .select()
                .single();
            
            if (error) throw error;
            
            this.log('응답 저장 성공', data);
            
            // localStorage도 업데이트
            const responses = JSON.parse(localStorage.getItem('survey_responses') || '{}');
            if (!responses[response.question_id]) {
                responses[response.question_id] = {};
            }
            responses[response.question_id][response.user_id] = data;
            localStorage.setItem('survey_responses', JSON.stringify(responses));
            
            return { success: true, data };
            
        } catch (error) {
            this.log('응답 저장 실패', error);
            // 실패시 localStorage만 업데이트
            const responses = JSON.parse(localStorage.getItem('survey_responses') || '{}');
            if (!responses[response.question_id]) {
                responses[response.question_id] = {};
            }
            responses[response.question_id][response.user_id] = response;
            localStorage.setItem('survey_responses', JSON.stringify(responses));
            return { success: false, error: error.message };
        }
    },
    
    // 참여자 등록
    registerParticipant: async function(participant) {
        this.log('참여자 등록 요청', participant);
        
        if (!this.isConnected) {
            this.log('Supabase 연결 안됨 - localStorage만 업데이트');
            const participants = JSON.parse(localStorage.getItem('survey_participants') || '[]');
            participants.push(participant);
            localStorage.setItem('survey_participants', JSON.stringify(participants));
            return { success: true, local: true };
        }
        
        try {
            // Supabase에 저장
            const { data, error } = await this.client
                .from('participants')
                .insert({
                    user_id: participant.user_id || participant.userId,
                    nickname: participant.nickname,
                    gender: participant.gender,
                    color_hex: participant.color || participant.color_hex,
                    is_active: true
                })
                .select()
                .single();
            
            if (error) throw error;
            
            this.log('참여자 등록 성공', data);
            
            // localStorage도 업데이트
            const participants = JSON.parse(localStorage.getItem('survey_participants') || '[]');
            participants.push(data);
            localStorage.setItem('survey_participants', JSON.stringify(participants));
            
            return { success: true, data };
            
        } catch (error) {
            this.log('참여자 등록 실패', error);
            // 실패시 localStorage만 업데이트
            const participants = JSON.parse(localStorage.getItem('survey_participants') || '[]');
            participants.push(participant);
            localStorage.setItem('survey_participants', JSON.stringify(participants));
            return { success: false, error: error.message };
        }
    },
    
    // 정리
    cleanup: async function() {
        this.log('정리 시작');
        
        if (this.channel) {
            await this.channel.unsubscribe();
            this.channel = null;
        }
        
        this.isConnected = false;
        this.log('정리 완료');
    }
};

// 전역으로 내보내기
window.SupabaseRealtime = SupabaseRealtime;

// 자동 초기화 (DOM 로드 후)
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', async () => {
        await SupabaseRealtime.init();
    });
    
    window.addEventListener('beforeunload', async () => {
        await SupabaseRealtime.cleanup();
    });
}