// 청년부 수련회 퀴즈 시스템 - 새로운 버전
// 닉네임 등록, 성별 구분, 다양한 질문 유형 지원

// 전역 상태 관리
const APP_STATE = {
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
    // 사용자 정보
    userInfo: {
        userId: null,
        nickname: null,
        gender: null,
        color: null,
        registered: false
    },
    isSubmitting: false,
    hasShownStats: false,
    statsUpdateInterval: null
};

// LocalStorage 키
const STORAGE_KEYS = {
    SURVEY_STATE: 'survey_state',
    QUESTIONS: 'survey_questions',
    RESPONSES: 'survey_responses',
    PARTICIPANTS: 'survey_participants',
    USER_INFO: 'user_info',
    QUIZ_DATA: 'quiz_data'
};

// 색상 팔레트
const COLOR_PALETTES = {
    male: [
        '#4A90E2', '#5C9FDB', '#6EAEE4', '#7FB8E8', '#91C3EC',
        '#667EEA', '#7B8FED', '#90A0F0', '#A5B1F3', '#BAC2F6',
        '#4F86C6', '#6495ED', '#7BA7E7', '#92B9F1', '#A9CBF5'
    ],
    female: [
        '#FF6B9D', '#FF7FA7', '#FF93B1', '#FFA7BB', '#FFBBC5',
        '#FEC0CE', '#FECDD6', '#FEDAD', '#FEE7E6', '#FFF4F3',
        '#E91E63', '#EC407A', '#F06292', '#F48FB1', '#F8BBD0'
    ]
};

// 퀴즈 데이터 로드
async function loadQuizData() {
    try {
        const response = await fetch('quiz-data-60.json');
        APP_STATE.quizData = await response.json();
        
        // 질문 배열 생성
        APP_STATE.questions = [];
        APP_STATE.quizData.sessions.forEach(session => {
            session.questions.forEach(q => {
                APP_STATE.questions.push({
                    ...q,
                    session_number: session.session_number,
                    session_name: session.session_name
                });
            });
        });
        
        APP_STATE.totalQuestions = APP_STATE.questions.length;
        
        localStorage.setItem(STORAGE_KEYS.QUIZ_DATA, JSON.stringify(APP_STATE.quizData));
        return true;
    } catch (error) {
        console.error('퀴즈 데이터 로드 실패:', error);
        // localStorage에서 백업 데이터 로드
        const backupData = localStorage.getItem(STORAGE_KEYS.QUIZ_DATA);
        if (backupData) {
            APP_STATE.quizData = JSON.parse(backupData);
            return true;
        }
        return false;
    }
}

// 사용자 등록 처리
function setupRegistration() {
    const nicknameInput = document.getElementById('nickname-input');
    const genderBtns = document.querySelectorAll('.gender-btn');
    const registerBtn = document.getElementById('register-btn');
    
    let selectedGender = null;
    
    // 성별 버튼 클릭
    genderBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            genderBtns.forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            selectedGender = this.dataset.gender;
            checkRegistrationForm();
        });
    });
    
    // 닉네임 입력
    nicknameInput.addEventListener('input', checkRegistrationForm);
    
    // 폼 유효성 검사
    function checkRegistrationForm() {
        const nickname = nicknameInput.value.trim();
        if (nickname.length > 0 && selectedGender) {
            registerBtn.disabled = false;
        } else {
            registerBtn.disabled = true;
        }
    }
    
    // 등록 버튼 클릭
    registerBtn.addEventListener('click', async function() {
        const nickname = nicknameInput.value.trim();
        if (!nickname || !selectedGender) return;
        
        // 중복 체크
        const participants = JSON.parse(localStorage.getItem(STORAGE_KEYS.PARTICIPANTS) || '[]');
        if (participants.some(p => p.nickname === nickname)) {
            alert('이미 사용중인 닉네임입니다.');
            return;
        }
        
        // 색상 자동 배정
        const color = getAvailableColor(selectedGender, participants);
        
        // 사용자 정보 저장
        APP_STATE.userInfo = {
            userId: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            nickname: nickname,
            gender: selectedGender,
            color: color,
            registered: true
        };
        
        // 참여자 목록에 추가
        const newParticipant = {
            ...APP_STATE.userInfo,
            user_id: APP_STATE.userInfo.userId,  // Supabase 컬럼명
            joined_at: Date.now(),
            is_active: true
        };
        
        // SyncManager를 통해 참여자 등록
        if (typeof SyncManager !== 'undefined') {
            await SyncManager.registerParticipant(newParticipant);
        } else {
            participants.push(newParticipant);
            localStorage.setItem(STORAGE_KEYS.PARTICIPANTS, JSON.stringify(participants));
        }
        
        // SessionManager를 통해 사용자 정보 영구 저장
        if (typeof SessionManager !== 'undefined') {
            SessionManager.saveUserInfo(APP_STATE.userInfo);
        } else {
            sessionStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(APP_STATE.userInfo));
        }
        
        // 참여자 버블 업데이트
        updateParticipantsBubbles();
        
        // 화면 전환
        document.getElementById('registration-screen').classList.remove('active');
        document.getElementById('waiting-screen').classList.add('active');
        
        // 내 정보 표시
        document.getElementById('my-nickname').textContent = nickname;
        document.getElementById('my-color').style.backgroundColor = color;
        document.getElementById('user-info').textContent = `${nickname} | © 2025 청년부 수련회`;
        
        // RealtimeSync가 동기화를 처리함
    });
}

// 사용 가능한 색상 찾기
function getAvailableColor(gender, participants) {
    const palette = COLOR_PALETTES[gender];
    const usedColors = participants
        .filter(p => p.gender === gender)
        .map(p => p.color);
    
    // 사용되지 않은 색상 찾기
    for (const color of palette) {
        if (!usedColors.includes(color)) {
            return color;
        }
    }
    
    // 모든 색상이 사용중이면 랜덤 선택
    return palette[Math.floor(Math.random() * palette.length)];
}

// 참여자 버블 업데이트
function updateParticipantsBubbles() {
    const container = document.getElementById('participants-bar');
    if (!container) return;
    
    const participants = JSON.parse(localStorage.getItem(STORAGE_KEYS.PARTICIPANTS) || '[]');
    const responses = JSON.parse(localStorage.getItem(STORAGE_KEYS.RESPONSES) || '{}');
    const state = JSON.parse(localStorage.getItem(STORAGE_KEYS.SURVEY_STATE) || '{}');
    
    container.innerHTML = '';
    
    participants.forEach(participant => {
        const bubble = document.createElement('div');
        bubble.className = `participant-bubble ${participant.gender}`;
        bubble.style.backgroundColor = participant.color;
        bubble.dataset.userId = participant.userId;
        
        // 현재 답변 여부 확인
        const hasAnswered = state.currentQuestion && 
            responses[state.currentQuestion] && 
            responses[state.currentQuestion][participant.userId];
        
        if (hasAnswered) {
            bubble.classList.add('answered');
        }
        
        if (participant.is_active) {
            bubble.classList.add('active');
        }
        
        bubble.innerHTML = `
            <span class="bubble-name">${participant.nickname}</span>
            ${hasAnswered ? '<span class="status-dot"></span>' : ''}
        `;
        
        // 클릭 이벤트
        bubble.addEventListener('click', () => showParticipantHistory(participant));
        
        container.appendChild(bubble);
    });
    
    // 참여자 수 표시
    const participantCount = document.createElement('div');
    participantCount.className = 'participant-count';
    participantCount.innerHTML = `<span>♥${participants.length}</span>`;
    container.appendChild(participantCount);
}

// 참여자 히스토리 표시
function showParticipantHistory(participant) {
    const modal = document.getElementById('history-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    
    modalTitle.textContent = `${participant.nickname}님의 답변 기록`;
    
    const responses = JSON.parse(localStorage.getItem(STORAGE_KEYS.RESPONSES) || '{}');
    const userResponses = [];
    
    // 사용자의 모든 답변 수집
    Object.entries(responses).forEach(([questionId, questionResponses]) => {
        if (questionResponses[participant.userId]) {
            const question = APP_STATE.questions[questionId - 1];
            if (question) {
                userResponses.push({
                    questionNumber: questionId,
                    question: question.question_text,
                    answer: formatAnswer(questionResponses[participant.userId], question.question_type),
                    time: questionResponses[participant.userId].response_time_ms
                });
            }
        }
    });
    
    // HTML 생성
    let html = `
        <div class="participant-stats">
            <div class="stat">
                <span class="stat-label">성별</span>
                <span class="stat-value">${participant.gender === 'male' ? '남성' : '여성'}</span>
            </div>
            <div class="stat">
                <span class="stat-label">색상</span>
                <span class="stat-value color-box" style="background: ${participant.color}"></span>
            </div>
            <div class="stat">
                <span class="stat-label">답변 수</span>
                <span class="stat-value">${userResponses.length}개</span>
            </div>
        </div>
        <div class="response-timeline">
            <h4>답변 타임라인</h4>
    `;
    
    if (userResponses.length > 0) {
        userResponses.forEach(response => {
            html += `
                <div class="timeline-item">
                    <div class="timeline-question">Q${response.questionNumber}. ${response.question}</div>
                    <div class="timeline-answer">${response.answer}</div>
                    ${response.time ? `<div class="timeline-time">${(response.time / 1000).toFixed(1)}초</div>` : ''}
                </div>
            `;
        });
    } else {
        html += '<p>아직 답변이 없습니다.</p>';
    }
    
    html += '</div>';
    
    modalBody.innerHTML = html;
    modal.classList.add('show');
}

// 답변 포맷팅
function formatAnswer(response, questionType) {
    if (response.answer_text) return response.answer_text;
    if (response.answer_options) return response.answer_options.join(', ');
    if (response.answer_number !== undefined) return response.answer_number + '%';
    if (response.answer_emoji) return response.answer_emoji;
    if (response.answer) return response.answer; // 기존 형식 호환
    return '-';
}

// 모달 닫기
window.closeHistoryModal = function() {
    document.getElementById('history-modal').classList.remove('show');
};

// 사용자 화면 초기화
function initUserScreen() {
    // 퀴즈 데이터 로드
    loadQuizData().then(success => {
        if (!success) {
            alert('퀴즈 데이터를 불러올 수 없습니다.');
            return;
        }
        
        // SessionManager를 통해 사용자 정보 확인
        const savedUserInfo = (typeof SessionManager !== 'undefined') ? 
            SessionManager.getUserInfo() : 
            JSON.parse(sessionStorage.getItem(STORAGE_KEYS.USER_INFO) || 'null');
            
        if (savedUserInfo) {
            APP_STATE.userInfo = savedUserInfo;
            APP_STATE.userInfo.registered = true;  // 등록 상태 명시
            // 이미 등록된 사용자는 대기 화면으로
            document.getElementById('registration-screen').classList.remove('active');
            document.getElementById('waiting-screen').classList.add('active');
            document.getElementById('my-nickname').textContent = APP_STATE.userInfo.nickname;
            document.getElementById('my-color').style.backgroundColor = APP_STATE.userInfo.color;
            document.getElementById('user-info').textContent = `${APP_STATE.userInfo.nickname} | © 2025 청년부 수련회`;
        } else {
            // 새 사용자는 등록 화면
            setupRegistration();
        }
        
        // 참여자 버블 초기화
        updateParticipantsBubbles();
        
        // 현재 상태 확인 및 초기화
        const currentState = JSON.parse(localStorage.getItem(STORAGE_KEYS.SURVEY_STATE) || '{}');
        if (currentState.currentQuestion || currentState.current_question) {
            APP_STATE.currentQuestion = currentState.currentQuestion || currentState.current_question;
            console.log(`초기 문제 번호 설정: ${APP_STATE.currentQuestion}`);
        }
        
        // 답변 폼 이벤트
        const form = document.getElementById('answer-form');
        if (form) {
            form.addEventListener('submit', handleAnswerSubmit);
        }
        
        // 슬라이더 이벤트
        const slider = document.getElementById('slider-answer');
        if (slider) {
            slider.addEventListener('input', function() {
                document.getElementById('slider-value').textContent = this.value;
            });
        }
    });
}

// RealtimeSync 모듈이 동기화를 처리합니다
// startUserSync 함수는 제거되었습니다

// 조건 확인
function checkCondition(condition, responses) {
    if (!condition || !condition.question_id) return true;
    
    const previousResponse = responses[condition.question_id]?.[APP_STATE.userInfo.userId];
    if (!previousResponse) return false;
    
    return previousResponse.answer === condition.answer || 
           previousResponse.answer_text === condition.answer;
}

// 문제 표시
function showQuestion(question, questionNumber) {
    // 이미 같은 문제를 표시 중이고 question-screen이 활성화되어 있으면 무시
    if (APP_STATE.currentQuestion === questionNumber && 
        document.getElementById('question-screen').classList.contains('active')) {
        console.log(`문제 ${questionNumber}는 이미 표시 중`);
        return;
    }
    
    console.log(`새 문제 표시: ${questionNumber}`);
    
    // 현재 문제 번호 저장
    APP_STATE.currentQuestion = questionNumber;
    
    // 새 문제로 전환되었으므로 상태 초기화
    APP_STATE.hasShownStats = false;
    APP_STATE.isSubmitting = false;
    
    // 통계 업데이트 인터벌 정리
    if (APP_STATE.statsUpdateInterval) {
        clearInterval(APP_STATE.statsUpdateInterval);
        APP_STATE.statsUpdateInterval = null;
    }
    
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('question-screen').classList.add('active');
    
    document.getElementById('question-title').textContent = `Q${questionNumber}. ${question.question_text}`;
    
    // 모든 입력 컨테이너 숨기기
    document.getElementById('options-container').style.display = 'none';
    document.getElementById('text-answer-container').style.display = 'none';
    document.getElementById('slider-container').style.display = 'none';
    document.getElementById('emoji-container').style.display = 'none';
    document.getElementById('dropdown-container').style.display = 'none';
    document.getElementById('checkbox-container').style.display = 'none';
    
    // 질문 유형에 따라 UI 표시
    switch (question.question_type) {
        case 'radio':
            showRadioOptions(question);
            break;
        case 'checkbox':
            showCheckboxOptions(question);
            break;
        case 'text':
            showTextInput(question);
            break;
        case 'slider':
            showSlider(question);
            break;
        case 'emoji':
            showEmojiOptions(question);
            break;
        case 'dropdown':
            showDropdown(question);
            break;
        case 'conditional':
            showRadioOptions(question); // 조건부도 라디오로 표시
            break;
        case 'voting':
            showRadioOptions(question); // 투표도 라디오로 표시
            break;
    }
    
    // 제출 버튼 활성화
    document.getElementById('submit-btn').disabled = false;
}

// 라디오 옵션 표시
function showRadioOptions(question) {
    const container = document.getElementById('options-container');
    container.style.display = 'block';
    container.innerHTML = '';
    
    let options = question.options;
    
    // 동적 참여자 목록 처리
    if (options === 'dynamic_all_participants') {
        const participants = JSON.parse(localStorage.getItem(STORAGE_KEYS.PARTICIPANTS) || '[]');
        options = participants.map(p => p.nickname);
    }
    
    if (Array.isArray(options)) {
        options.forEach((option, index) => {
            const div = document.createElement('div');
            div.className = 'option-item';
            div.innerHTML = `
                <input type="radio" id="option-${index}" name="answer" value="${option}">
                <label for="option-${index}">${option}</label>
            `;
            div.addEventListener('click', () => {
                document.getElementById(`option-${index}`).checked = true;
                document.querySelectorAll('.option-item').forEach(item => item.classList.remove('selected'));
                div.classList.add('selected');
            });
            container.appendChild(div);
        });
    }
}

// 체크박스 옵션 표시
function showCheckboxOptions(question) {
    const container = document.getElementById('checkbox-container');
    container.style.display = 'block';
    container.innerHTML = '';
    
    let options = question.options;
    
    // 동적 참여자 목록 처리
    if (options === 'dynamic_all_participants') {
        const participants = JSON.parse(localStorage.getItem(STORAGE_KEYS.PARTICIPANTS) || '[]');
        options = participants.map(p => p.nickname);
    }
    
    const maxSelect = question.constraints?.max_select || options.length;
    const minSelect = question.constraints?.min_select || 1;
    
    const hint = document.createElement('div');
    hint.className = 'checkbox-hint';
    hint.textContent = `최소 ${minSelect}개, 최대 ${maxSelect}개 선택`;
    container.appendChild(hint);
    
    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'checkbox-options';
    
    if (Array.isArray(options)) {
        options.forEach((option, index) => {
            const div = document.createElement('div');
            div.className = 'checkbox-item';
            div.innerHTML = `
                <input type="checkbox" id="check-${index}" name="answer-check" value="${option}">
                <label for="check-${index}">${option}</label>
            `;
            
            const checkbox = div.querySelector('input');
            checkbox.addEventListener('change', () => {
                const checked = container.querySelectorAll('input[type="checkbox"]:checked');
                if (checked.length > maxSelect) {
                    checkbox.checked = false;
                    alert(`최대 ${maxSelect}개까지만 선택 가능합니다.`);
                }
            });
            
            optionsDiv.appendChild(div);
        });
    }
    
    container.appendChild(optionsDiv);
}

// 텍스트 입력 표시
function showTextInput(question) {
    const container = document.getElementById('text-answer-container');
    container.style.display = 'block';
    
    const input = document.getElementById('text-answer');
    input.value = '';
    input.maxLength = question.constraints?.max_length || 100;
    input.focus();
}

// 슬라이더 표시
function showSlider(question) {
    const container = document.getElementById('slider-container');
    container.style.display = 'block';
    
    const slider = document.getElementById('slider-answer');
    const min = question.constraints?.min_value || 0;
    const max = question.constraints?.max_value || 100;
    const step = question.constraints?.step || 1;
    
    slider.min = min;
    slider.max = max;
    slider.step = step;
    slider.value = Math.floor((min + max) / 2);
    
    document.getElementById('slider-value').textContent = slider.value;
    document.getElementById('slider-min').textContent = min;
    document.getElementById('slider-max').textContent = max;
}

// 이모지 옵션 표시
function showEmojiOptions(question) {
    const container = document.getElementById('emoji-container');
    container.style.display = 'block';
    container.innerHTML = '';
    
    if (Array.isArray(question.options)) {
        question.options.forEach((emoji, index) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'emoji-btn';
            btn.textContent = emoji;
            btn.dataset.value = emoji;
            btn.addEventListener('click', function() {
                document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
                this.classList.add('selected');
            });
            container.appendChild(btn);
        });
    }
}

// 드롭다운 표시
function showDropdown(question) {
    const container = document.getElementById('dropdown-container');
    container.style.display = 'block';
    
    const select = document.getElementById('dropdown-answer');
    select.innerHTML = '<option value="">선택하세요...</option>';
    
    let options = question.options;
    
    // 동적 참여자 목록 처리
    if (options === 'dynamic_male_participants') {
        const participants = JSON.parse(localStorage.getItem(STORAGE_KEYS.PARTICIPANTS) || '[]');
        options = participants.filter(p => p.gender === 'male').map(p => p.nickname);
    } else if (options === 'dynamic_female_participants') {
        const participants = JSON.parse(localStorage.getItem(STORAGE_KEYS.PARTICIPANTS) || '[]');
        options = participants.filter(p => p.gender === 'female').map(p => p.nickname);
    } else if (options === 'dynamic_all_participants') {
        const participants = JSON.parse(localStorage.getItem(STORAGE_KEYS.PARTICIPANTS) || '[]');
        options = participants.map(p => p.nickname);
    }
    
    if (Array.isArray(options)) {
        options.forEach(option => {
            const optionEl = document.createElement('option');
            optionEl.value = option;
            optionEl.textContent = option;
            select.appendChild(optionEl);
        });
    }
}

// 답변 제출 처리
async function handleAnswerSubmit(e) {
    e.preventDefault();
    
    // 이미 제출 중이면 무시
    if (APP_STATE.isSubmitting) {
        return;
    }
    
    // 제출 중 플래그 설정
    APP_STATE.isSubmitting = true;
    
    const state = JSON.parse(localStorage.getItem(STORAGE_KEYS.SURVEY_STATE) || '{}');
    const responses = JSON.parse(localStorage.getItem(STORAGE_KEYS.RESPONSES) || '{}');
    
    // 이미 답변한 경우 체크
    if (responses[state.currentQuestion]?.[APP_STATE.userInfo.userId]) {
        alert('이미 답변하셨습니다.');
        APP_STATE.isSubmitting = false;
        return;
    }
    
    const questionData = APP_STATE.questions[state.currentQuestion - 1];
    if (!questionData) {
        APP_STATE.isSubmitting = false;
        return;
    }
    
    let answer = null;
    const startTime = Date.now();
    
    // 질문 유형별 답변 수집
    switch (questionData.question_type) {
        case 'radio':
        case 'conditional':
        case 'voting':
            const selected = document.querySelector('input[name="answer"]:checked');
            if (selected) {
                answer = { answer_text: selected.value };
            }
            break;
            
        case 'checkbox':
            const checked = document.querySelectorAll('input[name="answer-check"]:checked');
            if (checked.length > 0) {
                answer = { answer_options: Array.from(checked).map(c => c.value) };
            }
            break;
            
        case 'text':
            const textValue = document.getElementById('text-answer').value.trim();
            if (textValue) {
                answer = { answer_text: textValue };
            }
            break;
            
        case 'slider':
            const sliderValue = document.getElementById('slider-answer').value;
            answer = { answer_number: parseInt(sliderValue) };
            break;
            
        case 'emoji':
            const selectedEmoji = document.querySelector('.emoji-btn.selected');
            if (selectedEmoji) {
                answer = { answer_emoji: selectedEmoji.dataset.value };
            }
            break;
            
        case 'dropdown':
            const dropdownValue = document.getElementById('dropdown-answer').value;
            if (dropdownValue) {
                answer = { answer_text: dropdownValue };
            }
            break;
    }
    
    if (!answer) {
        alert('답변을 선택해주세요.');
        APP_STATE.isSubmitting = false;
        return;
    }
    
    // 응답 시간 계산
    answer.response_time_ms = Date.now() - (state.timerEnd - (questionData.timer_seconds * 1000));
    answer.submitted_at = Date.now();
    
    // 응답 저장
    const responseData = {
        user_id: APP_STATE.userInfo.userId,
        question_id: state.currentQuestion,
        answer: answer.answer || answer,
        answer_text: answer.answer_text || answer.answer || answer,
        answer_options: answer.answer_options || null,
        response_time_ms: Date.now() - startTime
    };
    
    // Supabase 사용 가능한 경우 저장
    if (typeof SupabaseSync !== 'undefined' && SupabaseSync.useSupabase) {
        await SupabaseSync.saveResponse(responseData);
    } else {
        if (!responses[state.currentQuestion]) {
            responses[state.currentQuestion] = {};
        }
        responses[state.currentQuestion][APP_STATE.userInfo.userId] = responseData;
        localStorage.setItem(STORAGE_KEYS.RESPONSES, JSON.stringify(responses));
    }
    
    // 실시간 업데이트 트리거 (브로드캐스트 이벤트)
    window.dispatchEvent(new CustomEvent('responseUpdated', {
        detail: {
            questionId: state.currentQuestion,
            userId: APP_STATE.userInfo.userId,
            answer: answer,
            timestamp: Date.now()
        }
    }));
    
    // 활동 로그
    const activityLog = {
        user_id: APP_STATE.userInfo.userId,
        action_type: 'answered',
        question_id: state.currentQuestion,
        metadata: { answer_type: questionData.question_type },
        created_at: Date.now()
    };
    
    const logs = JSON.parse(localStorage.getItem('activity_logs') || '[]');
    logs.push(activityLog);
    localStorage.setItem('activity_logs', JSON.stringify(logs));
    
    // 참여자 버블 즉시 업데이트
    updateParticipantsBubbles();
    
    // 제출 완료 화면
    showSubmittedScreen(formatAnswer(answer, questionData.question_type));
}

// 제출 완료 화면
function showSubmittedScreen(answerText) {
    // 제출 플래그 해제
    APP_STATE.isSubmitting = false;
    
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('submitted-screen').classList.add('active');
    
    if (answerText) {
        document.getElementById('submitted-answer').textContent = answerText;
    }
    
    // 간단한 통계 표시
    const state = JSON.parse(localStorage.getItem(STORAGE_KEYS.SURVEY_STATE) || '{}');
    const responses = JSON.parse(localStorage.getItem(STORAGE_KEYS.RESPONSES) || '{}');
    const participants = JSON.parse(localStorage.getItem(STORAGE_KEYS.PARTICIPANTS) || '[]');
    
    if (state.currentQuestion && responses[state.currentQuestion]) {
        const answered = Object.keys(responses[state.currentQuestion]).length;
        const total = participants.length;
        const percentage = Math.round((answered / total) * 100);
        
        document.getElementById('quick-stats').innerHTML = `
            <div class="quick-stat">
                <span>${answered}/${total}명 답변 완료</span>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }
    
    // 대기 화면으로 전환하면서 실시간 통계 표시
    setTimeout(() => {
        // 이미 다른 화면으로 전환되었으면 무시
        const currentScreen = document.querySelector('.screen.active')?.id;
        if (currentScreen === 'submitted-screen') {
            // submitted-screen에서 통계 보기로 전환했음을 표시
            APP_STATE.hasShownStats = true;
            showWaitingScreenWithStats();
        }
    }, 1000); // 1초 후 통계 화면으로 전환
}

// 대기 화면
function showWaitingScreen() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('waiting-screen').classList.add('active');
    
    // 통계 업데이트 중지
    if (APP_STATE.statsUpdateInterval) {
        clearInterval(APP_STATE.statsUpdateInterval);
        APP_STATE.statsUpdateInterval = null;
    }
    
    // 로더와 메시지 다시 표시
    const loader = document.querySelector('#waiting-screen .loader');
    if (loader) loader.style.display = 'block';
    
    const waitingContent = document.querySelector('#waiting-screen .waiting-content h2');
    const waitingDesc = document.querySelector('#waiting-screen .waiting-content p');
    if (waitingContent) {
        waitingContent.style.display = 'block';
        waitingContent.textContent = '퀴즈가 곧 시작됩니다';
    }
    if (waitingDesc) {
        waitingDesc.style.display = 'block';
        waitingDesc.textContent = '관리자가 문제를 준비하고 있습니다...';
    }
    
    // 실시간 통계 숨기기
    const statsDiv = document.getElementById('realtime-stats');
    if (statsDiv) {
        statsDiv.style.display = 'none';
    }
}

// 대기 화면에 실시간 통계 표시
function showWaitingScreenWithStats() {
    const statsDiv = document.getElementById('realtime-stats');
    
    // 이미 통계를 보고 있으면 아무것도 하지 않음
    if (statsDiv && statsDiv.style.display === 'block') {
        return;
    }
    
    // 화면 전환이 필요한 경우만 처리
    const currentScreen = document.querySelector('.screen.active');
    const waitingScreen = document.getElementById('waiting-screen');
    
    // 대기 화면이 아닌 경우에만 전환
    if (currentScreen !== waitingScreen) {
        // 현재 화면만 비활성화
        if (currentScreen) {
            currentScreen.classList.remove('active');
        }
        waitingScreen.classList.add('active');
    }
    
    // 통계 영역 표시 (한 번만 실행)
    if (statsDiv) {
        // 로더와 메시지 숨기기 (한 번만)
        const loader = document.querySelector('#waiting-screen .loader');
        const waitingContent = document.querySelector('#waiting-screen .waiting-content h2');
        const waitingDesc = document.querySelector('#waiting-screen .waiting-content p');
        
        if (loader && loader.style.display !== 'none') {
            loader.style.display = 'none';
        }
        if (waitingContent && waitingContent.style.display !== 'none') {
            waitingContent.style.display = 'none';
        }
        if (waitingDesc && waitingDesc.style.display !== 'none') {
            waitingDesc.style.display = 'none';
        }
        
        statsDiv.style.display = 'block';
        
        // 기존 차트가 있으면 제거 (새로운 문제 시작시)
        if (APP_STATE.waitingChart && APP_STATE.lastStatsQuestion !== APP_STATE.currentQuestion) {
            APP_STATE.waitingChart.destroy();
            APP_STATE.waitingChart = null;
        }
        
        // 현재 문제 번호 저장
        APP_STATE.lastStatsQuestion = APP_STATE.currentQuestion;
        
        // 응답 수 초기화 (새로운 통계 표시 시작)
        APP_STATE.lastResponseCount = -1;
        
        // 통계 업데이트 (처음엔 강제 업데이트)
        updateRealtimeStats(true);
        
        // 실시간 업데이트 시작 - 주기적 체크
        if (APP_STATE.statsUpdateInterval) {
            clearInterval(APP_STATE.statsUpdateInterval);
        }
        APP_STATE.statsUpdateInterval = setInterval(updateRealtimeStats, 5000); // 5초마다 체크 (변경시에만 업데이트됨)
    } else {
        console.error('realtime-stats div not found');
    }
}

// 실시간 통계 업데이트
function updateRealtimeStats(forceUpdate = false) {
    const state = JSON.parse(localStorage.getItem(STORAGE_KEYS.SURVEY_STATE) || '{}');
    const responses = JSON.parse(localStorage.getItem(STORAGE_KEYS.RESPONSES) || '{}');
    const participants = JSON.parse(localStorage.getItem(STORAGE_KEYS.PARTICIPANTS) || '[]');
    
    if (!state.currentQuestion || state.currentQuestion === 0) {
        console.log('No current question to show stats for');
        return;
    }
    
    // 현재 문제 정보 - APP_STATE.questions 배열에서 찾기
    const questionData = APP_STATE.questions ? 
        APP_STATE.questions[state.currentQuestion - 1] : null;
    
    if (!questionData) {
        console.log('Question data not found for question:', state.currentQuestion);
        return;
    }
    
    const currentResponses = responses[state.currentQuestion] || {};
    const totalResponses = Object.keys(currentResponses).length;
    
    // 응답 수가 변경되었는지 확인
    if (!forceUpdate && APP_STATE.lastResponseCount === totalResponses) {
        // 데이터가 변경되지 않았으면 업데이트하지 않음
        return;
    }
    
    // 응답 수 저장
    APP_STATE.lastResponseCount = totalResponses;
    
    // 통계 정보 업데이트 (값이 변경된 경우만)
    const questionNumElem = document.getElementById('stats-question-num');
    const questionTextElem = document.getElementById('stats-question-text');
    
    if (questionNumElem && questionNumElem.textContent !== `Q${state.currentQuestion}`) {
        questionNumElem.textContent = `Q${state.currentQuestion}`;
    }
    if (questionTextElem && questionTextElem.textContent !== questionData.question_text) {
        questionTextElem.textContent = questionData.question_text;
    }
    
    const totalParticipants = participants.length;
    const responseRate = totalParticipants > 0 ? Math.round((totalResponses / totalParticipants) * 100) : 0;
    
    // 값이 변경된 경우만 DOM 업데이트
    const totalResponsesElem = document.getElementById('total-responses');
    const responseRateElem = document.getElementById('response-rate');
    
    if (totalResponsesElem && totalResponsesElem.textContent !== totalResponses.toString()) {
        totalResponsesElem.textContent = totalResponses;
    }
    if (responseRateElem && responseRateElem.textContent !== responseRate.toString()) {
        responseRateElem.textContent = responseRate;
    }
    
    // 답변별 통계 계산
    const answerStats = {};
    
    Object.values(currentResponses).forEach(response => {
        if (questionData.question_type === 'radio' || 
            questionData.question_type === 'dropdown' || 
            questionData.question_type === 'emoji') {
            const answer = response.answer_text || response.selected_option;
            if (answer) {
                answerStats[answer] = (answerStats[answer] || 0) + 1;
            }
        } else if (questionData.question_type === 'checkbox') {
            if (response.selected_options && Array.isArray(response.selected_options)) {
                response.selected_options.forEach(option => {
                    answerStats[option] = (answerStats[option] || 0) + 1;
                });
            }
        } else if (questionData.question_type === 'voting') {
            const voted = response.voted_for || response.answer_text;
            if (voted) {
                answerStats[voted] = (answerStats[voted] || 0) + 1;
            }
        }
    });
    
    // 답변 통계가 변경되었는지 확인
    const statsKey = JSON.stringify(answerStats);
    if (APP_STATE.lastStatsKey !== statsKey || forceUpdate) {
        APP_STATE.lastStatsKey = statsKey;
        // 차트 업데이트
        updateWaitingChart(answerStats, questionData);
    }
    
    // 요약 통계 표시 (데이터가 변경된 경우만)
    const summaryDiv = document.getElementById('stats-summary');
    if (summaryDiv && Object.keys(answerStats).length > 0) {
        const sortedStats = Object.entries(answerStats).sort((a, b) => b[1] - a[1]);
        const newStatsKey = JSON.stringify(sortedStats);
        
        // 이전 통계와 다른 경우만 업데이트
        if (APP_STATE.lastSummaryKey !== newStatsKey) {
            APP_STATE.lastSummaryKey = newStatsKey;
            
            let summaryHTML = '<div class="stats-options">';
            
            sortedStats.forEach(([option, count]) => {
                const percentage = totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0;
                summaryHTML += `
                    <div class="stat-option">
                        <span class="option-text">${option}</span>
                        <div class="option-bar">
                            <div class="option-fill" style="width: ${percentage}%"></div>
                        </div>
                        <span class="option-count">${count}명 (${percentage}%)</span>
                    </div>
                `;
            });
            
            summaryHTML += '</div>';
            summaryDiv.innerHTML = summaryHTML;
        }
    }
}

// 대기 화면 차트 업데이트
function updateWaitingChart(answerStats, questionData) {
    const canvas = document.getElementById('waiting-chart');
    if (!canvas) return;
    
    const labels = Object.keys(answerStats);
    const data = Object.values(answerStats);
    
    if (labels.length === 0) return;
    
    // 차트 타입 결정
    const chartType = questionData.question_type === 'voting' ? 'bar' : 
                     labels.length <= 5 ? 'pie' : 'bar';
    
    // 기존 차트가 있고 데이터만 업데이트 가능한 경우
    if (APP_STATE.waitingChart && APP_STATE.waitingChart.config.type === chartType) {
        // 데이터만 업데이트 (애니메이션 없이)
        APP_STATE.waitingChart.data.labels = labels;
        APP_STATE.waitingChart.data.datasets[0].data = data;
        APP_STATE.waitingChart.update('none'); // 애니메이션 없이 업데이트
        return;
    }
    
    // 차트 타입이 변경되었거나 처음 생성하는 경우
    if (APP_STATE.waitingChart) {
        APP_STATE.waitingChart.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    
    APP_STATE.waitingChart = new Chart(ctx, {
        type: chartType,
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#4A90E2', '#FF6B9D', '#FFC107', '#4CAF50', 
                    '#9C27B0', '#FF5722', '#00BCD4', '#795548'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            animation: {
                duration: 500 // 첫 생성시만 애니메이션
            },
            plugins: {
                legend: {
                    display: chartType === 'pie',
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || context.parsed.y || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${value}명 (${percentage}%)`;
                        }
                    }
                }
            },
            scales: chartType === 'bar' ? {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            } : {}
        }
    });
}

// 종료 화면
function showFinishedScreen() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('finished-screen').classList.add('active');
    
    // 통계 계산
    const responses = JSON.parse(localStorage.getItem(STORAGE_KEYS.RESPONSES) || '{}');
    let answeredCount = 0;
    let totalTime = 0;
    let timeCount = 0;
    
    Object.entries(responses).forEach(([questionId, questionResponses]) => {
        if (questionResponses[APP_STATE.userInfo.userId]) {
            answeredCount++;
            const response = questionResponses[APP_STATE.userInfo.userId];
            if (response.response_time_ms) {
                totalTime += response.response_time_ms;
                timeCount++;
            }
        }
    });
    
    document.getElementById('answered-questions').textContent = answeredCount;
    
    if (timeCount > 0) {
        const avgTime = (totalTime / timeCount / 1000).toFixed(1);
        document.getElementById('avg-response-time').textContent = `${avgTime}초`;
    }
}

// Supabase 초기화 (기존 코드 호환)
function initSupabase() {
    if (typeof window.SUPABASE_URL !== 'undefined' && window.SUPABASE_URL) {
        try {
            window.supabaseClient = supabase.createClient(
                window.SUPABASE_URL,
                window.SUPABASE_ANON_KEY
            );
            return true;
        } catch (error) {
            console.error('Supabase 초기화 실패:', error);
            return false;
        }
    }
    return false;
}

// Storage 이벤트 리스너 - 다른 사용자의 응답 감지
window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEYS.RESPONSES) {
        // 통계 화면을 보고 있는 경우에만 업데이트
        const currentScreen = document.querySelector('.screen.active')?.id;
        const statsDiv = document.getElementById('realtime-stats');
        if (currentScreen === 'waiting-screen' && statsDiv && statsDiv.style.display !== 'none') {
            // 응답이 추가되었으므로 즉시 통계 업데이트
            updateRealtimeStats();
        }
    }
});

// 페이지 언로드시 정리
window.addEventListener('beforeunload', () => {
    clearInterval(APP_STATE.timerInterval);
    clearInterval(APP_STATE.statsUpdateInterval);
});

// 전역 함수로 내보내기
window.initUserScreen = initUserScreen;
window.showWaitingScreenWithStats = showWaitingScreenWithStats;
window.showQuestion = showQuestion;