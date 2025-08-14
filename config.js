// Supabase 설정
// 배포 환경에서는 환경변수 사용, 로컬에서는 직접 입력 가능

const SUPABASE_CONFIG = {
    // Vercel/Netlify 환경변수 또는 직접 입력
    // .env 파일의 값을 여기에 직접 복사해서 넣으세요
    url: window.SUPABASE_URL || 'https://zwncncdgrfhihnuynssc.supabase.co',
    anonKey: window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3bmNuY2RncmZoaWhudXluc3NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNTM0OTIsImV4cCI6MjA3MDcyOTQ5Mn0.j666CuNPbPPB6U7UC0IDQO7yMMeP_bf6M2PBTCoO12A'
};

// Supabase 클라이언트 초기화
let supabaseClient = null;

function initSupabase() {
    if (SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey) {
        supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        console.log('Supabase 연결 성공');
        return true;
    } else {
        console.log('Supabase 설정 없음 - LocalStorage 모드로 실행');
        return false;
    }
}