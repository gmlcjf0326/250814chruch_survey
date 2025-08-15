// Supabase 설정
// 로컬 개발용 기본값 (실제 값으로 변경하세요)
const DEFAULT_CONFIG = {
    url: 'https://your-project.supabase.co',  // 여기에 실제 Supabase URL 입력
    anonKey: 'your-anon-key-here'  // 여기에 실제 anon key 입력
};

// 설정 저장용 변수
let SUPABASE_CONFIG = {
    url: window.SUPABASE_URL || DEFAULT_CONFIG.url,
    anonKey: window.SUPABASE_ANON_KEY || DEFAULT_CONFIG.anonKey
};

// Netlify Functions에서 환경변수 가져오기 (Netlify 배포 시)
async function loadConfigFromNetlify() {
    try {
        // Netlify Functions 엔드포인트 호출
        const response = await fetch('/.netlify/functions/get-config');
        if (response.ok) {
            const config = await response.json();
            if (config.supabaseUrl && config.supabaseAnonKey) {
                SUPABASE_CONFIG.url = config.supabaseUrl;
                SUPABASE_CONFIG.anonKey = config.supabaseAnonKey;
                
                // 전역 변수로 설정
                window.SUPABASE_URL = config.supabaseUrl;
                window.SUPABASE_ANON_KEY = config.supabaseAnonKey;
                
                console.log('✅ Netlify 환경변수 로드 성공');
                
                // Supabase 재초기화
                initSupabase();
                
                // SupabaseSync 모듈 재초기화
                if (typeof SupabaseSync !== 'undefined') {
                    SupabaseSync.init();
                }
            }
        }
    } catch (error) {
        console.log('⚠️ Netlify Functions 사용 불가 - 로컬 설정 사용');
    }
}

// 전역 변수로 설정 (다른 스크립트에서 사용 가능)
window.SUPABASE_URL = SUPABASE_CONFIG.url;
window.SUPABASE_ANON_KEY = SUPABASE_CONFIG.anonKey;

// Supabase 클라이언트 초기화
let supabaseClient = null;

function initSupabase() {
    if (SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey) {
        try {
            if (typeof supabase !== 'undefined') {
                supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
                window.supabaseClient = supabaseClient; // 전역으로 사용 가능
                console.log('✅ Supabase 연결 성공');
                return true;
            } else {
                console.error('❌ Supabase SDK가 로드되지 않았습니다');
                return false;
            }
        } catch (error) {
            console.error('❌ Supabase 초기화 실패:', error);
            return false;
        }
    } else {
        console.log('⚠️ Supabase 설정 없음 - LocalStorage 모드로 실행');
        return false;
    }
}

// 페이지 로드 시 자동 초기화
document.addEventListener('DOMContentLoaded', async function() {
    // 먼저 로컬 설정으로 초기화 시도
    initSupabase();
    
    // Netlify 환경변수 로드 시도 (있으면 덮어씀)
    await loadConfigFromNetlify();
});