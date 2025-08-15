// Supabase 설정
// Netlify는 VITE_ 접두사 사용, 로컬은 직접 입력

// Netlify 환경변수를 window 객체에 주입하는 스크립트
// Netlify는 빌드 시점에 환경변수를 치환하지 않으므로 런타임에 접근
const getEnvVar = (key) => {
    // 다양한 방법으로 환경변수 접근 시도
    return (typeof process !== 'undefined' && process.env && process.env[key]) ||
           (typeof window !== 'undefined' && window[key]) ||
           (typeof globalThis !== 'undefined' && globalThis[key]) ||
           null;
};

const SUPABASE_CONFIG = {
    // Netlify 환경변수 또는 하드코딩된 값 사용
    url: getEnvVar('VITE_SUPABASE_URL') || 
         'https://zwncncdgrfhihnuynssc.supabase.co',
    anonKey: getEnvVar('VITE_SUPABASE_ANON_KEY') || 
             'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3bmNuY2RncmZoaWhudXluc3NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNTM0OTIsImV4cCI6MjA3MDcyOTQ5Mn0.j666CuNPbPPB6U7UC0IDQO7yMMeP_bf6M2PBTCoO12A'
};

// Supabase 클라이언트 초기화
let supabaseClient = null;

function initSupabase() {
    if (SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey) {
        supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        console.log('Supabase 연결 성공');
        console.log('URL:', SUPABASE_CONFIG.url);
        return true;
    } else {
        console.log('Supabase 설정 없음 - LocalStorage 모드로 실행');
        return false;
    }
}

// 디버깅용 - 설정 확인
console.log('[Config] Supabase URL:', SUPABASE_CONFIG.url);
console.log('[Config] Supabase Key 존재:', !!SUPABASE_CONFIG.anonKey);