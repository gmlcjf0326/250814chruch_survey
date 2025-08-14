// Supabase 실시간 동기화 모듈
// LocalStorage와 Supabase를 모두 지원

const SupabaseSync = {
    client: null,
    channels: {},
    useSupabase: false,
    subscriptions: [],
    
    // 초기화
    init: async function() {
        // Supabase 클라이언트 확인
        if (typeof window.SUPABASE_URL !== 'undefined' && window.SUPABASE_URL) {
            try {
                this.client = supabase.createClient(
                    window.SUPABASE_URL,
                    window.SUPABASE_ANON_KEY
                );
                this.useSupabase = true;
                console.log('Supabase 실시간 모드 활성화');
                
                // 실시간 구독 설정
                await this.setupRealtimeSubscriptions();
                
                // 초기 데이터 동기화
                await this.syncInitialData();
            } catch (error) {
                console.error('Supabase 초기화 실패:', error);
                this.useSupabase = false;
                console.log('LocalStorage 모드로 전환');
            }
        } else {
            console.log('LocalStorage 모드 사용');
        }
    },
    
    // 실시간 구독 설정
    setupRealtimeSubscriptions: async function() {
        if (!this.useSupabase) return;
        
        // 1. survey_state 테이블 구독
        this.channels.surveyState = this.client
            .channel('survey-state-changes')
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'survey_state' 
                },
                (payload) => {
                    console.log('Survey state changed:', payload);
                    this.handleSurveyStateChange(payload);
                }
            )
            .subscribe();
        
        // 2. responses 테이블 구독
        this.channels.responses = this.client
            .channel('response-changes')
            .on('postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'responses'
                },
                (payload) => {
                    console.log('New response:', payload);
                    this.handleResponseChange(payload);
                }
            )
            .subscribe();
        
        // 3. participants 테이블 구독
        this.channels.participants = this.client
            .channel('participant-changes')
            .on('postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'participants'
                },
                (payload) => {
                    console.log('Participant changed:', payload);
                    this.handleParticipantChange(payload);
                }
            )
            .subscribe();
        
        // 4. 실시간 대시보드 구독 (브로드캐스트)
        this.channels.broadcast = this.client
            .channel('quiz-broadcast')
            .on('broadcast', { event: 'quiz-update' }, (payload) => {
                console.log('Quiz broadcast:', payload);
                this.handleBroadcast(payload);
            })
            .subscribe();
    },
    
    // 초기 데이터 동기화
    syncInitialData: async function() {
        if (!this.useSupabase) return;
        
        try {
            // 현재 상태 가져오기
            const { data: stateData, error: stateError } = await this.client
                .from('survey_state')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            
            if (stateData) {
                localStorage.setItem('survey_state', JSON.stringify(stateData));
            }
            
            // 참여자 목록 가져오기
            const { data: participantsData, error: participantsError } = await this.client
                .from('participants')
                .select('*')
                .eq('is_active', true);
            
            if (participantsData) {
                localStorage.setItem('survey_participants', JSON.stringify(participantsData));
            }
            
            // 현재 문제 응답 가져오기
            if (stateData && stateData.current_question) {
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
                }
            }
        } catch (error) {
            console.error('초기 데이터 동기화 실패:', error);
        }
    },
    
    // 설문 상태 변경 처리
    handleSurveyStateChange: function(payload) {
        const newState = payload.new;
        
        // LocalStorage 업데이트
        localStorage.setItem('survey_state', JSON.stringify(newState));
        
        // 이벤트 발생
        window.dispatchEvent(new CustomEvent('supabase:stateChanged', {
            detail: newState
        }));
        
        // RealtimeSync 모듈과 연동
        if (typeof RealtimeSync !== 'undefined') {
            RealtimeSync.checkStateUpdate();
        }
    },
    
    // 응답 변경 처리
    handleResponseChange: function(payload) {
        const newResponse = payload.new;
        
        // LocalStorage 업데이트
        const responses = JSON.parse(localStorage.getItem('survey_responses') || '{}');
        if (!responses[newResponse.question_id]) {
            responses[newResponse.question_id] = {};
        }
        responses[newResponse.question_id][newResponse.user_id] = newResponse;
        localStorage.setItem('survey_responses', JSON.stringify(responses));
        
        // 이벤트 발생
        window.dispatchEvent(new CustomEvent('supabase:responseAdded', {
            detail: newResponse
        }));
        
        // UI 업데이트
        if (typeof updateParticipantsBubbles === 'function') {
            updateParticipantsBubbles();
        }
    },
    
    // 참여자 변경 처리
    handleParticipantChange: function(payload) {
        const participant = payload.new;
        
        // LocalStorage 업데이트
        const participants = JSON.parse(localStorage.getItem('survey_participants') || '[]');
        const index = participants.findIndex(p => p.user_id === participant.user_id);
        
        if (index !== -1) {
            participants[index] = participant;
        } else {
            participants.push(participant);
        }
        
        localStorage.setItem('survey_participants', JSON.stringify(participants));
        
        // 이벤트 발생
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
        console.log('Broadcast received:', payload);
        
        // 페이지별 처리
        if (payload.type === 'next_question') {
            if (typeof checkForNewQuestion === 'function') {
                checkForNewQuestion();
            }
        } else if (payload.type === 'quiz_ended') {
            if (typeof showFinalScreen === 'function') {
                showFinalScreen();
            }
        }
    },
    
    // 상태 업데이트 (관리자용)
    updateQuizState: async function(state) {
        if (!this.useSupabase) {
            // LocalStorage만 사용
            localStorage.setItem('survey_state', JSON.stringify(state));
            return { success: true };
        }
        
        try {
            // Supabase 업데이트
            const { data, error } = await this.client
                .from('survey_state')
                .upsert({
                    ...state,
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();
            
            if (error) throw error;
            
            // LocalStorage도 업데이트
            localStorage.setItem('survey_state', JSON.stringify(data));
            
            // 브로드캐스트 전송
            await this.channels.broadcast.send({
                type: 'broadcast',
                event: 'quiz-update',
                payload: { type: 'state_updated', state: data }
            });
            
            return { success: true, data };
        } catch (error) {
            console.error('상태 업데이트 실패:', error);
            // 실패시 LocalStorage만 사용
            localStorage.setItem('survey_state', JSON.stringify(state));
            return { success: false, error };
        }
    },
    
    // 응답 저장
    saveResponse: async function(response) {
        if (!this.useSupabase) {
            // LocalStorage만 사용
            const responses = JSON.parse(localStorage.getItem('survey_responses') || '{}');
            if (!responses[response.question_id]) {
                responses[response.question_id] = {};
            }
            responses[response.question_id][response.user_id] = response;
            localStorage.setItem('survey_responses', JSON.stringify(responses));
            return { success: true };
        }
        
        try {
            // Supabase 저장
            const { data, error } = await this.client
                .from('responses')
                .insert({
                    ...response,
                    submitted_at: new Date().toISOString()
                })
                .select()
                .single();
            
            if (error) throw error;
            
            // LocalStorage도 업데이트
            const responses = JSON.parse(localStorage.getItem('survey_responses') || '{}');
            if (!responses[response.question_id]) {
                responses[response.question_id] = {};
            }
            responses[response.question_id][response.user_id] = data;
            localStorage.setItem('survey_responses', JSON.stringify(responses));
            
            return { success: true, data };
        } catch (error) {
            console.error('응답 저장 실패:', error);
            // 실패시 LocalStorage만 사용
            const responses = JSON.parse(localStorage.getItem('survey_responses') || '{}');
            if (!responses[response.question_id]) {
                responses[response.question_id] = {};
            }
            responses[response.question_id][response.user_id] = response;
            localStorage.setItem('survey_responses', JSON.stringify(responses));
            return { success: false, error };
        }
    },
    
    // 참여자 등록
    registerParticipant: async function(participant) {
        if (!this.useSupabase) {
            // LocalStorage만 사용
            const participants = JSON.parse(localStorage.getItem('survey_participants') || '[]');
            participants.push(participant);
            localStorage.setItem('survey_participants', JSON.stringify(participants));
            return { success: true };
        }
        
        try {
            // Supabase 저장
            const { data, error } = await this.client
                .from('participants')
                .insert({
                    ...participant,
                    joined_at: new Date().toISOString()
                })
                .select()
                .single();
            
            if (error) throw error;
            
            // LocalStorage도 업데이트
            const participants = JSON.parse(localStorage.getItem('survey_participants') || '[]');
            participants.push(data);
            localStorage.setItem('survey_participants', JSON.stringify(participants));
            
            return { success: true, data };
        } catch (error) {
            console.error('참여자 등록 실패:', error);
            // 실패시 LocalStorage만 사용
            const participants = JSON.parse(localStorage.getItem('survey_participants') || '[]');
            participants.push(participant);
            localStorage.setItem('survey_participants', JSON.stringify(participants));
            return { success: false, error };
        }
    },
    
    // 실시간 통계 가져오기
    getRealtimeStats: async function() {
        if (!this.useSupabase) {
            // LocalStorage에서 계산
            const state = JSON.parse(localStorage.getItem('survey_state') || '{}');
            const participants = JSON.parse(localStorage.getItem('survey_participants') || '[]');
            const responses = JSON.parse(localStorage.getItem('survey_responses') || '{}');
            
            return {
                currentQuestion: state.current_question || 0,
                status: state.status || 'waiting',
                totalParticipants: participants.length,
                currentResponses: responses[state.current_question] ? 
                    Object.keys(responses[state.current_question]).length : 0
            };
        }
        
        try {
            // Supabase에서 가져오기
            const { data, error } = await this.client
                .rpc('get_current_quiz_state');
            
            if (error) throw error;
            
            return data[0] || {};
        } catch (error) {
            console.error('통계 가져오기 실패:', error);
            // 실패시 LocalStorage 사용
            const state = JSON.parse(localStorage.getItem('survey_state') || '{}');
            const participants = JSON.parse(localStorage.getItem('survey_participants') || '[]');
            const responses = JSON.parse(localStorage.getItem('survey_responses') || '{}');
            
            return {
                currentQuestion: state.current_question || 0,
                status: state.status || 'waiting',
                totalParticipants: participants.length,
                currentResponses: responses[state.current_question] ? 
                    Object.keys(responses[state.current_question]).length : 0
            };
        }
    },
    
    // 정리
    cleanup: function() {
        // 채널 구독 해제
        Object.values(this.channels).forEach(channel => {
            if (channel && channel.unsubscribe) {
                channel.unsubscribe();
            }
        });
        
        this.channels = {};
        this.subscriptions = [];
    }
};

// 자동 초기화
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        SupabaseSync.init();
    });
    
    window.addEventListener('beforeunload', () => {
        SupabaseSync.cleanup();
    });
}

// 전역으로 내보내기
window.SupabaseSync = SupabaseSync;