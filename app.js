// alert("앱 스크립트 로드됨 (v1.1 - Fixed StartDate/Scale)");
console.log("Farm Price Tracker v1.1 Loaded");

// --- GLOBAL ERROR HANDLER ---
window.onerror = function (msg, url, line, col, error) {
    if (msg.toLowerCase().includes('script error')) {
        console.error('Script Error: See browser console for details.');
        return false; // Suppress alert
    }
    alert(`오류 발생!\n${msg}\nLine: ${line}`);
    return false;
};

// --- APP STATE ---
let RAW_LINES = [];
let ITEM_INDEX = {};
let GLOBAL_REA_PRICE_EOK = 0.166; // (레알, 강화) 최신 적정 시세 (억 단위, 기본값 0.166억 = 1,660만)
const FIXED_STONE_396_EOK = 1.2;  // 강화석 396개당 1.2억 고정
let currentCategory = 'equip';
let currentPartFilter = 'all'; // 'all' | '괭이' | '낫' | '물뿌' | '거삽' | '모삽' | '모자' | '상의' | '하의'
let currentTagFilter = 'all';
let currentAccTagFilter = 'all'; // 'all' | '에코' | '바람' | '활력' | '신속' | '재료' | '발굴' | '하레' | '특수' | '듀얼' | '갈갈'
let currentChartRange = 'all';
let currentYScale = 'normal';
let currentChartMode = 'curve'; // 'curve' (시세곡선) | 'compare' (원본비교)

const SORT_MODES = [
    { key: 'freq', label: '빈도순', desc: '거래량순', equipOnly: false },
    { key: 'korean', label: 'ㄱㄴㄷ순', desc: '이름순', equipOnly: false },
    { key: 'korean_desc', label: 'ㄱㄴㄷ 역순', desc: '이름 역순', equipOnly: false },
    { key: 'level_asc', label: '레벨제한순', desc: '낮은 렙제순', equipOnly: true },
    { key: 'level_desc', label: '레벨제한 역순', desc: '높은 렙제순', equipOnly: true }
];

let currentSortMode = (function () {
    try {
        const saved = localStorage.getItem('farm_sort_mode');
        if (['freq', 'korean', 'korean_desc', 'level_asc', 'level_desc'].includes(saved)) return saved;
    } catch (e) {}
    return 'freq';
})();
let currentChartData = [];
let currentAnalysis = null;
let priceChart = null;
let currentModalItem = null;
let currentModalVariant = null;
let currentSelectedCell = null; // { enc, dur, spotFair }
const HIDE_UNDER_3 = true; // 3개 미만 옵션 노출 안함

// ============================================================================
// ★ 1. 장비 정식 명칭 · 줄임말 · 렙제 · 부위 · 특수속성 통합 도감 DB
// ============================================================================
const EQUIP_ALIAS_TO_CANONICAL = {
    '팬모': '일팬모',
    '팬상': '일팬상',
    '팬하': '일팬하',
    '헬': '일헬',
    '슛': '일슛',
    '쫄': '일쫄',
    '썬': '일썬',
    '바지': '일바지',
    '증콤': '중콤'
};

const normalizeEquipKey = (rawName) => {
    const trimmed = (rawName || '').trim();
    return EQUIP_ALIAS_TO_CANONICAL[trimmed] || trimmed;
};

const COUPON_SET_NOTE = '<장터>에서 레알쿠폰으로 교환 가능한 쿠폰 장비입니다. 의상 3부위를 세트로 착용하면 강화레벨에 따라 세트 추가효과가 발생합니다.';

const EQUIP_META_DB = {
    // --- 일반 의상: 팬더 세트 (모자 56 / 상의 58 / 하의 57) ---
    '일팬모': { officialName: '팬더 모자', abbr: '일팬모, 팬모', level: 56, subType: '일반 의상', part: '모자', isSturdy: false, isSwift: false, isCoupon: false },
    '튼팬모': { officialName: '튼튼한 팬더 모자', abbr: '튼팬모', level: 56, subType: '일반 의상', part: '모자', isSturdy: true, isSwift: false, isCoupon: false },
    '기팬모': { officialName: '기술의 팬더 모자', abbr: '기팬모', level: 56, subType: '일반 의상', part: '모자', isSturdy: false, isSwift: false, isCoupon: false },
    '체팬모': { officialName: '체력의 팬더 모자', abbr: '체팬모', level: 56, subType: '일반 의상', part: '모자', isSturdy: false, isSwift: false, isCoupon: false },
    '일팬상': { officialName: '팬더 윗도리', abbr: '일팬상, 팬상', level: 58, subType: '일반 의상', part: '상의', isSturdy: false, isSwift: false, isCoupon: false },
    '튼팬상': { officialName: '튼튼한 팬더 윗도리', abbr: '튼팬상', level: 58, subType: '일반 의상', part: '상의', isSturdy: true, isSwift: false, isCoupon: false },
    '기팬상': { officialName: '기술의 팬더 윗도리', abbr: '기팬상', level: 58, subType: '일반 의상', part: '상의', isSturdy: false, isSwift: false, isCoupon: false },
    '체팬상': { officialName: '체력의 팬더 윗도리', abbr: '체팬상', level: 58, subType: '일반 의상', part: '상의', isSturdy: false, isSwift: false, isCoupon: false },
    '일팬하': { officialName: '팬더 아랫도리', abbr: '일팬하, 팬하', level: 57, subType: '일반 의상', part: '하의', isSturdy: false, isSwift: false, isCoupon: false },
    '튼팬하': { officialName: '튼튼한 팬더 아랫도리', abbr: '튼팬하', level: 57, subType: '일반 의상', part: '하의', isSturdy: true, isSwift: false, isCoupon: false },
    '기팬하': { officialName: '기술의 팬더 아랫도리', abbr: '기팬하', level: 57, subType: '일반 의상', part: '하의', isSturdy: false, isSwift: false, isCoupon: false },
    '체팬하': { officialName: '체력의 팬더 아랫도리', abbr: '체팬하', level: 57, subType: '일반 의상', part: '하의', isSturdy: false, isSwift: false, isCoupon: false },

    // --- 일반 의상: 헬멧/슈트/쫄쫄이 세트 (모자 64 / 상의 66 / 하의 65) ---
    '일헬': { officialName: '파랑/핑크 헬멧', abbr: '일헬, 헬', level: 64, subType: '일반 의상', part: '모자', isSturdy: false, isSwift: false, isCoupon: false },
    '튼헬': { officialName: '튼튼한 파랑/핑크 헬멧', abbr: '튼헬', level: 64, subType: '일반 의상', part: '모자', isSturdy: true, isSwift: false, isCoupon: false },
    '기헬': { officialName: '기술의 파랑/핑크 헬멧', abbr: '기헬', level: 64, subType: '일반 의상', part: '모자', isSturdy: false, isSwift: false, isCoupon: false },
    '체헬': { officialName: '체력의 파랑/핑크 헬멧', abbr: '체헬', level: 64, subType: '일반 의상', part: '모자', isSturdy: false, isSwift: false, isCoupon: false },
    '일슛': { officialName: '파랑/핑크 슈트', abbr: '일슛, 슛', level: 66, subType: '일반 의상', part: '상의', isSturdy: false, isSwift: false, isCoupon: false },
    '튼슛': { officialName: '튼튼한 파랑/핑크 슈트', abbr: '튼슛', level: 66, subType: '일반 의상', part: '상의', isSturdy: true, isSwift: false, isCoupon: false },
    '기슛': { officialName: '기술의 파랑/핑크 슈트', abbr: '기슛', level: 66, subType: '일반 의상', part: '상의', isSturdy: false, isSwift: false, isCoupon: false },
    '체슛': { officialName: '체력의 파랑/핑크 슈트', abbr: '체슛', level: 66, subType: '일반 의상', part: '상의', isSturdy: false, isSwift: false, isCoupon: false },
    '일쫄': { officialName: '파랑 쫄쫄이/핑크 레깅스', abbr: '일쫄, 쫄', level: 65, subType: '일반 의상', part: '하의', isSturdy: false, isSwift: false, isCoupon: false },
    '튼쫄': { officialName: '튼튼한 파랑 쫄쫄이/핑크 레깅스', abbr: '튼쫄', level: 65, subType: '일반 의상', part: '하의', isSturdy: true, isSwift: false, isCoupon: false },
    '기쫄': { officialName: '기술의 파랑 쫄쫄이/기술의 핑크 레깅스', abbr: '기쫄', level: 65, subType: '일반 의상', part: '하의', isSturdy: false, isSwift: false, isCoupon: false },
    '체쫄': { officialName: '체력의 파랑 쫄쫄이/체력의 핑크 레깅스', abbr: '체쫄', level: 65, subType: '일반 의상', part: '하의', isSturdy: false, isSwift: false, isCoupon: false },

    // --- 일반 의상: 70레벨 선글라스/셔츠/반바지 세트 (전부 70렙) ---
    '일썬': { officialName: '선글라스/파랑 머리띠', abbr: '일썬, 썬', level: 70, subType: '일반 의상', part: '모자', isSturdy: false, isSwift: false, isCoupon: false },
    '튼썬': { officialName: '튼튼한 선글라스/파랑 머리띠', abbr: '튼썬', level: 70, subType: '일반 의상', part: '모자', isSturdy: true, isSwift: false, isCoupon: false },
    '기썬': { officialName: '기술의 선글라스/기술의 파랑 머리띠', abbr: '기썬', level: 70, subType: '일반 의상', part: '모자', isSturdy: false, isSwift: false, isCoupon: false },
    '체썬': { officialName: '체력의 선글라스/체력의 파랑 머리띠', abbr: '체썬', level: 70, subType: '일반 의상', part: '모자', isSturdy: false, isSwift: false, isCoupon: false },
    '셔츠': { officialName: '하얀 셔츠/파란 블라우스', abbr: '셔츠', level: 70, subType: '일반 의상', part: '상의', isSturdy: false, isSwift: false, isCoupon: false },
    '튼셔츠': { officialName: '튼튼한 하얀 셔츠/파란 블라우스', abbr: '튼셔츠, 튼블라우스', level: 70, subType: '일반 의상', part: '상의', isSturdy: true, isSwift: false, isCoupon: false },
    '기셔츠': { officialName: '기술의 하얀 셔츠/기술의 파란 블라우스', abbr: '기셔츠', level: 70, subType: '일반 의상', part: '상의', isSturdy: false, isSwift: false, isCoupon: false },
    '체셔츠': { officialName: '체력의 하얀 셔츠/체력의 파란 블라우스', abbr: '체셔츠', level: 70, subType: '일반 의상', part: '상의', isSturdy: false, isSwift: false, isCoupon: false },
    '일바지': { officialName: '파란 반바지/파란 주름치마', abbr: '반바지, 파란치마, 일바지, 바지', level: 70, subType: '일반 의상', part: '하의', isSturdy: false, isSwift: false, isCoupon: false },
    '튼바지': { officialName: '튼튼한 파란 반바지/파란 주름치마', abbr: '튼바지, 튼반바지, 튼치마', level: 70, subType: '일반 의상', part: '하의', isSturdy: true, isSwift: false, isCoupon: false },
    '기바지': { officialName: '기술의 파란 반바지/기술의 파란 주름치마', abbr: '기바지, 기반바지, 기파란치마', level: 70, subType: '일반 의상', part: '하의', isSturdy: false, isSwift: false, isCoupon: false },
    '체바지': { officialName: '체력의 파란 반바지/체력의 파란 주름치마', abbr: '체바지, 체반바지, 체파란치마', level: 70, subType: '일반 의상', part: '하의', isSturdy: false, isSwift: false, isCoupon: false },

    // --- 일반 의상: 80레벨 네온 세트 (전부 80렙) ---
    '네온머리': { officialName: '네온 머리장식', abbr: '네온모, 네온머리', level: 80, subType: '일반 의상', part: '모자', isSturdy: false, isSwift: false, isCoupon: false },
    '튼네온머리': { officialName: '튼튼한 네온 머리장식', abbr: '튼네온모, 튼네온머리', level: 80, subType: '일반 의상', part: '모자', isSturdy: true, isSwift: false, isCoupon: false },
    '체네온머리': { officialName: '체력의 네온 머리장식', abbr: '체네온모, 체네온머리', level: 80, subType: '일반 의상', part: '모자', isSturdy: false, isSwift: false, isCoupon: false },
    '기네온머리': { officialName: '기술의 네온 머리장식', abbr: '기네온모, 기네온머리', level: 80, subType: '일반 의상', part: '모자', isSturdy: false, isSwift: false, isCoupon: false },
    '네온장갑': { officialName: '네온 장갑', abbr: '네온 장갑, 네온장갑', level: 80, subType: '일반 의상', part: '상의', isSturdy: false, isSwift: false, isCoupon: false },
    '튼네온장갑': { officialName: '튼튼한 네온 장갑', abbr: '튼네온 장갑, 튼네온장갑', level: 80, subType: '일반 의상', part: '상의', isSturdy: true, isSwift: false, isCoupon: false },
    '체네온장갑': { officialName: '체력의 네온 장갑', abbr: '체네온 장갑, 체네온장갑', level: 80, subType: '일반 의상', part: '상의', isSturdy: false, isSwift: false, isCoupon: false },
    '기네온장갑': { officialName: '기술의 네온 장갑', abbr: '기네온 장갑, 기네온장갑', level: 80, subType: '일반 의상', part: '상의', isSturdy: false, isSwift: false, isCoupon: false },
    '네온부츠': { officialName: '네온 부츠', abbr: '네온 부츠, 네온부츠', level: 80, subType: '일반 의상', part: '하의', isSturdy: false, isSwift: false, isCoupon: false },
    '튼네온부츠': { officialName: '튼튼한 네온 부츠', abbr: '튼네온 부츠, 튼네온부츠', level: 80, subType: '일반 의상', part: '하의', isSturdy: true, isSwift: false, isCoupon: false },
    '체네온부츠': { officialName: '체력의 네온 부츠', abbr: '체네온 부츠, 체네온부츠', level: 80, subType: '일반 의상', part: '하의', isSturdy: false, isSwift: false, isCoupon: false },
    '기네온부츠': { officialName: '기술의 네온 부츠', abbr: '기네온 부츠, 기네온부츠', level: 80, subType: '일반 의상', part: '하의', isSturdy: false, isSwift: false, isCoupon: false },

    // --- 쿠폰 장비 (메카닉=80렙 네온 동일, 고마초/토끼/개굴/도련=70렙 동일) ---
    '체메카머리': { officialName: '체력의 튼튼 메카닉 고글', abbr: '체메카닉, 체메카머리', level: 80, subType: '쿠폰 의상', part: '모자', isSturdy: true, isSwift: false, isCoupon: true, desc: COUPON_SET_NOTE + ' (메카닉 장비는 80레벨 네온 장비와 기능 동일)' },
    '체자켓': { officialName: '체력의 튼튼 메카닉 자켓', abbr: '체자켓', level: 80, subType: '쿠폰 의상', part: '상의', isSturdy: true, isSwift: false, isCoupon: true, desc: COUPON_SET_NOTE + ' (메카닉 장비는 80레벨 네온 장비와 기능 동일)' },
    '체메카닉 바지': { officialName: '체력의 튼튼 메카닉 바지', abbr: '체메카닉 바지', level: 80, subType: '쿠폰 의상', part: '하의', isSturdy: true, isSwift: false, isCoupon: true, desc: COUPON_SET_NOTE + ' (메카닉 장비는 80레벨 네온 장비와 기능 동일)' },
    '기메카닉': { officialName: '기술의 튼튼 메카닉 고글', abbr: '기메카닉', level: 80, subType: '쿠폰 의상', part: '모자', isSturdy: true, isSwift: false, isCoupon: true, desc: COUPON_SET_NOTE + ' (메카닉 장비는 80레벨 네온 장비와 기능 동일)' },
    '기자켓': { officialName: '기술의 튼튼 메카닉 자켓', abbr: '기자켓', level: 80, subType: '쿠폰 의상', part: '상의', isSturdy: true, isSwift: false, isCoupon: true, desc: COUPON_SET_NOTE + ' (메카닉 장비는 80레벨 네온 장비와 기능 동일)' },
    '기메카닉 바지': { officialName: '기술의 튼튼 메카닉 바지', abbr: '기메카닉 바지', level: 80, subType: '쿠폰 의상', part: '하의', isSturdy: true, isSwift: false, isCoupon: true, desc: COUPON_SET_NOTE + ' (메카닉 장비는 80레벨 네온 장비와 기능 동일)' },
    '기고마머리': { officialName: '기술의 고마초 모자', abbr: '기고마머리, 기고마모, 고마모, 고마머리', level: 90, subType: '쿠폰 의상', part: '모자', isSturdy: false, isSwift: false, isCoupon: true, desc: COUPON_SET_NOTE },
    '튼기고마머리': { officialName: '기술의 튼튼 고마초 모자', abbr: '튼기고마머리, 튼고마머리, 튼고마모', level: 90, subType: '쿠폰 의상', part: '모자', isSturdy: true, isSwift: false, isCoupon: true, desc: COUPON_SET_NOTE },
    '체고마머리': { officialName: '체력의 고마초 모자', abbr: '체고마머리, 체고마모, 고마모, 고마머리', level: 90, subType: '쿠폰 의상', part: '모자', isSturdy: false, isSwift: false, isCoupon: true, desc: COUPON_SET_NOTE },
    '기고마상의': { officialName: '기술의 고마초 스카프', abbr: '기고마상의, 기고마스카프, 고마상의, 고마스카프', level: 90, subType: '쿠폰 의상', part: '상의', isSturdy: false, isSwift: false, isCoupon: true, desc: COUPON_SET_NOTE },
    '체고마상의': { officialName: '체력의 고마초 스카프', abbr: '체고마상의, 체고마스카프, 고마상의, 고마스카프', level: 90, subType: '쿠폰 의상', part: '상의', isSturdy: false, isSwift: false, isCoupon: true, desc: COUPON_SET_NOTE },
    '기고마하의': { officialName: '기술의 고마초 꼬리', abbr: '기고마하의, 기고마꼬리, 고마하의, 고마꼬리', level: 90, subType: '쿠폰 의상', part: '하의', isSturdy: false, isSwift: false, isCoupon: true, desc: COUPON_SET_NOTE },
    '체고마하의': { officialName: '체력의 고마초 꼬리', abbr: '체고마하의, 체고마꼬리, 고마하의, 고마꼬리', level: 90, subType: '쿠폰 의상', part: '하의', isSturdy: false, isSwift: false, isCoupon: true, desc: COUPON_SET_NOTE },
    '기개굴모자': { officialName: '기술의 개구리 모자', abbr: '기개굴모자', level: 70, subType: '쿠폰 의상', part: '모자', isSturdy: false, isSwift: false, isCoupon: true, desc: COUPON_SET_NOTE + ' (70레벨 의상과 기능 동일)' },
    '체개굴모자': { officialName: '체력의 개구리 모자', abbr: '체개굴모자', level: 70, subType: '쿠폰 의상', part: '모자', isSturdy: false, isSwift: false, isCoupon: true, desc: COUPON_SET_NOTE + ' (70레벨 의상과 기능 동일)' },
    '체개굴하의': { officialName: '체력의 개구리 하의', abbr: '체개굴하의', level: 70, subType: '쿠폰 의상', part: '하의', isSturdy: false, isSwift: false, isCoupon: true, desc: COUPON_SET_NOTE + ' (70레벨 의상과 기능 동일)' },
    '기도련복건': { officialName: '기술의 도련님 복건', abbr: '기도련복건', level: 70, subType: '쿠폰 의상', part: '모자', isSturdy: false, isSwift: false, isCoupon: true, desc: COUPON_SET_NOTE + ' (70레벨 의상과 기능 동일)' },
    '체도련복건': { officialName: '체력의 도련님 복건', abbr: '체도련복건', level: 70, subType: '쿠폰 의상', part: '모자', isSturdy: false, isSwift: false, isCoupon: true, desc: COUPON_SET_NOTE + ' (70레벨 의상과 기능 동일)' },
    '도련저고리': { officialName: '도련님 저고리', abbr: '도련저고리', level: 70, subType: '쿠폰 의상', part: '상의', isSturdy: false, isSwift: false, isCoupon: true, desc: COUPON_SET_NOTE + ' (70레벨 의상과 기능 동일)' },
    '도련바지': { officialName: '도련님 바지', abbr: '도련바지', level: 70, subType: '쿠폰 의상', part: '하의', isSturdy: false, isSwift: false, isCoupon: true, desc: COUPON_SET_NOTE + ' (70레벨 의상과 기능 동일)' },
    '체도련바지': { officialName: '체력의 도련님 바지', abbr: '체도련바지', level: 70, subType: '쿠폰 의상', part: '하의', isSturdy: false, isSwift: false, isCoupon: true, desc: COUPON_SET_NOTE + ' (70레벨 의상과 기능 동일)' },

    // --- 농기구: 괭이 ---
    '다마': { officialName: '다마스커스 괭이', abbr: '다마, 다마괭', level: 39, subType: '농기구', part: '괭이', isSturdy: false, isSwift: false, isCoupon: false },
    '튼다마': { officialName: '튼튼한 다마스커스 괭이', abbr: '튼다마, 튼다마괭', level: 39, subType: '농기구', part: '괭이', isSturdy: true, isSwift: false, isCoupon: false },
    '에로괭이': { officialName: '에로스의 괭이', abbr: '에로괭, 에로괭이', level: 67, subType: '농기구', part: '괭이', isSturdy: false, isSwift: false, isCoupon: false },
    '튼에로괭이': { officialName: '튼튼한 에로스의 괭이', abbr: '튼에로괭, 튼에로괭이', level: 67, subType: '농기구', part: '괭이', isSturdy: true, isSwift: false, isCoupon: false },
    '크리괭이': { officialName: '크리스탈 괭이', abbr: '크리괭, 크리괭이', level: 70, subType: '농기구', part: '괭이', isSturdy: false, isSwift: false, isCoupon: false },
    '튼크리괭이': { officialName: '튼튼한 크리스탈 괭이', abbr: '튼크리괭, 튼크리괭이', level: 70, subType: '농기구', part: '괭이', isSturdy: true, isSwift: false, isCoupon: false },

    // --- 농기구: 거름삽 ---
    '에로거삽': { officialName: '에로스의 거름삽', abbr: '에로삽, 에로거, 에로거삽', level: 64, subType: '농기구', part: '거름삽', isSturdy: false, isSwift: false, isCoupon: false },
    '튼에로거삽': { officialName: '튼튼한 에로스의 거름삽', abbr: '튼에로삽, 튼에로거, 튼에로거삽', level: 64, subType: '농기구', part: '거름삽', isSturdy: true, isSwift: false, isCoupon: false },
    '신에로거삽': { officialName: '신속한 에로스의 거름삽', abbr: '신에로삽, 신에로거, 신에로거삽', level: 62, subType: '농기구', part: '거름삽', isSturdy: false, isSwift: true, isCoupon: false, desc: '신속(신) 접두사 적용으로 기본 에로스의 거름삽(64렙) 대비 -2레벨(62렙)이 적용됩니다.' },
    '크리거삽': { officialName: '크리스탈 거름삽', abbr: '크리삽, 크리거, 크리거삽', level: 70, subType: '농기구', part: '거름삽', isSturdy: false, isSwift: false, isCoupon: false },
    '튼크리거삽': { officialName: '튼튼한 크리스탈 거름삽', abbr: '튼크리삽, 튼크리거, 튼크리거삽', level: 70, subType: '농기구', part: '거름삽', isSturdy: true, isSwift: false, isCoupon: false },
    '신크리거삽': { officialName: '신속한 크리스탈 거름삽', abbr: '신크리삽, 신크리거, 신크리거삽', level: 70, subType: '농기구', part: '거름삽', isSturdy: false, isSwift: true, isCoupon: false },
    '네온거삽': { officialName: '네온 거름삽', abbr: '네온삽, 네온거, 네온거삽', level: 80, subType: '농기구', part: '거름삽', isSturdy: false, isSwift: false, isCoupon: false },
    '튼네온거삽': { officialName: '튼튼한 네온 거름삽', abbr: '튼네온삽, 튼네온거, 튼네온거삽', level: 80, subType: '농기구', part: '거름삽', isSturdy: true, isSwift: false, isCoupon: false },
    '신네온거삽': { officialName: '신속한 네온 거름삽', abbr: '신네온삽, 신네온거, 신네온거삽', level: 80, subType: '농기구', part: '거름삽', isSturdy: false, isSwift: true, isCoupon: false },
    '신냥거삽': { officialName: '신속한 냥냥 거름삽', abbr: '신냥삽, 신냥거, 신냥거삽', level: 90, subType: '농기구', part: '거름삽', isSturdy: false, isSwift: true, isCoupon: true },

    // --- 농기구: 모종삽 ---
    '이리모삽': { officialName: '이리스의 모종삽', abbr: '이리모, 이리모삽', level: 54, subType: '농기구', part: '모종삽', isSturdy: false, isSwift: false, isCoupon: false },
    '신이리모삽': { officialName: '신속한 이리스의 모종삽', abbr: '신이리모, 신이리모삽', level: 52, subType: '농기구', part: '모종삽', isSturdy: false, isSwift: true, isCoupon: true, desc: '신속(신) 접두사 적용으로 기본 이리스의 모종삽(54렙) 대비 -2레벨(52렙)이 적용됩니다.' },
    '아프모': { officialName: '아프로디테의 모종삽', abbr: '아프모', level: 58, subType: '농기구', part: '모종삽', isSturdy: false, isSwift: false, isCoupon: false },
    '에로모삽': { officialName: '에로스 모종삽', abbr: '에로모, 에로모삽', level: 68, subType: '농기구', part: '모종삽', isSturdy: false, isSwift: false, isCoupon: false },
    '크리모삽': { officialName: '크리스탈 모종삽', abbr: '크리모, 크리모삽', level: 70, subType: '농기구', part: '모종삽', isSturdy: false, isSwift: false, isCoupon: false },
    '튼크리모삽': { officialName: '튼튼한 크리스탈 모종삽', abbr: '튼크리모, 튼크리모삽', level: 70, subType: '농기구', part: '모종삽', isSturdy: true, isSwift: false, isCoupon: false },
    '신크리모삽': { officialName: '신속한 크리스탈 모종삽', abbr: '신크리모, 신크리모삽', level: 70, subType: '농기구', part: '모종삽', isSturdy: false, isSwift: true, isCoupon: false },
    '네온모삽': { officialName: '네온 모종삽', abbr: '네온모삽', level: 80, subType: '농기구', part: '모종삽', isSturdy: false, isSwift: false, isCoupon: false },
    '신네온모삽': { officialName: '신속한 네온 모종삽', abbr: '신네온모삽', level: 80, subType: '농기구', part: '모종삽', isSturdy: false, isSwift: true, isCoupon: false },

    // --- 농기구: 낫 ---
    '신이리낫': { officialName: '신속한 이리스의 낫', abbr: '신이리낫', level: 52, subType: '농기구', part: '낫', isSturdy: false, isSwift: true, isCoupon: true, desc: '신속(신) 접두사 적용으로 기본 이리스의 낫(54렙) 대비 -2레벨(52렙)이 적용됩니다.' },
    '크로낫': { officialName: '크로노스의 낫', abbr: '크로낫', level: 56, subType: '농기구', part: '낫', isSturdy: false, isSwift: false, isCoupon: false },
    '에로낫': { officialName: '에로스의 낫', abbr: '에로낫', level: 66, subType: '농기구', part: '낫', isSturdy: false, isSwift: false, isCoupon: false },
    '튼에로낫': { officialName: '튼튼한 에로스의 낫', abbr: '튼에로낫', level: 66, subType: '농기구', part: '낫', isSturdy: true, isSwift: false, isCoupon: false },
    '크리낫': { officialName: '크리스탈 낫', abbr: '크리낫', level: 70, subType: '농기구', part: '낫', isSturdy: false, isSwift: false, isCoupon: false },
    '튼크리낫': { officialName: '튼튼한 크리스탈 낫', abbr: '튼크리낫', level: 70, subType: '농기구', part: '낫', isSturdy: true, isSwift: false, isCoupon: false },
    '신크리낫': { officialName: '신속한 크리스탈 낫', abbr: '신크리낫', level: 70, subType: '농기구', part: '낫', isSturdy: false, isSwift: true, isCoupon: false },
    '튼네온낫': { officialName: '튼튼한 네온 낫', abbr: '튼네온낫', level: 80, subType: '농기구', part: '낫', isSturdy: true, isSwift: false, isCoupon: false },

    // --- 농기구: 물뿌리개 ---
    '신이리물뿌': { officialName: '신속한 이리스의 물뿌리개', abbr: '신이리물, 신이리물뿌', level: 52, subType: '농기구', part: '물뿌리개', isSturdy: false, isSwift: true, isCoupon: true, desc: '신속(신) 접두사 적용으로 기본 이리스의 물뿌리개(54렙) 대비 -2레벨(52렙)이 적용됩니다.' },
    '포세': { officialName: '포세이돈 물뿌리개', abbr: '포세, 포세물', level: 55, subType: '농기구', part: '물뿌리개', isSturdy: false, isSwift: false, isCoupon: false },
    '신포세': { officialName: '신속한 포세이돈 물뿌리개', abbr: '신포세, 신포세물', level: 53, subType: '농기구', part: '물뿌리개', isSturdy: false, isSwift: true, isCoupon: false, desc: '신속(신) 접두사 적용으로 기본 포세이돈 물뿌리개(55렙) 대비 -2레벨(53렙)이 적용됩니다.' },
    '에로물뿌': { officialName: '에로스의 물뿌리개', abbr: '에로물, 에로물뿌', level: 65, subType: '농기구', part: '물뿌리개', isSturdy: false, isSwift: false, isCoupon: false },
    '신에로물뿌': { officialName: '신속한 에로스의 물뿌리개', abbr: '신에로물, 신에로물뿌', level: 63, subType: '농기구', part: '물뿌리개', isSturdy: false, isSwift: true, isCoupon: false, desc: '신속(신) 접두사 적용으로 기본 에로스의 물뿌리개(65렙) 대비 -2레벨(63렙)이 적용됩니다.' },
    '크리물뿌': { officialName: '크리스탈 물뿌리개', abbr: '크리물, 크리물뿌', level: 70, subType: '농기구', part: '물뿌리개', isSturdy: false, isSwift: false, isCoupon: false },
    '신크리물뿌': { officialName: '신속한 크리스탈 물뿌리개', abbr: '신크리물, 신크리물뿌', level: 70, subType: '농기구', part: '물뿌리개', isSturdy: false, isSwift: true, isCoupon: false },
    '네온물뿌': { officialName: '네온 물뿌리개', abbr: '네온물, 네온물뿌', level: 80, subType: '농기구', part: '물뿌리개', isSturdy: false, isSwift: false, isCoupon: false },
    '신네온물뿌': { officialName: '신속한 네온 물뿌리개', abbr: '신네온물, 신네온물뿌', level: 80, subType: '농기구', part: '물뿌리개', isSturdy: false, isSwift: true, isCoupon: false },
    '신냥물뿌': { officialName: '신속한 냥냥 물뿌리개', abbr: '신냥물, 신냥물뿌', level: 90, subType: '농기구', part: '물뿌리개', isSturdy: false, isSwift: true, isCoupon: true },
    '튼쾌냥물뿌': { officialName: '쾌속의 튼튼 냥냥 물뿌리개', abbr: '튼쾌냥물뿌, 쾌튼냥물뿌, 쾌냥물뿌', level: 90, subType: '농기구', part: '물뿌리개', isSturdy: true, isSwift: true, isCoupon: true },

    // --- 농기계: 로터리 (51 / 60 / 65 / 75) ---
    '일로': { officialName: '로터리', abbr: '일로', level: 51, subType: '농기계', part: '로터리', isSturdy: false, isSwift: false, isCoupon: false },
    '중로': { officialName: '중형 로터리', abbr: '중로', level: 60, subType: '농기계', part: '로터리', isSturdy: false, isSwift: false, isCoupon: false },
    '대로': { officialName: '대형 로터리', abbr: '대로', level: 65, subType: '농기계', part: '로터리', isSturdy: false, isSwift: false, isCoupon: false },
    '크로': { officialName: '크리스탈(특대형) 로터리', abbr: '크로, 특로', level: 75, subType: '농기계', part: '로터리', isSturdy: false, isSwift: false, isCoupon: false },

    // --- 농기계: 퇴비 살포기 (52 / 57 / 63 / 73) ---
    '일퇴': { officialName: '퇴비 살포기', abbr: '일퇴', level: 52, subType: '농기계', part: '퇴비 살포기', isSturdy: false, isSwift: false, isCoupon: false },
    '중퇴': { officialName: '중형 퇴비 살포기', abbr: '중퇴', level: 57, subType: '농기계', part: '퇴비 살포기', isSturdy: false, isSwift: false, isCoupon: false },
    '대퇴': { officialName: '대형 퇴비 살포기', abbr: '대퇴', level: 63, subType: '농기계', part: '퇴비 살포기', isSturdy: false, isSwift: false, isCoupon: false },
    '크퇴': { officialName: '크리스탈(특대형) 퇴비 살포기', abbr: '크퇴, 특퇴', level: 73, subType: '농기계', part: '퇴비 살포기', isSturdy: false, isSwift: false, isCoupon: false },

    // --- 농기계: 파종기 (53 / 61 / 66 / 76) ---
    '일파': { officialName: '파종기', abbr: '일파', level: 53, subType: '농기계', part: '파종기', isSturdy: false, isSwift: false, isCoupon: false },
    '중파': { officialName: '중형 파종기', abbr: '중파', level: 61, subType: '농기계', part: '파종기', isSturdy: false, isSwift: false, isCoupon: false },
    '대파': { officialName: '대형 파종기', abbr: '대파', level: 66, subType: '농기계', part: '파종기', isSturdy: false, isSwift: false, isCoupon: false },
    '크파': { officialName: '크리스탈(특대형) 파종기', abbr: '크파, 특파', level: 76, subType: '농기계', part: '파종기', isSturdy: false, isSwift: false, isCoupon: false },

    // --- 농기계: 콤바인 (54 / 59 / 64 / 74) ---
    '일콤': { officialName: '콤바인', abbr: '일콤', level: 54, subType: '농기계', part: '콤바인', isSturdy: false, isSwift: false, isCoupon: false },
    '중콤': { officialName: '중형 콤바인', abbr: '중콤', level: 59, subType: '농기계', part: '콤바인', isSturdy: false, isSwift: false, isCoupon: false },
    '대콤': { officialName: '대형 콤바인', abbr: '대콤', level: 64, subType: '농기계', part: '콤바인', isSturdy: false, isSwift: false, isCoupon: false },
    '크콤': { officialName: '크리스탈(특대형) 콤바인', abbr: '크콤, 특콤', level: 74, subType: '농기계', part: '콤바인', isSturdy: false, isSwift: false, isCoupon: false }
};

const getEquipMeta = (rawName) => {
    const key = normalizeEquipKey(rawName);
    let meta = EQUIP_META_DB[key] ? { key, ...EQUIP_META_DB[key] } : null;

    if (!meta) {
        const isSturdy = key.startsWith('튼') || key.includes('메카');
        const isSwift = key.startsWith('신') || key.includes('쾌');
        let level = 70;
        if (key.includes('냥') || key.includes('고마')) level = 90;
        else if (key.includes('네온') || key.includes('메카')) level = 80;
        else if (key.includes('크리')) level = 70;
        else if (key.includes('이리')) level = isSwift ? 52 : 54;
        meta = {
            key,
            officialName: key,
            abbr: key,
            level,
            subType: '장비',
            part: '기타',
            isSturdy,
            isSwift,
            isCoupon: false
        };
    }

    // --- 동적 속성 정밀 판정 (접두어 & 쿠폰 & 가족거래) ---
    const offName = meta.officialName || meta.key;

    // 1. 기술 (isTech) & 체력 (isHp)
    const isTech = Boolean(meta.isTech || meta.key.startsWith('기') || meta.key.includes('튼기') || offName.includes('기술의') || offName.startsWith('기술'));
    const isHp = Boolean(meta.isHp || meta.key.startsWith('체') || offName.includes('체력의') || offName.startsWith('체력'));

    // 2. 튼튼 (isSturdy)
    const isSturdy = Boolean(meta.isSturdy || meta.key.startsWith('튼') || meta.key.includes('메카') || offName.includes('튼튼'));

    // 3. 신속 / 쾌속 (isSwift)
    const isSwift = Boolean(meta.isSwift || meta.key.startsWith('신') || meta.key.includes('쾌') || offName.includes('신속') || offName.includes('쾌속'));
    const isKae = Boolean(meta.key.includes('쾌') || offName.includes('쾌속'));

    // 4. 쿠폰장비 (isCoupon)
    // "냥 들어간거, 신이리(그냥 이리는 아님), 고마 붙은거, 메카 붙은건 쿠폰장비다."
    let isCoupon = Boolean(meta.isCoupon);
    if (meta.key.includes('냥') || offName.includes('냥')) {
        isCoupon = true;
    } else if (meta.key.includes('신이리') || (meta.key.includes('이리') && isSwift) || (offName.includes('이리스') && isSwift)) {
        isCoupon = true;
    } else if (meta.key.includes('고마') || offName.includes('고마초')) {
        isCoupon = true;
    } else if (meta.key.includes('메카') || offName.includes('메카닉') || meta.key === '기자켓' || meta.key === '체자켓') {
        isCoupon = true;
    } else if (meta.key.includes('이리') || offName.includes('이리스')) {
        isCoupon = false; // 일반 이리스는 제외 ("그냥 이리는 아님")
    }

    // 5. 가족거래 (isFamilyTrade)
    // "튼튼이랑 쾌속, 튼튼 기술, 튼튼체력같이 접두어가 2개 이상 붙는다? 이건 가족거래다."
    const prefixCount = (isSturdy ? 1 : 0) + (isSwift ? 1 : 0) + (isTech ? 1 : 0) + (isHp ? 1 : 0);
    const isFamilyTrade = prefixCount >= 2;

    meta.isTech = isTech;
    meta.isHp = isHp;
    meta.isSturdy = isSturdy;
    meta.isSwift = isSwift;
    meta.isKae = isKae;
    meta.isCoupon = isCoupon;
    meta.isFamilyTrade = isFamilyTrade;

    return meta;
};

// --- 공통 배지 및 특수속성 설명 생성 헬퍼 ---
const renderEquipBadgesHtml = (m) => {
    if (!m) return '';
    const badges = [];

    // 1. 가족거래 태그 (최우선 배치, 가장 돋보이는 강렬한 배색)
    if (m.isFamilyTrade) {
        badges.push(
            `<span class="shrink-0 px-2 py-0.5 rounded-md bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white border border-rose-500 text-[10px] md:text-[11px] font-black tracking-tight shadow-xs whitespace-nowrap">가족거래</span>`
        );
    }

    // 2. 기술
    if (m.isTech) {
        badges.push(
            `<span class="shrink-0 px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-bold whitespace-nowrap">기술</span>`
        );
    }

    // 3. 체력
    if (m.isHp) {
        badges.push(
            `<span class="shrink-0 px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200 text-[10px] font-bold whitespace-nowrap">체력</span>`
        );
    }

    // 4. 튼튼
    if (m.isSturdy) {
        badges.push(
            `<span class="shrink-0 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold whitespace-nowrap">튼튼</span>`
        );
    }

    // 5. 신속 / 쾌속
    if (m.isSwift) {
        const swiftLabel = m.isKae ? '쾌속' : '신속';
        badges.push(
            `<span class="shrink-0 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold whitespace-nowrap">${swiftLabel}</span>`
        );
    }

    // 6. 쿠폰장비
    if (m.isCoupon) {
        badges.push(
            `<span class="shrink-0 px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold whitespace-nowrap">쿠폰장비</span>`
        );
    }

    return badges.join('');
};

const getSpecialAttrDesc = (m) => {
    if (!m) return '일반';
    const texts = [];
    if (m.isFamilyTrade) texts.push('가족 거래 전용(2중 접두어 이상 계정 귀속)');
    if (m.isTech) texts.push('기술 특화');
    if (m.isHp) texts.push('체력 특화');
    if (m.isSturdy) texts.push('튼튼한 장비(강화 성공률 상승)');
    if (m.isSwift) texts.push(m.isKae ? '쾌속 장비(작업시간 단축)' : '신속 장비(작업시간 단축)');
    if (m.isCoupon) texts.push('레알쿠폰 세트장비');
    if (texts.length === 0) texts.push('일반 내구');
    return texts.join(' · ');
};

// ============================================================================
// ★ 일반 <-> 튼튼 종결 장비 (10_10, 9_9, 8_8, 7_7) 암묵적 시세 통합 정의
// ============================================================================
const COMPLETED_ENHANCE_CELLS = new Set(['10_10', '9_9', '8_8', '7_7']);

const EQUIP_PARTNER_MAP = {
    // 낫
    '크리낫': '튼크리낫',
    '튼크리낫': '크리낫',
    '에로낫': '튼에로낫',
    '튼에로낫': '에로낫',

    // 모종삽 / 거름삽
    '크리모삽': '튼크리모삽',
    '튼크리모삽': '크리모삽',
    '크리거삽': '튼크리거삽',
    '튼크리거삽': '크리거삽',
    '에로거삽': '튼에로거삽',
    '튼에로거삽': '에로거삽',
    '네온거삽': '튼네온거삽',
    '튼네온거삽': '네온거삽',

    // 괭이
    '크리괭이': '튼크리괭이',
    '튼크리괭이': '크리괭이',
    '에로괭이': '튼에로괭이',
    '튼에로괭이': '에로괭이',

    // 의상 - 팬더
    '일팬모': '튼팬모',
    '튼팬모': '일팬모',
    '일팬상': '튼팬상',
    '튼팬상': '일팬상',
    '일팬하': '튼팬하',
    '튼팬하': '일팬하',

    // 의상 - 네온
    '네온머리': '튼네온머리',
    '튼네온머리': '네온머리',
    '네온장갑': '튼네온장갑',
    '튼네온장갑': '네온장갑',
    '네온부츠': '튼네온부츠',
    '튼네온부츠': '네온부츠',

    // 의상 - 일반의상
    '셔츠': '튼셔츠',
    '일셔츠': '튼셔츠',
    '튼셔츠': '셔츠',
    '일바지': '튼바지',
    '튼바지': '일바지',

    // 의상 - 방독면/슈트 등
    '일슛': '튼슛',
    '튼슛': '일슛',
    '일썬': '튼썬',
    '튼썬': '일썬',
    '일쫄': '튼쫄',
    '튼쫄': '일쫄',
    '일헬': '튼헬',
    '튼헬': '일헬',

    // 기타
    '다마': '튼다마',
    '튼다마': '다마',
    '기고마머리': '튼기고마머리',
    '튼기고마머리': '기고마머리'
};

const getEquipPartnerKey = (itemName) => {
    if (!itemName) return null;
    const direct = EQUIP_PARTNER_MAP[itemName];
    if (direct) return direct;

    // 동적 접두사 규칙 폴백
    if (itemName.startsWith('튼')) {
        const withoutTeun = itemName.slice(1);
        if (EQUIP_META_DB[withoutTeun]) return withoutTeun;
        const withIl = '일' + withoutTeun;
        if (EQUIP_META_DB[withIl]) return withIl;
    } else {
        const withTeun = '튼' + itemName.replace(/^일/, '');
        if (EQUIP_META_DB[withTeun]) return withTeun;
    }
    return null;
};

// ============================================================================
// ★ 장비 기본 스탯 및 1~10강 강화 상승 수치 시스템
// ============================================================================
const ENHANCE_ADD_STATS = {
    // 의상 (옷) - 1~10강 공통 (기술 +1~36, 체력 +3~99)
    clothes: {
        hp:   [0, 3, 6, 12, 18, 24, 32, 42, 54, 69, 99],
        tech: [0, 1, 2,  4,  6,  8, 11, 15, 20, 26, 36]
    },
    // 괭이 / 로터리 (밭 양분 최대치)
    hoe: [0, 100, 250, 450, 750, 1150, 1650, 2250, 2950, 3800, 5000],
    // 거름삽 / 퇴비 살포기 (양분 증가)
    manure: [0, 10, 25, 45, 70, 100, 140, 190, 260, 360, 500],
    // 모종삽 / 파종기 (생육 개선)
    trowel: [0, 20, 50, 90, 140, 200, 280, 380, 520, 720, 1000],
    // 물뿌리개 (물 적재량)
    watering: [0, 1, 2, 4, 6, 9, 12, 15, 18, 22, 30],
    // 낫 / 콤바인 (등급 개선)
    sickle: [0, 20, 50, 90, 140, 200, 280, 380, 520, 720, 1000]
};

const EQUIP_BASE_STATS_DB = {
    // --- 의상: 모자 ---
    '일팬모': { hp: 115, tech: 24 },
    '튼팬모': { hp: 115, tech: 24 },
    '기팬모': { tech: 35 },
    '체팬모': { hp: 173 },

    '일헬':   { hp: 125, tech: 27 },
    '튼헬':   { hp: 125, tech: 27 },
    '기헬':   { tech: 40 },
    '체헬':   { hp: 188 },

    '일썬':   { hp: 135, tech: 30 },
    '튼썬':   { hp: 135, tech: 30 },
    '기썬':   { tech: 45 },
    '체썬':   { hp: 203 },

    '네온머리': { hp: 145, tech: 33 },
    '튼네온머리': { hp: 145, tech: 33 },
    '기네온머리': { tech: 50 },
    '체네온머리': { hp: 218 },
    '체메카머리': { hp: 218 },
    '기메카닉':   { tech: 50 },

    '기고마머리': { tech: 55 },
    '튼기고마머리': { tech: 55 },
    '체고마머리': { hp: 233 },
    '기개굴모자': { tech: 45 },
    '체개굴모자': { hp: 203 },
    '기도련복건': { tech: 45 },
    '체도련복건': { hp: 203 },

    // --- 의상: 상의 ---
    '일팬상': { hp: 165, tech: 36 },
    '튼팬상': { hp: 165, tech: 36 },
    '기팬상': { tech: 52 },
    '체팬상': { hp: 248 },

    '일슛':   { hp: 175, tech: 40 },
    '튼슛':   { hp: 175, tech: 40 },
    '기슛':   { tech: 58 },
    '체슛':   { hp: 266 },

    '셔츠':   { hp: 185, tech: 44 },
    '일셔츠': { hp: 185, tech: 44 },
    '튼셔츠': { hp: 185, tech: 44 },
    '기셔츠': { tech: 64 },
    '체셔츠': { hp: 284 },

    '네온장갑': { hp: 195, tech: 48 },
    '튼네온장갑': { hp: 195, tech: 48 },
    '기네온장갑': { tech: 70 },
    '체네온장갑': { hp: 302 },
    '체자켓':   { hp: 302 },
    '기자켓':   { tech: 70 },

    '기고마상의': { tech: 76 },
    '체고마상의': { hp: 320 },
    '도련저고리': { hp: 185, tech: 44 },

    // --- 의상: 하의 ---
    '일팬하': { hp: 155, tech: 34 },
    '튼팬하': { hp: 155, tech: 34 },
    '기팬하': { tech: 50 },
    '체팬하': { hp: 233 },

    '일쫄':   { hp: 165, tech: 38 },
    '튼쫄':   { hp: 165, tech: 38 },
    '기쫄':   { tech: 56 },
    '체쫄':   { hp: 248 },

    '일바지': { hp: 175, tech: 42 },
    '바지':   { hp: 175, tech: 42 },
    '튼바지': { hp: 175, tech: 42 },
    '기바지': { tech: 62 },
    '체바지': { hp: 263 },

    '네온부츠': { hp: 185, tech: 46 },
    '튼네온부츠': { hp: 185, tech: 46 },
    '기네온부츠': { tech: 68 },
    '체네온부츠': { hp: 278 },
    '체메카닉 바지': { hp: 278 },
    '기메카닉 바지': { tech: 68 },

    '기고마하의': { tech: 74 },
    '기고마꼬리': { tech: 74 },
    '체고마하의': { hp: 293 },
    '체고마꼬리': { hp: 293 },
    '체개굴하의': { hp: 263 },
    '도련바지':   { hp: 175, tech: 42 },
    '체도련바지': { hp: 263 },

    // --- 농기구 & 농기계: 괭이 / 로터리 ---
    '에로괭이':   { time: 4.0, hpSave: 14, fertMax: 5500 },
    '튼에로괭이': { time: 4.0, hpSave: 14, fertMax: 5500 },
    '크리괭이':   { time: 4.0, hpSave: 16, fertMax: 6000 },
    '튼크리괭이': { time: 4.0, hpSave: 16, fertMax: 6000 },
    '네온괭이':   { time: 4.0, hpSave: 16, fertMax: 6500 },
    '이리스괭이': { time: 4.0, hpSave: 16, fertMax: 6000 },
    '냥냥괭이':   { time: 2.5, hpSave: 16, fertMax: 7000 },
    '다마':       { time: 4.0, hpSave: 12, fertMax: 3500 },
    '튼다마':     { time: 4.0, hpSave: 12, fertMax: 3500 },
    '일로':       { time: 2.5, hpSave: 14, fertMax: 2500 },
    '중로':       { time: 2.0, hpSave: 17, fertMax: 5000 },
    '대로':       { time: 1.8, hpSave: 19, fertMax: 5500 },
    '크로':       { time: 1.6, hpSave: 19, fertMax: 6000 },

    // --- 농기구 & 농기계: 거름삽 / 퇴비 살포기 ---
    '에로거삽':   { time: 4.0, hpSave: 14, fertInc: 500 },
    '튼에로거삽': { time: 4.0, hpSave: 14, fertInc: 500 },
    '신에로거삽': { time: 3.0, hpSave: 14, fertInc: 500 },
    '크리거삽':   { time: 4.0, hpSave: 16, fertInc: 550 },
    '튼크리거삽': { time: 4.0, hpSave: 16, fertInc: 550 },
    '신크리거삽': { time: 3.0, hpSave: 16, fertInc: 550 },
    '네온거삽':   { time: 4.0, hpSave: 16, fertInc: 600 },
    '튼네온거삽': { time: 4.0, hpSave: 16, fertInc: 600 },
    '신네온거삽': { time: 3.0, hpSave: 16, fertInc: 600 },
    '신냥거삽':   { time: 2.5, hpSave: 16, fertInc: 650 },
    '일퇴':       { time: 2.5, hpSave: 14, fertInc: 300 },
    '중퇴':       { time: 2.0, hpSave: 17, fertInc: 450 },
    '대퇴':       { time: 1.8, hpSave: 19, fertInc: 500 },
    '크퇴':       { time: 1.6, hpSave: 19, fertInc: 550 },

    // --- 농기구 & 농기계: 모종삽 / 파종기 ---
    '아프모':     { time: 4.0, hpSave: 13, grow: 900 },
    '에로모삽':   { time: 4.0, hpSave: 14, grow: 1000 },
    '크리모삽':   { time: 4.0, hpSave: 16, grow: 1100 },
    '튼크리모삽': { time: 4.0, hpSave: 16, grow: 1100 },
    '신크리모삽': { time: 3.0, hpSave: 16, grow: 1100 },
    '네온모삽':   { time: 4.0, hpSave: 16, grow: 1200 },
    '신네온모삽': { time: 3.0, hpSave: 16, grow: 1200 },
    '이리모삽':   { time: 4.0, hpSave: 16, grow: 1100 },
    '신이리모삽': { time: 3.0, hpSave: 16, grow: 1100 },
    '일파':       { time: 2.5, hpSave: 14, grow: 400 },
    '중파':       { time: 2.0, hpSave: 17, grow: 900 },
    '대파':       { time: 1.8, hpSave: 19, grow: 1000 },
    '크파':       { time: 1.6, hpSave: 19, grow: 1100 },

    // --- 농기구: 물뿌리개 ---
    '포세':       { time: 4.0, hpSave: 13, grow: 170, waterCap: 20 },
    '신포세':     { time: 3.0, hpSave: 13, grow: 170, waterCap: 20 },
    '에로물뿌':   { time: 4.0, hpSave: 14, grow: 180, waterCap: 22 },
    '신에로물뿌': { time: 3.0, hpSave: 14, grow: 180, waterCap: 22 },
    '크리물뿌':   { time: 4.0, hpSave: 16, grow: 190, waterCap: 22 },
    '신크리물뿌': { time: 3.0, hpSave: 16, grow: 190, waterCap: 22 },
    '네온물뿌':   { time: 4.0, hpSave: 16, grow: 200, waterCap: 22 },
    '신네온물뿌': { time: 3.0, hpSave: 16, grow: 200, waterCap: 22 },
    '신이리물뿌': { time: 3.0, hpSave: 16, grow: 190, waterCap: 22 },
    '신냥물뿌':   { time: 2.5, hpSave: 16, grow: 210, waterCap: 22 },
    '튼쾌냥물뿌': { time: 2.5, hpSave: 16, grow: 210, waterCap: 22 },

    // --- 농기구 & 농기계: 낫 / 콤바인 ---
    '크로낫':   { time: 4.0, hpSave: 13, grade: 900 },
    '에로낫':   { time: 4.0, hpSave: 14, grade: 1000 },
    '튼에로낫': { time: 4.0, hpSave: 14, grade: 1000 },
    '크리낫':   { time: 4.0, hpSave: 16, grade: 1100 },
    '튼크리낫': { time: 4.0, hpSave: 16, grade: 1100 },
    '신크리낫': { time: 3.0, hpSave: 16, grade: 1100 },
    '네온낫':   { time: 4.0, hpSave: 16, grade: 1200 },
    '튼네온낫': { time: 4.0, hpSave: 16, grade: 1200 },
    '신이리낫': { time: 3.0, hpSave: 16, grade: 1100 },
    '냥냥낫':   { time: 2.5, hpSave: 16, grade: 1300 },
    '일콤':     { time: 2.5, hpSave: 14, grade: 400 },
    '중콤':     { time: 2.0, hpSave: 17, grade: 900 },
    '대콤':     { time: 1.8, hpSave: 19, grade: 1000 },
    '크콤':     { time: 1.6, hpSave: 19, grade: 1100 }
};

const getEquipBaseStats = (key, equipMeta) => {
    const k = normalizeEquipKey(key);
    if (EQUIP_BASE_STATS_DB[k]) return { ...EQUIP_BASE_STATS_DB[k] };

    const partner = getEquipPartnerKey(k);
    if (partner && EQUIP_BASE_STATS_DB[partner]) return { ...EQUIP_BASE_STATS_DB[partner] };

    // 동적 추정 폴백
    if (equipMeta) {
        if (equipMeta.subType === '일반 의상' || equipMeta.subType === '쿠폰 의상') {
            const isHat = equipMeta.part === '모자';
            const isTop = equipMeta.part === '상의';
            const baseHp = isHat ? 120 : (isTop ? 170 : 160);
            const baseTech = isHat ? 26 : (isTop ? 38 : 36);
            return { hp: baseHp, tech: baseTech };
        }
    }
    return null;
};

// 기본 스탯 한 줄 요약 텍스트
const formatEquipBaseStatsSummary = (stats, equipMeta) => {
    if (!stats) return '';
    const parts = [];

    if (stats.hp !== undefined && stats.tech !== undefined) {
        parts.push(`체력 ${stats.hp} · 기술 ${stats.tech}`);
    } else if (stats.tech !== undefined) {
        parts.push(`기술 ${stats.tech}`);
    } else if (stats.hp !== undefined) {
        parts.push(`체력 ${stats.hp}`);
    }

    if (stats.fertMax !== undefined) parts.push(`밭양분최대 ${stats.fertMax.toLocaleString()}`);
    if (stats.fertInc !== undefined) parts.push(`양분증가 +${stats.fertInc.toLocaleString()}`);
    if (stats.grow !== undefined)    parts.push(`생육개선 +${stats.grow.toLocaleString()}`);
    if (stats.waterCap !== undefined) parts.push(`물적재량 ${stats.waterCap}`);
    if (stats.grade !== undefined)   parts.push(`등급개선 +${stats.grade.toLocaleString()}`);

    if (stats.hpSave !== undefined) parts.push(`체력절감 -${stats.hpSave}`);
    if (stats.time !== undefined)   parts.push(`작업 ${stats.time.toFixed(1)}초`);

    return parts.join(' | ');
};

// 특정 강화 단계(lvl)에서의 총 스탯 및 증가량 도출 (모든 의상 및 농기계/농기구 100% 지원)
const getEquipEnhanceStatAtLevel = (stats, equipMeta, lvl) => {
    if (!stats) return null;

    if (lvl === 0) {
        let displayShort = '';
        if (stats.hp !== undefined && stats.tech !== undefined) {
            displayShort = `체 ${stats.hp} · 기 ${stats.tech}`;
        } else if (stats.tech !== undefined) {
            displayShort = `기술 ${stats.tech}`;
        } else if (stats.hp !== undefined) {
            displayShort = `체력 ${stats.hp}`;
        } else if (stats.fertMax !== undefined) {
            displayShort = `양분 ${stats.fertMax.toLocaleString()}`;
        } else if (stats.fertInc !== undefined) {
            displayShort = `양분증가 +${stats.fertInc.toLocaleString()}`;
        } else if (stats.grow !== undefined && stats.waterCap === undefined) {
            displayShort = `생육 +${stats.grow.toLocaleString()}`;
        } else if (stats.waterCap !== undefined) {
            displayShort = `물 ${stats.waterCap}`;
        } else if (stats.grade !== undefined) {
            displayShort = `등급 +${stats.grade.toLocaleString()}`;
        }
        return { ...stats, addSummary: '', displayShort, isZero: true };
    }

    // 의상 (옷): 체력/기술 특화 의상도 강화 시 기술과 체력이 동시에 추가됨!
    if (stats.hp !== undefined || stats.tech !== undefined) {
        const baseHp = stats.hp || 0;
        const baseTech = stats.tech || 0;
        const addHp = ENHANCE_ADD_STATS.clothes.hp[lvl] || 0;
        const addTech = ENHANCE_ADD_STATS.clothes.tech[lvl] || 0;
        const totalHp = baseHp + addHp;
        const totalTech = baseTech + addTech;

        return {
            hp: totalHp,
            tech: totalTech,
            addSummary: `기+${addTech} 체+${addHp}`,
            displayShort: `체 ${totalHp} · 기 ${totalTech}`
        };
    }

    // 괭이 / 로터리 (농기계 포함)
    if (stats.fertMax !== undefined) {
        const add = ENHANCE_ADD_STATS.hoe[lvl] || 0;
        const total = stats.fertMax + add;
        return {
            fertMax: total,
            addSummary: `+${add.toLocaleString()}`,
            displayShort: `양분 ${total.toLocaleString()}`
        };
    }
    // 거름삽 / 퇴비 살포기 (농기계 포함)
    if (stats.fertInc !== undefined) {
        const add = ENHANCE_ADD_STATS.manure[lvl] || 0;
        const total = stats.fertInc + add;
        return {
            fertInc: total,
            addSummary: `+${add.toLocaleString()}`,
            displayShort: `양분증가 +${total.toLocaleString()}`
        };
    }
    // 모종삽 / 파종기 (크파 등 농기계 포함)
    if (stats.grow !== undefined && stats.waterCap === undefined) {
        const add = ENHANCE_ADD_STATS.trowel[lvl] || 0;
        const total = stats.grow + add;
        return {
            grow: total,
            addSummary: `+${add.toLocaleString()}`,
            displayShort: `생육 +${total.toLocaleString()}`
        };
    }
    // 물뿌리개
    if (stats.waterCap !== undefined) {
        const add = ENHANCE_ADD_STATS.watering[lvl] || 0;
        const total = stats.waterCap + add;
        return {
            waterCap: total,
            grow: stats.grow,
            addSummary: `+${add}`,
            displayShort: `물 ${total} (+${add})`
        };
    }
    // 낫 / 콤바인 (크콤 등 농기계 포함)
    if (stats.grade !== undefined) {
        const add = ENHANCE_ADD_STATS.sickle[lvl] || 0;
        const total = stats.grade + add;
        return {
            grade: total,
            addSummary: `+${add.toLocaleString()}`,
            displayShort: `등급 +${total.toLocaleString()}`
        };
    }

    return null;
};

// 1~10강 전체 스탯 테이블 생성기 (모든 장비·농기계 공통, 상시 노출)
const buildAllEnhanceStatsTableHtml = (stats, equipMeta) => {
    if (!stats) return '';

    const levels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const colsHtml = levels.map(lvl => {
        const s = getEquipEnhanceStatAtLevel(stats, equipMeta, lvl);
        if (!s) return '';
        const isHighlight = lvl === 5 || lvl === 7 || lvl === 9;
        const isMax = lvl === 10;
        const bgBorder = isMax
            ? 'bg-amber-50 border-amber-300 shadow-2xs'
            : (isHighlight ? 'bg-indigo-50/80 border-indigo-200' : 'bg-white border-gray-100');

        return `
            <div class="flex-shrink-0 min-w-[74px] text-center p-1.5 rounded-lg border ${bgBorder} flex flex-col justify-between">
                <div class="text-[10px] font-bold ${isMax ? 'text-amber-700' : (isHighlight ? 'text-indigo-700' : 'text-gray-500')}">
                    ${lvl === 0 ? '기본 (0강)' : `+${lvl}강`}
                </div>
                <div class="my-1">
                    <div class="text-[11px] font-extrabold ${isMax ? 'text-amber-800' : 'text-blue-700'}">
                        ${lvl === 0 ? '-' : (s.addSummary || '-')}
                    </div>
                    <div class="text-[10px] text-gray-700 font-semibold">
                        ${s.displayShort || '-'}
                    </div>
                </div>
                <div class="text-[9px] text-gray-400">
                    ${lvl === 0 ? '기본값' : '누적합'}
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="mt-3 pt-2.5 border-t border-blue-200/60">
            <div class="flex items-center justify-between mb-1.5">
                <div class="flex items-center gap-1.5">
                    <span class="text-xs font-extrabold text-indigo-950">강화 레벨별 스탯 증가량 & 누적 수치</span>
                    <span class="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-bold">1~10강</span>
                </div>
                <span class="text-[10px] text-gray-400 font-medium">가로 스크롤 가능 →</span>
            </div>
            <div class="p-2 bg-blue-50/40 rounded-lg border border-indigo-100/80 shadow-inner overflow-x-auto">
                <div class="flex items-stretch gap-1.5 min-w-max pb-0.5">
                    ${colsHtml}
                </div>
            </div>
        </div>
    `;
};



// ============================================================================
// ★ 2. 옵션 정식 명칭 · 줄임말 · 부위별/강화단계별(5/7/9/10강) 세부효과 도감 DB
// ============================================================================
const normalizeOptionVariantKey = (rawOpt, enc) => {
    const opt = (rawOpt || '').trim();
    const e = Math.round(Number(enc) || 0);

    // 1) 종자 속성 (모자=적응력, 상의=연속성, 하의=균일도, 모종삽=발아율, 낫=생산력, 물뿌리개=종자개수)
    if (opt.startsWith('종자[') && !opt.endsWith('%]')) {
        const rng = opt.slice(3, -1);
        if ((e <= 6 && rng === '0-1') || ((e === 7 || e === 8) && rng === '0-2') || (e === 9 && rng === '0-3') || (e === 10 && rng === '1-4') || ['0-1', '0-2', '0-3'].includes(rng)) {
            return '종자(최소옵)';
        }
        if ((e <= 6 && rng === '1-2') || ((e === 7 || e === 8) && rng === '1-3') || (e === 9 && rng === '1-4') || (e === 10 && rng === '2-5') || ['1-2', '1-3', '1-4'].includes(rng)) {
            return '종자(중간옵)';
        }
        if ((e <= 6 && rng === '2-3') || ((e === 7 || e === 8) && rng === '2-4') || (e === 9 && rng === '2-5') || (e === 10 && rng === '3-6') || ['2-3', '2-4', '2-5', '3-6'].includes(rng)) {
            return '종자(최대옵)';
        }
    }
    // 2) 교배 수량 증가 (물뿌리개)
    if (opt.startsWith('교배[')) {
        const rng = opt.slice(3, -1);
        if ((e <= 6 && rng === '0-3') || ((e === 7 || e === 8) && rng === '1-3') || (e === 9 && rng === '2-4') || (e === 10 && rng === '3-5') || ['0-3', '1-3'].includes(rng)) {
            return '교배(최소옵)';
        }
        if ((e <= 6 && rng === '1-4') || ((e === 7 || e === 8) && rng === '2-4') || (e === 9 && rng === '3-5') || (e === 10 && rng === '4-6') || ['1-4', '2-4'].includes(rng)) {
            return '교배(중간옵)';
        }
        if ((e <= 6 && rng === '2-5') || ((e === 7 || e === 8) && rng === '3-5') || (e === 9 && rng === '4-6') || (e === 10 && rng === '5-7') || ['2-5', '3-5', '4-6', '5-7'].includes(rng)) {
            return '교배(최대옵)';
        }
    }
    // 3) 종자선별 성공확률 증가 (거름삽 / 퇴비 살포기)
    if (opt.startsWith('종자[') && opt.endsWith('%]')) {
        const rng = opt.slice(3, -1);
        if ((e <= 6 && rng === '1%') || ((e === 7 || e === 8) && rng === '2%') || (e === 9 && rng === '3%') || (e === 10 && rng === '5%')) {
            return '종자선별(최소옵)';
        }
        if ((e <= 6 && rng === '2%') || ((e === 7 || e === 8) && rng === '3%') || (e === 9 && rng === '5%') || (e === 10 && rng === '10%') || ['2%', '3%', '5%', '10%'].includes(rng)) {
            return '종자선별(중간옵)';
        }
        if ((e <= 6 && rng === '3%') || ((e === 7 || e === 8) && rng === '4%') || (e === 9 && rng === '7%') || (e === 10 && rng === '15%') || ['4%', '7%', '15%'].includes(rng)) {
            return '종자선별(최대옵)';
        }
    }

    const aliasMap = {
        '조경경치': '조경',
        '육묘옵': '육묘',
        '퇴비': '퇴비제조',
        '알초옵': '알초',
        '일회': '일체',
        '쿱옵': '쿱',
        '향쿱옵': '향쿱',
        '갈엎경': '갈경',
        '솩량': '솩',
        '수확량': '솩'
    };
    return aliasMap[opt] || opt;
};

const getOptionMeta = (optKey, equipMeta) => {
    const part = equipMeta?.part || '';
    const subType = equipMeta?.subType || '';
    const isCloth = subType.includes('의상') || ['모자', '상의', '하의'].includes(part);

    if (optKey === '종자(최소옵)' || optKey === '종자(중간옵)' || optKey === '종자(최대옵)') {
        const tierLabel = optKey.includes('최소') ? '최소옵' : (optKey.includes('중간') ? '중간옵' : '최대옵');
        const stages = optKey.includes('최소')
            ? { 5: '0~1 증가', 7: '0~2 증가', 9: '0~3 증가', 10: '1~4 증가' }
            : (optKey.includes('중간')
                ? { 5: '1~2 증가', 7: '1~3 증가', 9: '1~4 증가', 10: '2~5 증가' }
                : { 5: '2~3 증가', 7: '2~4 증가', 9: '2~5 증가', 10: '3~6 증가' });
        const rawRangeHint = optKey.includes('최소') ? '종자[0-1]~[1-4]' : (optKey.includes('중간') ? '종자[1-2]~[2-5]' : '종자[2-3]~[3-6]');

        let propName = '종자 속성 증가';
        let propDesc = '장착 부위에 따라 해당 작업 시 종자 능력치 또는 수확 종자 개수가 증가합니다.';
        if (part === '모자') {
            propName = `종자 적응력 (${tierLabel})`;
            propDesc = '씨앗을 뿌릴 때 일정 확률로 종자 적응력이 증가합니다. (모자 전용)';
        } else if (part === '상의') {
            propName = `종자 연속성 (${tierLabel})`;
            propDesc = '거름을 줄 때 일정 확률로 종자 연속성이 증가합니다. (상의 전용)';
        } else if (part === '하의') {
            propName = `종자 균일도 (${tierLabel})`;
            propDesc = '밭을 갈 때 일정 확률로 종자 균일도가 증가합니다. (하의 전용)';
        } else if (part === '모종삽' || part === '파종기') {
            propName = `종자 발아율 (${tierLabel})`;
            propDesc = '모종을 심을 때 일정 확률로 종자 발아율이 증가합니다. (모종삽/파종기 전용)';
        } else if (part === '낫' || part === '콤바인') {
            propName = `종자 생산력 (${tierLabel})`;
            propDesc = '수확할 때 일정 확률로 종자 생산력이 증가합니다. (낫/콤바인 전용)';
        } else if (part === '물뿌리개') {
            propName = `종자재배실 종자개수 증가 (${tierLabel})`;
            propDesc = '종자재배실에서 수확 시 획득하는 종자 개수가 증가합니다. (물뿌리개 전용)';
        } else {
            propName = `종자 속성 (${tierLabel})`;
        }

        return {
            key: optKey,
            officialName: propName,
            abbr: `${optKey}, ${rawRangeHint}`,
            desc: propDesc,
            stages
        };
    }

    if (optKey === '교배(최소옵)' || optKey === '교배(중간옵)' || optKey === '교배(최대옵)') {
        const tierLabel = optKey.includes('최소') ? '최소옵' : (optKey.includes('중간') ? '중간옵' : '최대옵');
        const stages = optKey.includes('최소')
            ? { 5: '0~3개 추가', 7: '1~3개 추가', 9: '2~4개 추가', 10: '3~5개 추가' }
            : (optKey.includes('중간')
                ? { 5: '1~4개 추가', 7: '2~4개 추가', 9: '3~5개 추가', 10: '4~6개 추가' }
                : { 5: '2~5개 추가', 7: '3~5개 추가', 9: '4~6개 추가', 10: '5~7개 추가' });
        const rawRangeHint = optKey.includes('최소') ? '교배[0-3]~[3-5]' : (optKey.includes('중간') ? '교배[1-4]~[4-6]' : '교배[2-5]~[5-7]');

        return {
            key: optKey,
            officialName: `교배시 교배수량 증가 (${tierLabel})`,
            abbr: `${optKey}, ${rawRangeHint}`,
            desc: '교배 시 획득하는 교배 수량이 증가합니다. (50레벨 이상 모든 물뿌리개)',
            stages
        };
    }

    if (optKey === '종자선별(최소옵)' || optKey === '종자선별(중간옵)' || optKey === '종자선별(최대옵)') {
        const tierLabel = optKey.includes('최소') ? '최소옵' : (optKey.includes('중간') ? '중간옵' : '최대옵');
        const stages = optKey.includes('최소')
            ? { 5: '1% 증가', 7: '2% 증가', 9: '3% 증가', 10: '5% 증가' }
            : (optKey.includes('중간')
                ? { 5: '2% 증가', 7: '3% 증가', 9: '5% 증가', 10: '10% 증가' }
                : { 5: '3% 증가', 7: '4% 증가', 9: '7% 증가', 10: '15% 증가' });
        return {
            key: optKey,
            officialName: `종자선별 성공확률 증가 (${tierLabel})`,
            abbr: `${optKey}, 종자[%]`,
            desc: '종자선별 시 성공 확률이 증가합니다. (거름삽 / 퇴비 살포기)',
            stages
        };
    }

    if (optKey === '밭드') {
        const isHarvest = (part === '낫' || part === '콤바인');
        return {
            key: optKey,
            officialName: isHarvest ? '수확하기 밭드롭 추가' : '갈아엎기 밭드롭 추가',
            abbr: '밭드',
            desc: isHarvest
                ? '작물을 수확할 때 밭드롭 아이템 획득 개수가 추가됩니다. (낫, 콤바인)'
                : '밭을 갈아엎을 때 밭드롭 아이템 획득 개수가 추가됩니다. (괭이, 로터리)',
            stages: { 5: '0~1개 추가', 7: '0~2개 추가', 9: '0~3개 추가', 10: '1~4개 추가' }
        };
    }

    if (optKey === '향밭드') {
        const isHarvest = (part === '낫' || part === '콤바인');
        return {
            key: optKey,
            officialName: isHarvest ? '향상된 수확하기 밭드롭 추가' : '향상된 갈아엎기 밭드롭 추가',
            abbr: '향밭드',
            desc: '80레벨 괭이/낫 전용 향상된 밭드롭 추가 옵션입니다.',
            stages: { 5: '0~2개 추가', 7: '1~2개 추가', 9: '1~3개 추가', 10: '2~4개 추가' }
        };
    }

    if (optKey === '솩') {
        const isPlant = (part === '모종삽' || part === '파종기');
        return {
            key: optKey,
            officialName: isPlant ? '모종심기 수확량 추가' : '수확하기 수확량 추가',
            abbr: '솩, 솩량, 수확량',
            desc: isPlant
                ? '모종으로 심을 때 작물 수확량이 일정 비율 증가합니다. (모종삽, 파종기)'
                : '작물을 수확할 때 작물 수확량이 일정 비율 증가합니다. (낫, 콤바인)',
            stages: { 5: '+20%', 7: '+30%', 9: '+40%', 10: '+50%' }
        };
    }

    if (optKey === '쿱') {
        if (!isCloth && (part === '모종삽' || part === '파종기')) {
            return {
                key: optKey,
                officialName: '모종심기 레알쿠폰 발생확률 증가',
                abbr: '쿱',
                desc: '모종을 심을 때 레알쿠폰 발생 확률이 증가합니다. (모종삽, 파종기)',
                stages: { 5: '+5%', 7: '+10%', 9: '+20%', 10: '+30%' }
            };
        }
        return {
            key: optKey,
            officialName: '레알쿠폰 확률 증가',
            abbr: '쿱, 쿱옵',
            desc: '농작업 시 레알쿠폰 획득 확률이 증가합니다. (의상)',
            stages: { 5: '+5%', 7: '+10%', 9: '+20%', 10: '+30%' }
        };
    }

    if (optKey === '생육') {
        if (part === '모종삽' || part === '파종기') {
            return {
                key: optKey,
                officialName: '모종심기 경험치 증가',
                abbr: '생육 (모종삽/파종기)',
                desc: '모종을 심을 때 획득하는 경험치가 증가합니다. (모종삽, 파종기)',
                stages: { 5: '+20%', 7: '+50%', 9: '+100%', 10: '+200%' }
            };
        }
        return {
            key: optKey,
            officialName: '물뿌리기 생육개선 증가',
            abbr: '생육 (물뿌리개)',
            desc: '물을 뿌릴 때 작물 생육 개선 수치가 증가합니다. (물뿌리개)',
            stages: { 5: '+50', 7: '+100', 9: '+200', 10: '+300' }
        };
    }

    if (optKey === '일조량') {
        const isHat = (part === '모자');
        return {
            key: optKey,
            officialName: isHat ? '일조량 최소일수 조절' : (part === '낫' ? '일조량 최대일수 조절' : '일조량 조절'),
            abbr: '일조량',
            desc: '태양신작 진행 시 필요한 일조량 일수를 조절합니다. (70·80레벨 모자: 최소일수 조절 / 70·80레벨 낫: 최대일수 조절)',
            stages: { 5: '1일 조절', 7: '1일 조절', 9: '2일 조절', 10: '3일 조절' }
        };
    }

    const STATIC_OPT_DB = {
        '씨뿌경': {
            officialName: '씨뿌리기 경험치 증가',
            abbr: '씨뿌경',
            desc: '씨앗을 뿌릴 때 획득하는 경험치가 증가합니다. (모자 전용)',
            stages: { 5: '+20%', 7: '+50%', 9: '+100%', 10: '+200%' }
        },
        '조경': {
            officialName: '조경 경험치 증가',
            abbr: '조경, 조경경치',
            desc: '조경 작업 시 획득하는 경험치가 증가합니다. (의상)',
            stages: { 5: '+20%', 7: '+50%', 9: '+100%', 10: '+200%' }
        },
        '오생': {
            officialName: '오리 생육 개선 증가',
            abbr: '오생',
            desc: '흰오리, 회색오리, 황금오리의 생육 개선 효과가 증가합니다. (의상)',
            stages: { 5: '+20%', 7: '+50%', 9: '+100%', 10: '+200%' }
        },
        '육묘': {
            officialName: '육묘장 제조개수 추가',
            abbr: '육묘, 육묘옵',
            desc: '육묘장에서 모종 제조 시 일정 확률로 제조 개수가 추가됩니다. (모자 전용)',
            stages: { 5: '10% 확률 추가', 7: '20% 확률 추가', 9: '50% 확률 추가', 10: '100% 확정 추가' }
        },
        '육묘경': {
            officialName: '육묘장 제조경험치 추가',
            abbr: '육묘경',
            desc: '육묘장에서 모종 제조 시 획득하는 경험치가 증가합니다. (모자 전용)',
            stages: { 5: '+20%', 7: '+50%', 9: '+100%', 10: '+200%' }
        },
        '상토': {
            officialName: '상토배합실 제조개수 추가',
            abbr: '상토',
            desc: '상토배합실에서 상토 제조 시 일정 확률로 제조 개수가 추가됩니다. (하의 전용)',
            stages: { 5: '10% 확률 추가', 7: '20% 확률 추가', 9: '50% 확률 추가', 10: '100% 확정 추가' }
        },
        '상토경': {
            officialName: '상토배합실 제조경험치 추가',
            abbr: '상토경',
            desc: '상토배합실에서 상토 제조 시 획득하는 경험치가 증가합니다. (하의 전용)',
            stages: { 5: '+20%', 7: '+50%', 9: '+100%', 10: '+200%' }
        },
        '퇴비제조': {
            officialName: '퇴비발효장 제조개수 추가',
            abbr: '퇴비제조, 퇴비',
            desc: '퇴비발효장에서 퇴비 제조 시 일정 확률로 제조 개수가 추가됩니다. (상의 전용)',
            stages: { 5: '10% 확률 추가', 7: '20% 확률 추가', 9: '50% 확률 추가', 10: '100% 확정 추가' }
        },
        '퇴비경': {
            officialName: '퇴비발효장 제조경험치 추가',
            abbr: '퇴비경',
            desc: '퇴비발효장에서 퇴비 제조 시 획득하는 경험치가 증가합니다. (상의 전용)',
            stages: { 5: '+20%', 7: '+50%', 9: '+100%', 10: '+200%' }
        },
        '알초': {
            officialName: '레알초 추가 획득',
            abbr: '알초, 알초옵',
            desc: '이웃 농장 품앗이 시 레알초를 추가로 획득합니다. (상의 전용)',
            stages: { 5: '+1개', 7: '+2개', 9: '+3개', 10: '+5개' }
        },
        '추체': {
            officialName: '추가 체력',
            abbr: '추체',
            desc: '최대 체력이 추가로 증가합니다. (의상)',
            stages: { 5: '+6', 7: '+15', 9: '+30', 10: '+60' }
        },
        '추기': {
            officialName: '추가 기술',
            abbr: '추기',
            desc: '기술 능력치가 추가로 증가합니다. (의상)',
            stages: { 5: '+2', 7: '+5', 9: '+10', 10: '+20' }
        },
        '일체': {
            officialName: '1일 체력 회복량 증가',
            abbr: '일체, 일회',
            desc: '자정(1일)마다 회복되는 체력량이 증가합니다. (의상)',
            stages: { 5: '+5', 7: '+10', 9: '+15', 10: '+30' }
        },
        '향추체': {
            officialName: '향상된 추가 체력',
            abbr: '향추체',
            desc: '80레벨 의상 전용 향상된 최대 체력 증가 옵션입니다.',
            stages: { 5: '+9', 7: '+20', 9: '+45', 10: '+100' }
        },
        '향추기': {
            officialName: '향상된 추가 기술',
            abbr: '향추기',
            desc: '80레벨 의상 전용 향상된 기술 능력치 증가 옵션입니다.',
            stages: { 5: '+3', 7: '+7', 9: '+15', 10: '+30' }
        },
        '향쿱': {
            officialName: '향상된 레알쿠폰 확률 증가',
            abbr: '향쿱, 향쿱옵',
            desc: '80레벨 의상 전용 향상된 레알쿠폰 획득 확률 증가 옵션입니다.',
            stages: { 5: '+10%', 7: '+20%', 9: '+30%', 10: '+50%' }
        },
        '밭양': {
            officialName: '밭갈기 양분 추가',
            abbr: '밭양',
            desc: '밭을 갈 때 일정 확률로 양분이 추가됩니다. (괭이, 로터리)',
            stages: { 5: '10% 확률', 7: '30% 확률', 9: '50% 확률', 10: '100% 확률' }
        },
        '갈경': {
            officialName: '갈아엎기 경험치 추가',
            abbr: '갈경, 갈엎경',
            desc: '밭을 갈아엎을 때 획득하는 경험치가 증가합니다. (괭이, 로터리)',
            stages: { 5: '+20%', 7: '+50%', 9: '+100%', 10: '+200%' }
        },
        '밭갈경': {
            officialName: '밭갈기 경험치 추가',
            abbr: '밭갈경',
            desc: '밭을 갈 때 획득하는 경험치가 증가합니다. (괭이, 로터리)',
            stages: { 5: '+20%', 7: '+50%', 9: '+100%', 10: '+200%' }
        },
        '솩경': {
            officialName: '수확하기 경험치 추가',
            abbr: '솩경',
            desc: '작물을 수확할 때 획득하는 경험치가 증가합니다. (낫, 콤바인)',
            stages: { 5: '+20%', 7: '+50%', 9: '+100%', 10: '+200%' }
        },
        '물뿌경': {
            officialName: '물뿌리기 경험치 증가',
            abbr: '물뿌경',
            desc: '물을 뿌릴 때 획득하는 경험치가 증가합니다. (물뿌리개)',
            stages: { 5: '+20%', 7: '+50%', 9: '+100%', 10: '+200%' }
        },
        '밑양': {
            officialName: '밑거름 주기 양분량 증가',
            abbr: '밑양',
            desc: '밑거름을 줄 때 공급되는 양분량이 증가합니다. (거름삽, 퇴비 살포기)',
            stages: { 5: '+20%', 7: '+50%', 9: '+100%', 10: '+200%' }
        },
        '덧양': {
            officialName: '덧거름 주기 양분량 증가',
            abbr: '덧양',
            desc: '덧거름을 줄 때 공급되는 양분량이 증가합니다. (거름삽, 퇴비 살포기)',
            stages: { 5: '+20%', 7: '+50%', 9: '+100%', 10: '+200%' }
        },
        '덧생': {
            officialName: '덧거름 주기 생육개선 증가',
            abbr: '덧생',
            desc: '덧거름을 줄 때 작물 생육 개선 수치가 증가합니다. (거름삽, 퇴비 살포기)',
            stages: { 5: '+50', 7: '+100', 9: '+200', 10: '+300' }
        },
        '덧경': {
            officialName: '덧거름 주기 경험치 증가',
            abbr: '덧경',
            desc: '덧거름을 줄 때 획득하는 경험치가 증가합니다. (거름삽, 퇴비 살포기)',
            stages: { 5: '+20%', 7: '+50%', 9: '+100%', 10: '+200%' }
        },
        '약탕기': {
            officialName: '약탕기 제조 시 아이템 추가',
            abbr: '약탕기',
            desc: '약탕기에서 제조할 때 일정 확률로 아이템이 추가 생산됩니다. (70·80레벨 거름삽)',
            stages: { 5: '10% 확률 추가', 7: '20% 확률 추가', 9: '50% 확률 추가', 10: '100% 확정 추가' }
        },
        '입자': {
            officialName: '입자가속기 제조 시 아이템 추가',
            abbr: '입자',
            desc: '입자가속기에서 제조할 때 일정 확률로 아이템이 추가 생산됩니다. (70·80레벨 물뿌리개)',
            stages: { 5: '10% 확률 추가', 7: '20% 확률 추가', 9: '50% 확률 추가', 10: '100% 확정 추가' }
        },
        '무': {
            officialName: '무옵션 (옵션 없음)',
            abbr: '무',
            desc: '강화 시 추가 옵션이 부여되지 않은 기본 상태 장비입니다.',
            stages: null
        },
        '잡': {
            officialName: '기타/비주류 옵션 (잡옵)',
            abbr: '잡',
            desc: '경험치·보조 옵션 등 시세 영향도가 낮은 비주류 옵션 분류입니다.',
            stages: null
        }
    };

    if (STATIC_OPT_DB[optKey]) {
        return { key: optKey, ...STATIC_OPT_DB[optKey] };
    }

    return {
        key: optKey,
        officialName: optKey,
        abbr: optKey,
        desc: '선택된 세부 옵션/등급입니다.',
        stages: null
    };
};

// ============================================================================
// ★ 3. 비-몬테카를로(Exact Analytical) n-변수 강화 기댓값 & 최적 보호제 알고리즘
// ============================================================================
const ENHANCE_SR = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1];
const ENHANCE_SRD = [1, 0.92, 0.83, 0.75, 0.67, 0.58, 0.5, 0.42, 0.33, 0.25];
const ENHANCE_SC = [1, 2, 3, 5, 10, 20, 30, 50, 100, 200];
const ENHANCE_PC = [1, 2, 3, 4, 8, 10, 15, 20, 30, 50];

const calcGoldCostEok = (equipLevel, currentEnhance) => {
    const e = Number(equipLevel) || 70;
    let b;
    if (e <= 69) b = Math.round(10 * Math.pow(e, 2.5) / 10) * 10;
    else if (e === 70) b = 958000;
    else if (e >= 71 && e <= 79) b = 2000000;
    else if (e === 80) b = 3303400;
    else if (e === 90) b = 7290000;
    else b = Math.round(10 * Math.pow(e, 2.5) / 10) * 10;
    return (b * Math.pow(2, currentEnhance)) / 1e8; // 억 단위 변환
};

/**
 * 단일 전략 (t10, t9, t8, stop78)에 대한 비-몬테카를로 해석적 정확 기댓값 계산 (마르코프 DAG 역진 귀납법)
 */
const evaluateEnhancementExact = (l, d, t10, t9, t8, e, u, suEok, pfEok, saleEok, stop78 = false) => {
    const memo = new Map();

    const solve = (cl, cd) => {
        const stateKey = (cl << 8) | cd;
        if (memo.has(stateKey)) return memo.get(stateKey);

        if (stop78 && cl === 7 && cd === 8) {
            const rev = saleEok[7] || 0;
            const res = {
                ev: rev,
                cost: 0,
                rev: rev,
                probs: { 10: 0, 9: 0, 8: 0, 7: 100, 0: 0 }
            };
            memo.set(stateKey, res);
            return res;
        }

        if (cl >= 10 || cd <= cl) {
            const rev = cl >= 7 ? (saleEok[cl] || 0) : 0;
            const probs = { 10: 0, 9: 0, 8: 0, 7: 0, 0: 0 };
            if (cl >= 7) probs[cl] = 100;
            else probs[0] = 100;
            const res = { ev: rev, cost: 0, rev: rev, probs };
            memo.set(stateKey, res);
            return res;
        }

        let prot = false;
        if (cd >= 10) prot = (cl >= t10);
        else if (cd === 9) prot = (cl >= t9);
        else if (cd === 8) prot = (cl >= t8);

        const base = u ? ENHANCE_SRD[cl] : ENHANCE_SR[cl];
        const eff = prot ? Math.min(base + 0.2, 1.0) : base;
        const stepCost = prot
            ? (ENHANCE_PC[cl] * pfEok)
            : (calcGoldCostEok(e, cl) + ENHANCE_SC[cl] * suEok);

        const succ = solve(cl + 1, cd);
        const surv = solve(cl, cd - 1);

        let pSucc, pSurv, pDest;
        if (prot) {
            pSucc = eff;
            pSurv = 1.0 - eff;
            pDest = 0.0;
        } else {
            pSucc = eff;
            pDest = (1.0 - eff) * (cl / 10.0);
            pSurv = (1.0 - eff) * (1.0 - cl / 10.0);
        }

        const ev = -stepCost + pSucc * succ.ev + pSurv * surv.ev;
        const cost = stepCost + pSucc * succ.cost + pSurv * surv.cost;
        const rev = pSucc * succ.rev + pSurv * surv.rev;
        const probs = {
            10: pSucc * succ.probs[10] + pSurv * surv.probs[10],
            9: pSucc * succ.probs[9] + pSurv * surv.probs[9],
            8: pSucc * succ.probs[8] + pSurv * surv.probs[8],
            7: pSucc * succ.probs[7] + pSurv * surv.probs[7],
            0: pSucc * succ.probs[0] + pSurv * surv.probs[0] + pDest * 100.0
        };

        const res = { ev, cost, rev, probs };
        memo.set(stateKey, res);
        return res;
    };

    return solve(l, d);
};

/**
 * n-변수 결정론적 강화 최적화 함수:
 * 입력: (현재단계 l, 현재내구도 d, 렙제 e, 튼튼여부 u, 7~10강 판매가 s7~s10, 강레가격 reaEok, 강화석396개가격 stone396Eok)
 */
const optimizeEnhancementExact = ({ l, d, e, u, s7, s8, s9, s10, reaEok, stone396Eok = FIXED_STONE_396_EOK }) => {
    const suEok = stone396Eok / 396.0;
    const pfEok = 10.0 * reaEok;
    const saleEok = { 7: Number(s7) || 0, 8: Number(s8) || 0, 9: Number(s9) || 0, 10: Number(s10) || 0 };

    if (l >= 10 || d <= l) {
        const curVal = l >= 7 ? (saleEok[l] || 0) : 0;
        return {
            th10: 100, th9: 100, th8: 100, stop78: false,
            ev: curVal, rev: curVal, cost: 0,
            probs: { 10: l === 10 ? 100 : 0, 9: l === 9 ? 100 : 0, 8: l === 8 ? 100 : 0, 7: l === 7 ? 100 : 0, 0: l < 7 ? 100 : 0 },
            rawNoProt: { ev: curVal, rev: curVal, cost: 0 }
        };
    }

    const rawNoProt = evaluateEnhancementExact(l, d, 100, 100, 100, e, u, suEok, pfEok, saleEok, false);

    if (d < 8) {
        return {
            th10: 100, th9: 100, th8: 100, stop78: false,
            ...rawNoProt,
            rawNoProt
        };
    }

    const t10Cand = [100];
    if (d >= 10) {
        for (let c = l; c <= 9; c++) t10Cand.push(c);
    }
    const t9Cand = [100];
    if (d >= 9) {
        for (let c = l; c <= 8; c++) t9Cand.push(c);
    }
    const t8Cand = [100];
    if (d >= 8) {
        for (let c = l; c <= 7; c++) t8Cand.push(c);
    }
    const stopCand = (l <= 7 && d >= 8 && saleEok[7] > 0 && saleEok[8] > 0) ? [false, true] : [false];

    let bestEv = -Infinity;
    let bestCfg = { th10: 100, th9: 100, th8: 100, stop78: false, ...rawNoProt };

    for (const c10 of t10Cand) {
        for (const c9 of t9Cand) {
            for (const c8 of t8Cand) {
                for (const st of stopCand) {
                    const r = evaluateEnhancementExact(l, d, c10, c9, c8, e, u, suEok, pfEok, saleEok, st);
                    if (r.ev > bestEv + 1e-9) {
                        bestEv = r.ev;
                        bestCfg = { th10: c10, th9: c9, th8: c8, stop78: st, ...r };
                    }
                }
            }
        }
    }

    const checkT9 = evaluateEnhancementExact(l, d, bestCfg.th10, 100, bestCfg.th8, e, u, suEok, pfEok, saleEok, bestCfg.stop78);
    if (Math.abs(checkT9.ev - bestCfg.ev) <= 1e-9) bestCfg.th9 = 100;

    const checkT8 = evaluateEnhancementExact(l, d, bestCfg.th10, bestCfg.th9, 100, e, u, suEok, pfEok, saleEok, bestCfg.stop78);
    if (Math.abs(checkT8.ev - bestCfg.ev) <= 1e-9) bestCfg.th8 = 100;

    const checkSt = evaluateEnhancementExact(l, d, bestCfg.th10, bestCfg.th9, bestCfg.th8, e, u, suEok, pfEok, saleEok, false);
    if (Math.abs(checkSt.ev - bestCfg.ev) <= 1e-9) bestCfg.stop78 = false;

    bestCfg.rawNoProt = rawNoProt;
    return bestCfg;
};

// 정렬 알고리즘: 빈도순, ㄱㄴㄷ순, ㄱㄴㄷ 역순, 레벨제한순(장비 전용), 레벨제한 역순(장비 전용)
const sortItemsOrVariants = (list, mode = currentSortMode) => {
    if (!Array.isArray(list)) return [];
    if (mode === 'korean') {
        return list.slice().sort((a, b) => a.name.localeCompare(b.name, 'ko', { numeric: true }));
    }
    if (mode === 'korean_desc') {
        return list.slice().sort((a, b) => b.name.localeCompare(a.name, 'ko', { numeric: true }));
    }
    if (mode === 'level_asc') {
        return list.slice().sort((a, b) => {
            const lvA = a.meta?.level !== undefined ? a.meta.level : 999;
            const lvB = b.meta?.level !== undefined ? b.meta.level : 999;
            if (lvA !== lvB) return lvA - lvB;
            return (b.count - a.count) || a.name.localeCompare(b.name, 'ko', { numeric: true });
        });
    }
    if (mode === 'level_desc') {
        return list.slice().sort((a, b) => {
            const lvA = a.meta?.level !== undefined ? a.meta.level : -1;
            const lvB = b.meta?.level !== undefined ? b.meta.level : -1;
            if (lvA !== lvB) return lvB - lvA;
            return (b.count - a.count) || a.name.localeCompare(b.name, 'ko', { numeric: true });
        });
    }
    // 기본값: freq (빈도순 - 거래 건수 내림차순, 동률 시 가나다순)
    return list.slice().sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name, 'ko', { numeric: true }));
};

const updateSortUI = () => {
    // 액세서리는 렙제가 없으므로 레벨제한순, 레벨제한 역순 제외
    const availableSortModes = SORT_MODES.filter(m => !m.equipOnly || currentCategory === 'equip');
    if (!availableSortModes.some(m => m.key === currentSortMode)) {
        currentSortMode = 'freq';
    }

    // 1. 상단바 드롭다운 버튼 텍스트
    const sortText = document.getElementById('current-sort-text');
    if (sortText) {
        const curObj = availableSortModes.find(m => m.key === currentSortMode) || availableSortModes[0];
        sortText.textContent = `정렬: ${curObj.label}`;
    }

    // 2. 상단바 드롭다운 옵션 리스트 동적 렌더링
    const sortDropdownOptions = document.getElementById('sort-dropdown-options');
    if (sortDropdownOptions) {
        sortDropdownOptions.innerHTML = availableSortModes.map(m => {
            const isActive = m.key === currentSortMode;
            return `
                <button type="button" class="sort-select-option w-full text-left px-3.5 py-2 text-xs font-medium hover:bg-blue-50 flex items-center justify-between transition ${isActive ? 'text-blue-600 bg-blue-50/50 font-bold' : 'text-gray-700'}" data-sort="${m.key}">
                    <span>${m.label} <span class="text-[10px] text-gray-400 font-normal">(${m.desc})</span></span>
                    <span class="sort-check text-blue-600 font-bold ${isActive ? '' : 'hidden'}">✓</span>
                </button>
            `;
        }).join('');

        sortDropdownOptions.querySelectorAll('.sort-select-option').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                setSortMode(btn.dataset.sort);
                toggleSortDropdown(true);
            };
        });
    }

    // 3. 사이드바 정렬 버튼 그리드 동적 렌더링 (#sidebar-sort-group)
    const sidebarSortGroup = document.getElementById('sidebar-sort-group');
    if (sidebarSortGroup) {
        sidebarSortGroup.innerHTML = availableSortModes.map(m => {
            const isActive = m.key === currentSortMode;
            const cls = isActive
                ? 'bg-blue-600 text-white font-bold shadow-xs'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium';
            const spanCls = (m.key === 'freq') ? 'col-span-2' : '';
            return `<button type="button" class="sidebar-sort-btn py-1.5 px-2 rounded-lg text-xs transition text-center ${spanCls} ${cls}" data-sort="${m.key}">${m.label}</button>`;
        }).join('');

        sidebarSortGroup.querySelectorAll('.sidebar-sort-btn').forEach(btn => {
            btn.onclick = () => {
                setSortMode(btn.dataset.sort);
            };
        });
    }
};

const setSortMode = (mode) => {
    const availableSortModes = SORT_MODES.filter(m => !m.equipOnly || currentCategory === 'equip');
    if (!availableSortModes.some(m => m.key === mode)) return;
    currentSortMode = mode;
    try {
        localStorage.setItem('farm_sort_mode', mode);
    } catch (e) {}

    updateSortUI();

    visibleLimit = BATCH_SIZE;
    const currentSearch = document.getElementById('search-input')?.value || '';
    renderGrid(currentSearch);
};

// --- CSS INJECTION (Force Overlay Fix) ---
const style = document.createElement('style');
style.innerHTML = `
    #modal-overlay, #mobile-sidebar-overlay {
        pointer-events: none !important;
        display: none !important; 
    }
    #modal-overlay.active, #mobile-sidebar-overlay.active {
        pointer-events: auto !important;
        display: flex !important;
    }
`;
document.head.appendChild(style);

// --- DOM ELEMENTS ---
let elements = {};

const init = () => {
    try {
        console.log("App initializing...");

        // 1. Bind Elements
        elements = {
            grid: document.getElementById('item-grid'),
            filterBtns: document.querySelectorAll('.filter-btn'),
            dynamicFilters: document.getElementById('dynamic-filters'),
            modalOverlay: document.getElementById('modal-overlay'),
            modalContent: document.getElementById('modal-content'),
            closeModalBtn: document.getElementById('close-modal'),
            modalTitle: document.getElementById('modal-title'),
            modalSubtitle: document.getElementById('modal-subtitle'),
            modalEquipBadges: document.getElementById('modal-equip-badges'),
            equipDetailDrawer: document.getElementById('equip-detail-drawer'),
            matrixContainer: document.getElementById('matrix-container'),
            statPrice: { textContent: '', style: {} }, // Safety stub (Prevent Firefox null-pointer)
            marketSummaryCard: document.getElementById('market-summary-card'),
            enhanceSimCard: document.getElementById('enhance-sim-card'),
            chartCanvas: document.getElementById('priceChart'),
            chartPlaceholder: document.getElementById('chart-placeholder'),
            sidebar: document.getElementById('sidebar'),
            openSidebarBtn: document.getElementById('open-sidebar'),
            closeSidebarBtn: document.getElementById('close-sidebar'),
            sidebarOverlay: document.getElementById('mobile-sidebar-overlay'),
            lastUpdateHeader: document.getElementById('last-update-header'),
            lastUpdateSidebar: document.getElementById('last-update-sidebar')
        };

        // 2. Setup Listeners
        setupEventListeners();

        // 3. Load Data
        loadData();

    } catch (e) {
        alert("초기화 실패: " + e.message);
    }
};

const loadData = () => {
    // data.txt 우선 시도, 실패시 window.FARM_DATA (data.js) 폴백
    fetch('data.txt?t=' + Date.now(), { cache: 'no-store' })
        .then(res => {
            if (!res.ok) throw new Error('data.txt not found');
            return res.text();
        })
        .then(text => {
            RAW_LINES = text.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0 && line.startsWith('('));
            gachaSpotCache = {};
            ITEM_INDEX = buildQuickIndex(RAW_LINES);
            updateLastUpdateUI(RAW_LINES);
            updateSortUI();
            renderFilters();
            renderGrid();
            renderGachaEVSection();
            renderClothesUpgradeSection();
        })
        .catch(() => {
            if (typeof window.FARM_DATA !== 'undefined') {
                RAW_LINES = Array.isArray(window.FARM_DATA) ? window.FARM_DATA : [];
                gachaSpotCache = {};
                ITEM_INDEX = buildQuickIndex(RAW_LINES);
                updateLastUpdateUI(RAW_LINES);
                renderFilters();
                renderGrid();
                renderGachaEVSection();
            } else {
                alert("데이터 파일을 찾을 수 없습니다. web/data.txt 또는 web/data.js가 필요합니다.");
            }
        });
};

// Helper: IQR Outiler Filter
const filterPriceOutliers = (history, multiplier = 3.0) => {
    const validPrices = history.map(h => h.price).filter(p => p > 0);
    if (validPrices.length < 4) return history; // Not enough data for IQR

    validPrices.sort((a, b) => a - b);
    const n = validPrices.length;
    const q1 = validPrices[Math.floor(n / 4)];
    const q3 = validPrices[Math.floor((3 * n) / 4)];
    let iqr = q3 - q1;

    // 만약 데이터 대부분이 동일한 가격이라 IQR이 0이 되면 모든 다른 가격이 필터링되는 문제 해결
    if (iqr === 0) {
        iqr = Math.max(q3 * 0.5, 1.0); // 변동폭 0일 경우 기준가의 50% 또는 최소 1.0억의 오차 허용
    }

    const lowerBound = q1 - (multiplier * iqr);
    const upperBound = q3 + (multiplier * iqr);

    return history.filter(h => h.price <= 0 || (h.price >= lowerBound && h.price <= upperBound));
};

// --- UPDATE LAST UPDATE UI: 데이터 기반 최신 날짜 표시 ---
const updateLastUpdateUI = (lines) => {
    if (!lines || lines.length === 0) return;

    let latest = null;

    for (const line of lines) {
        const clean = line.replace(/^\(|\)$/g, '');
        const dateStr = clean.split(',')[0].trim();
        const parts = dateStr.split('.');
        if (parts.length < 3) continue;

        // 날짜 비교용 Date 객체 생성
        const d = new Date(parts[0], parts[1] - 1, parts[2], parts[3] || 0, parts[4] || 0);
        if (!latest || d > latest) {
            latest = d;
        }
    }

    if (latest && (elements.lastUpdateHeader || elements.lastUpdateSidebar)) {
        const y = latest.getFullYear();
        const m = String(latest.getMonth() + 1).padStart(2, '0');
        const d = String(latest.getDate()).padStart(2, '0');
        const formatted = `${y}.${m}.${d}`;

        if (elements.lastUpdateHeader) {
            elements.lastUpdateHeader.textContent = formatted;
        }
        if (elements.lastUpdateSidebar) {
            elements.lastUpdateSidebar.innerHTML = `업데이트: ${formatted}<br>프로토타입 v0.1`;
        }
    }
};

// ============================================================================
// 4-1. 액세서리(장신구) 상세 메타데이터 & 효과 정보 DB
// ============================================================================
const ACC_META_DB = {
    // --- 1. 바람의 액세서리 (오로지 금 장신구만 존재, 다이아/은 없음, 배경 하늘색) ---
    '바씨': {
        officialName: '바람의 씨앗 액세서리',
        group: '바람',
        tags: ['바람'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-sky-100 text-sky-800 border-sky-200',
        target: '씨앗 뿌리기',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '씨앗을 뿌릴 때 순간이동합니다.',
        grades: { '금': '순간이동 발동 (오로지 금 등급만 존재)' },
        desc: '특정 작업을 수행할 때 순간이동합니다. 오로지 금 장신구만 있으며, 다이아와 은 등급은 없습니다. (배경색: 하늘색)'
    },
    '바새': {
        officialName: '바람의 새싹 액세서리',
        group: '바람',
        tags: ['바람'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-sky-100 text-sky-800 border-sky-200',
        target: '모종 심기',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '모종을 심을 때 순간이동합니다.',
        grades: { '금': '순간이동 발동 (오로지 금 등급만 존재)' },
        desc: '모종을 심을 때 순간이동합니다. 오로지 금 장신구만 있습니다. (배경색: 하늘색)'
    },
    '바발': {
        officialName: '바람의 발톱 액세서리',
        group: '바람',
        tags: ['바람'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-sky-100 text-sky-800 border-sky-200',
        target: '밭 갈기 (괭이질)',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '밭을 갈 때 순간이동합니다.',
        grades: { '금': '순간이동 발동 (오로지 금 등급만 존재)' },
        desc: '밭을 갈 때 순간이동합니다. 오로지 금 장신구만 있습니다. (배경색: 하늘색)'
    },
    '바손': {
        officialName: '바람의 손톱 액세서리',
        group: '바람',
        tags: ['바람'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-sky-100 text-sky-800 border-sky-200',
        target: '밭 갈아엎기',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '밭을 갈아엎을 때 순간이동합니다.',
        grades: { '금': '순간이동 발동 (오로지 금 등급만 존재)' },
        desc: '밭을 갈아엎을 때 순간이동합니다. 오로지 금 장신구만 있습니다. (배경색: 하늘색)'
    },
    '바흙': {
        officialName: '바람의 흙 액세서리',
        group: '바람',
        tags: ['바람'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-sky-100 text-sky-800 border-sky-200',
        target: '밑거름 주기',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '밑거름을 줄 때 순간이동합니다.',
        grades: { '금': '순간이동 발동 (오로지 금 등급만 존재)' },
        desc: '밑거름을 줄 때 순간이동합니다. 오로지 금 장신구만 있습니다. (배경색: 하늘색)'
    },
    '바진': {
        officialName: '바람의 진액 액세서리',
        group: '바람',
        tags: ['바람'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-sky-100 text-sky-800 border-sky-200',
        target: '덧거름 주기',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '덧거름을 줄 때 순간이동합니다.',
        grades: { '금': '순간이동 발동 (오로지 금 등급만 존재)' },
        desc: '덧거름을 줄 때 순간이동합니다. 오로지 금 장신구만 있습니다. (배경색: 하늘색)'
    },
    '바칼': {
        officialName: '바람의 칼날 액세서리',
        group: '바람',
        tags: ['바람'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-sky-100 text-sky-800 border-sky-200',
        target: '작물 수확 (낫질)',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '작물을 수확할 때 순간이동합니다.',
        grades: { '금': '순간이동 발동 (오로지 금 등급만 존재)' },
        desc: '작물을 수확할 때 순간이동합니다. 오로지 금 장신구만 있습니다. (배경색: 하늘색)'
    },
    '바물': {
        officialName: '바람의 물방울 액세서리',
        group: '바람',
        tags: ['바람'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-sky-100 text-sky-800 border-sky-200',
        target: '물 주기 (물뿌리개)',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '물을 줄 때 순간이동합니다.',
        grades: { '금': '순간이동 발동 (오로지 금 등급만 존재)' },
        desc: '물을 줄 때 순간이동합니다. 오로지 금 장신구만 있습니다. (배경색: 하늘색)'
    },
    '바생': {
        officialName: '바람의 생육 액세서리',
        group: '바람',
        tags: ['바람'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-sky-100 text-sky-800 border-sky-200',
        target: '생육 개선제 살포',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '생육 개선제를 뿌릴 때 순간이동합니다.',
        grades: { '금': '순간이동 발동 (오로지 금 등급만 존재)' },
        desc: '생육 개선제를 뿌릴 때 순간이동합니다. 오로지 금 장신구만 있습니다. (배경색: 하늘색)'
    },

    // --- 2. 활력의 액세서리 (다이아/금/은, 배경 빨간색, 체력 절감) ---
    '활씨': {
        officialName: '활력의 씨앗 액세서리',
        group: '활력',
        tags: ['활력'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-red-100 text-red-800 border-red-200',
        target: '씨앗 뿌리기',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '씨앗을 뿌릴 때 체력을 절감해 줍니다.',
        grades: { '다': '체력 -8 절감', '금': '체력 -4 절감', '은': '체력 -2 절감' },
        desc: '특정 작업을 수행할 때 체력을 절감해 줍니다. 다이아 8, 금 4, 은 2 체력을 아낄 수 있습니다. (배경색: 빨간색)'
    },
    '활생': {
        officialName: '활력의 생육 액세서리',
        group: '활력',
        tags: ['활력'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-red-100 text-red-800 border-red-200',
        target: '생육 개선제 살포',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '생육 개선제를 뿌릴 때 체력을 절감해 줍니다.',
        grades: { '다': '체력 -8 절감', '금': '체력 -4 절감', '은': '체력 -2 절감' },
        desc: '생육 개선제를 뿌릴 때 체력을 아낄 수 있습니다. (다이아 -8, 금 -4, 은 -2)'
    },

    // --- 3. 신속의 액세서리 (다이아/금/은, 배경 남색, 작업 시간 단축) ---
    '신씨': {
        officialName: '신속의 씨앗 액세서리',
        group: '신속',
        tags: ['신속'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        target: '씨앗 뿌리기',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '씨앗을 뿌릴 때 시간을 줄여 줍니다.',
        grades: { '다': '작업시간 -3초 단축', '금': '작업시간 -2초 단축', '은': '작업시간 -1초 단축' },
        desc: '특정 작업을 수행할 때 시간을 줄여 줍니다. 다이아 3초, 금 2초, 은 1초 단축됩니다. (배경색: 남색)'
    },
    '신생': {
        officialName: '신속의 생육 액세서리',
        group: '신속',
        tags: ['신속'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        target: '생육 개선제 살포',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '생육 개선제를 뿌릴 때 시간을 줄여 줍니다.',
        grades: { '다': '작업시간 -3초 단축', '금': '작업시간 -2초 단축', '은': '작업시간 -1초 단축' },
        desc: '생육 개선제를 뿌릴 때 작업 시간을 대폭 줄여 줍니다. (다이아 -3초, 금 -2초, 은 -1초)'
    },

    // --- 4. 재료드롭의 액세서리 (다이아 100%, 금 50%, 은 25%, 배경 주황색) ---
    '고미': {
        officialName: '고농축 미네랄의 액세서리',
        group: '재료',
        tags: ['재료'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-amber-100 text-amber-900 border-amber-200',
        target: '작물 수확 또는 갈아엎기',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '수확 또는 갈아엎기 시 나오는 아이템을 고농축 미네랄로 변환합니다.',
        grades: { '다': '변환 확률 100%', '금': '변환 확률 50%', '은': '변환 확률 25%' },
        desc: '작물을 갈아엎거나 수확할 때 나오는 아이템을 정해진 재료로 변환시켜 줍니다. 다이아는 100% 확정 변환입니다. (배경색: 주황색)'
    },
    '미네랄': {
        officialName: '미네랄의 액세서리',
        group: '재료',
        tags: ['재료'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-amber-100 text-amber-900 border-amber-200',
        target: '작물 수확 또는 갈아엎기',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '수확 또는 갈아엎기 시 나오는 아이템을 미네랄로 변환합니다.',
        grades: { '다': '변환 확률 100%', '금': '변환 확률 50%', '은': '변환 확률 25%' },
        desc: '수확 또는 갈아엎기 시 나오는 아이템을 미네랄로 변환시켜 줍니다. (다이아 100%, 금 50%, 은 25%)'
    },
    '시균': {
        officialName: '시간의 균열의 액세서리',
        group: '재료',
        tags: ['재료'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-amber-100 text-amber-900 border-amber-200',
        target: '작물 수확 또는 갈아엎기',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '수확 또는 갈아엎기 시 나오는 아이템을 시간의 균열로 변환합니다.',
        grades: { '다': '변환 확률 100%', '금': '변환 확률 50%', '은': '변환 확률 25%' },
        desc: '수확 또는 갈아엎기 시 나오는 아이템을 시간의 균열로 변환시켜 줍니다. (다이아 100%, 금 50%, 은 25%)'
    },
    '농아': {
        officialName: '농축 발효 아미노산의 액세서리',
        group: '재료',
        tags: ['재료'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-amber-100 text-amber-900 border-amber-200',
        target: '작물 수확 또는 갈아엎기',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '수확 또는 갈아엎기 시 나오는 아이템을 농축 발효 아미노산으로 변환합니다.',
        grades: { '다': '변환 확률 100%', '금': '변환 확률 50%', '은': '변환 확률 25%' },
        desc: '수확 또는 갈아엎기 시 나오는 아이템을 농축 발효 아미노산으로 변환시켜 줍니다. (다이아 100%, 금 50%, 은 25%)'
    },
    '아미노산': {
        officialName: '아미노산의 액세서리',
        group: '재료',
        tags: ['재료'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-amber-100 text-amber-900 border-amber-200',
        target: '작물 수확 또는 갈아엎기',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '수확 또는 갈아엎기 시 나오는 아이템을 아미노산으로 변환합니다.',
        grades: { '다': '변환 확률 100%', '금': '변환 확률 50%', '은': '변환 확률 25%' },
        desc: '수확 또는 갈아엎기 시 나오는 아이템을 아미노산으로 변환시켜 줍니다. (다이아 100%, 금 50%, 은 25%)'
    },
    '키토': {
        officialName: '키토산의 액세서리',
        group: '재료',
        tags: ['재료'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-amber-100 text-amber-900 border-amber-200',
        target: '작물 수확 또는 갈아엎기',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '수확 또는 갈아엎기 시 나오는 아이템을 키토산으로 변환합니다.',
        grades: { '다': '변환 확률 100%', '금': '변환 확률 50%', '은': '변환 확률 25%' },
        desc: '수확 또는 갈아엎기 시 나오는 아이템을 키토산으로 변환시켜 줍니다. (다이아 100%, 금 50%, 은 25%)'
    },
    '앰플': {
        officialName: '천연 호르몬 앰플의 액세서리',
        group: '재료',
        tags: ['재료'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-amber-100 text-amber-900 border-amber-200',
        target: '작물 수확 또는 갈아엎기',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '수확 또는 갈아엎기 시 나오는 아이템을 천연 호르몬 앰플로 변환합니다.',
        grades: { '다': '변환 확률 100%', '금': '변환 확률 50%', '은': '변환 확률 25%' },
        desc: '수확 또는 갈아엎기 시 나오는 아이템을 천연 호르몬 앰플로 변환시켜 줍니다. (다이아 100%, 금 50%, 은 25%)'
    },
    '타우': {
        officialName: '고농축 타우린의 액세서리',
        group: '재료',
        tags: ['재료'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-amber-100 text-amber-900 border-amber-200',
        target: '작물 수확 또는 갈아엎기',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '수확 또는 갈아엎기 시 나오는 아이템을 고농축 타우린으로 변환합니다.',
        grades: { '다': '변환 확률 100%', '금': '변환 확률 50%', '은': '변환 확률 25%' },
        desc: '수확 또는 갈아엎기 시 나오는 아이템을 고농축 타우린으로 변환시켜 줍니다. (다이아 100%, 금 50%, 은 25%)'
    },
    '효소': {
        officialName: '효소의 액세서리',
        group: '재료',
        tags: ['재료'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-amber-100 text-amber-900 border-amber-200',
        target: '작물 수확 또는 갈아엎기',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '수확 또는 갈아엎기 시 나오는 아이템을 효소로 변환합니다.',
        grades: { '다': '변환 확률 100%', '금': '변환 확률 50%', '은': '변환 확률 25%' },
        desc: '수확 또는 갈아엎기 시 나오는 아이템을 효소로 변환시켜 줍니다. (다이아 100%, 금 50%, 은 25%)'
    },

    // --- 5. 발굴의 액세서리 (다 50%, 금 20%, 은 10%, 배경 갈색) ---
    '발굴': {
        officialName: '발굴의 액세서리',
        group: '발굴',
        tags: ['발굴'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-amber-200 text-amber-950 border-amber-300',
        target: '작물 수확 또는 갈아엎기',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '작물을 갈아엎거나 수확할 때 나오는 아이템을 일정 확률로 1개 추가합니다.',
        grades: { '다': '추가 획득 확률 50%', '금': '추가 획득 확률 20%', '은': '추가 획득 확률 10%' },
        desc: '작물을 갈아엎거나 수확할 때 나오는 아이템을 일정 확률에 따라 하나 추가시켜 줍니다. 다이아 50%, 금 20%, 은 10%입니다. (배경색: 갈색)'
    },

    // --- 6. 하루 경험의 액세서리 (다 200%, 금 100%, 은 50%, 배경 분홍색) ---
    '하경': {
        officialName: '하루 경험의 액세서리',
        group: '하레',
        tags: ['하레'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-pink-100 text-pink-800 border-pink-200',
        target: '일일 퀘스트 성공',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '일일 퀘스트 성공 시 제공하는 경험치를 추가 제공합니다.',
        grades: { '다': '경험치 +200% 추가', '금': '경험치 +100% 추가', '은': '경험치 +50% 추가' },
        desc: '일일 퀘스트 성공 시 제공하는 경험치를 추가로 제공합니다. 다이아는 200%, 금은 100%, 은은 50%의 경험치를 추가해 줍니다. (배경색: 분홍색)'
    },

    // --- 7. 하루 레알의 액세서리 (다 3개, 금 2개, 은 1개, 배경 초록색) ---
    '하레': {
        officialName: '하루 레알의 액세서리',
        group: '하레',
        tags: ['하레'],
        box: '쥬얼리박 (77레알)',
        colorBadge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        target: '일일 퀘스트 성공',
        equipGuide: '목걸이 / 반지 동일 기능',
        effectSummary: '일일 퀘스트 성공 시 제공하는 레알을 추가 제공합니다.',
        grades: { '다': '레알 +3개 추가', '금': '레알 +2개 추가', '은': '레알 +1개 추가' },
        desc: '일일 퀘스트 성공 시 제공하는 레알을 추가로 제공합니다. 다이아는 3개, 금은 2개, 은은 1개의 레알을 추가해 줍니다. (배경색: 초록색)'
    },

    // --- 8. 친환경농장 재료드롭 액세서리 (에코, 은 10%, 금 20%, 다 50%) ---
    'EM': {
        officialName: 'EM발효액의 액세서리',
        group: '친환경 재료',
        tags: ['에코', '재료'],
        box: '에코 쥬얼리박 (77레알)',
        colorBadge: 'bg-teal-100 text-teal-800 border-teal-200',
        target: '친환경농장 작업',
        equipGuide: '친환경농장 전용',
        effectSummary: '친환경농장에서 필요한 EM발효액 드롭률을 높여 줍니다.',
        grades: { '다': '드롭률 +50%', '금': '드롭률 +20%', '은': '드롭률 +10%' },
        desc: '친환경농장에서만 기능이 발동됩니다. (은 10%, 금 20%, 다이아 50%)'
    },
    '이리응애': {
        officialName: '이리응애 알의 액세서리',
        group: '친환경 재료',
        tags: ['에코', '재료'],
        box: '에코 쥬얼리박 (77레알)',
        colorBadge: 'bg-teal-100 text-teal-800 border-teal-200',
        target: '친환경농장 작업',
        equipGuide: '친환경농장 전용',
        effectSummary: '친환경농장에서 이리응애 알 드롭률을 높여 줍니다.',
        grades: { '다': '드롭률 +50%', '금': '드롭률 +20%', '은': '드롭률 +10%' },
        desc: '친환경농장에서만 기능이 발동됩니다. (은 10%, 금 20%, 다이아 50%)'
    },
    '천연방제균': {
        officialName: '천연방제균의 액세서리',
        group: '친환경 재료',
        tags: ['에코', '재료'],
        box: '에코 쥬얼리박 (77레알)',
        colorBadge: 'bg-teal-100 text-teal-800 border-teal-200',
        target: '친환경농장 작업',
        equipGuide: '친환경농장 전용',
        effectSummary: '친환경농장에서 천연방제균 드롭률을 높여 줍니다.',
        grades: { '다': '드롭률 +50%', '금': '드롭률 +20%', '은': '드롭률 +10%' },
        desc: '친환경농장에서만 기능이 발동됩니다. (은 10%, 금 20%, 다이아 50%)'
    },
    '무당벌레알': {
        officialName: '무당벌레 알의 액세서리',
        group: '친환경 재료',
        tags: ['에코', '재료'],
        box: '에코 쥬얼리박 (77레알)',
        colorBadge: 'bg-teal-100 text-teal-800 border-teal-200',
        target: '친환경농장 작업',
        equipGuide: '친환경농장 전용',
        effectSummary: '친환경농장에서 무당벌레 알 드롭률을 높여 줍니다.',
        grades: { '다': '드롭률 +50%', '금': '드롭률 +20%', '은': '드롭률 +10%' },
        desc: '친환경농장에서만 기능이 발동됩니다. (은 10%, 금 20%, 다이아 50%)'
    },
    '먹이응애': {
        officialName: '먹이응애의 액세서리',
        group: '친환경 재료',
        tags: ['에코', '재료'],
        box: '에코 쥬얼리박 (77레알)',
        colorBadge: 'bg-teal-100 text-teal-800 border-teal-200',
        target: '친환경농장 작업',
        equipGuide: '친환경농장 전용',
        effectSummary: '친환경농장에서 먹이응애 드롭률을 높여 줍니다.',
        grades: { '다': '드롭률 +50%', '금': '드롭률 +20%', '은': '드롭률 +10%' },
        desc: '친환경농장에서만 기능이 발동됩니다. (은 10%, 금 20%, 다이아 50%)'
    },
    '먹이진딧물': {
        officialName: '먹이진딧물의 액세서리',
        group: '친환경 재료',
        tags: ['에코', '재료'],
        box: '에코 쥬얼리박 (77레알)',
        colorBadge: 'bg-teal-100 text-teal-800 border-teal-200',
        target: '친환경농장 작업',
        equipGuide: '친환경농장 전용',
        effectSummary: '친환경농장에서 먹이진딧물 드롭률을 높여 줍니다.',
        grades: { '다': '드롭률 +50%', '금': '드롭률 +20%', '은': '드롭률 +10%' },
        desc: '친환경농장에서만 기능이 발동됩니다. (은 10%, 금 20%, 다이아 50%)'
    },
    '고효': {
        officialName: '고농축 효소의 액세서리',
        group: '친환경 재료',
        tags: ['에코', '재료'],
        box: '에코 쥬얼리박 (77레알)',
        colorBadge: 'bg-teal-100 text-teal-800 border-teal-200',
        target: '친환경농장 작업',
        equipGuide: '친환경농장 전용',
        effectSummary: '친환경농장에서 고농축 효소 드롭률을 높여 줍니다.',
        grades: { '다': '드롭률 +50%', '금': '드롭률 +20%', '은': '드롭률 +10%' },
        desc: '친환경농장에서만 기능이 발동됩니다. (은 10%, 금 20%, 다이아 50%)'
    },
    '미생물방제균': {
        officialName: '미생물방제제의 액세서리',
        group: '친환경 재료',
        tags: ['에코', '재료'],
        box: '에코 쥬얼리박 (77레알)',
        colorBadge: 'bg-teal-100 text-teal-800 border-teal-200',
        target: '친환경농장 작업',
        equipGuide: '친환경농장 전용',
        effectSummary: '친환경농장에서 미생물방제제 드롭률을 높여 줍니다.',
        grades: { '다': '드롭률 +50%', '금': '드롭률 +20%', '은': '드롭률 +10%' },
        desc: '친환경농장에서만 기능이 발동됩니다. (은 10%, 금 20%, 다이아 50%)'
    },
    '농축유산균': {
        officialName: '농축 유산균의 액세서리',
        group: '친환경 재료',
        tags: ['에코', '재료'],
        box: '에코 쥬얼리박 (77레알)',
        colorBadge: 'bg-teal-100 text-teal-800 border-teal-200',
        target: '친환경농장 작업',
        equipGuide: '친환경농장 전용',
        effectSummary: '친환경농장에서 농축 유산균 드롭률을 높여 줍니다.',
        grades: { '다': '드롭률 +50%', '금': '드롭률 +20%', '은': '드롭률 +10%' },
        desc: '친환경농장에서만 기능이 발동됩니다. (은 10%, 금 20%, 다이아 50%)'
    },
    '진디벌': {
        officialName: '진디벌 알의 액세서리',
        group: '친환경 재료',
        tags: ['에코', '재료'],
        box: '에코 쥬얼리박 (77레알)',
        colorBadge: 'bg-teal-100 text-teal-800 border-teal-200',
        target: '친환경농장 작업',
        equipGuide: '친환경농장 전용',
        effectSummary: '친환경농장에서 진디벌 알 드롭률을 높여 줍니다.',
        grades: { '다': '드롭률 +50%', '금': '드롭률 +20%', '은': '드롭률 +10%' },
        desc: '친환경농장에서만 기능이 발동됩니다. (은 10%, 금 20%, 다이아 50%)'
    },

    // --- 9. 친환경 신속 & 친환경 바람 (에코 장신구, 드론 등장으로 갈갈 시세 형성) ---
    '신치': {
        officialName: '신속의 치유 액세서리',
        group: '친환경 신속',
        tags: ['에코', '신속'],
        box: '에코 쥬얼리박 (77레알)',
        colorBadge: 'bg-cyan-100 text-cyan-800 border-cyan-200',
        target: '방제제 / 고추씨추출액 살포',
        equipGuide: '금 세트 착용 권장 (다이아는 세트 비추천)',
        effectSummary: '방제제와 고추씨추출액을 뿌릴 때 걸리는 시간을 줄여 줍니다.',
        grades: { '금': '세트 착용 시 3.7초 감축 (모션 감안, 표기 4초)', '다': '시간 3.0초 감축', '은': '시간 감축' },
        desc: '방제제와 고추씨추출액을 뿌릴 때 시간이 절약됩니다. 금 세트는 3.7초 감축되며 다이아는 3초 감축하므로 다이아는 세트 비추천. 드론 등장 후 갈갈 가격에 거래됩니다.'
    },
    '신살': {
        officialName: '신속의 살충 액세서리',
        group: '친환경 신속',
        tags: ['에코', '신속'],
        box: '에코 쥬얼리박 (77레알)',
        colorBadge: 'bg-cyan-100 text-cyan-800 border-cyan-200',
        target: '천적생물 방사',
        equipGuide: '금 세트 착용 권장 (다이아는 세트 비추천)',
        effectSummary: '천적생물을 뿌릴 때 걸리는 시간을 줄여 줍니다.',
        grades: { '금': '세트 착용 시 3.7초 감축 (모션 감안, 표기 4초)', '다': '시간 3.0초 감축', '은': '시간 감축' },
        desc: '천적생물을 뿌릴 때 시간이 절약됩니다. 금 세트는 3.7초 감축되며 다이아는 3초 감축하므로 다이아는 세트 비추천. 드론 등장 후 갈갈 가격에 거래됩니다.'
    },
    '바치': {
        officialName: '바람의 치유 액세서리 (바치)',
        group: '친환경 바람',
        tags: ['에코', '바람'],
        box: '듀얼리박 (265레알)',
        colorBadge: 'bg-sky-100 text-sky-800 border-sky-200',
        target: '방제제 / 고추씨추출액 살포',
        equipGuide: '친환경농장 전용',
        effectSummary: '방제제와 고추씨추출액을 뿌릴 때 순간이동합니다.',
        grades: { '금': '순간이동 발동' },
        desc: '방제제와 고추씨추출액을 뿌릴 때 순간이동합니다. 드론 등장 후 갈갈 가격에 거래됩니다.'
    },
    '바살': {
        officialName: '바람의 살충 액세서리 (바살)',
        group: '친환경 바람',
        tags: ['에코', '바람'],
        box: '듀얼리박 (265레알)',
        colorBadge: 'bg-sky-100 text-sky-800 border-sky-200',
        target: '천적생물 방사',
        equipGuide: '친환경농장 전용',
        effectSummary: '천적생물을 뿌릴 때 순간이동합니다.',
        grades: { '금': '순간이동 발동' },
        desc: '천적생물을 뿌릴 때 순간이동합니다. 드론 등장 후 갈갈 가격에 거래됩니다.'
    },

    // --- 10. 특수 & 12지신 기념 액세서리 ---
    '찰나': {
        officialName: '찰나의 발걸음 액세서리',
        group: '특수',
        tags: ['특수'],
        box: '듀얼리박 (265레알)',
        colorBadge: 'bg-purple-100 text-purple-800 border-purple-200',
        target: '밭과 밭 사이 이동',
        equipGuide: '세트 착용 시 효율 극대화',
        effectSummary: '밭과 밭 사이를 이동할 때 시간을 절감시켜 줍니다.',
        grades: { '다': '이동시간 대폭 절감', '금': '이동시간 절감', '은': '이동시간 소폭 절감' },
        desc: '밭과 밭 사이를 이동할 때 시간을 절감시켜 주며 은, 금, 다이아 모두 세트 착용 시 효율이 좋습니다.'
    },
    '다그닥': {
        officialName: '다그닥 액세서리',
        group: '특수',
        tags: ['특수'],
        box: '이벤트 / 행사',
        colorBadge: 'bg-purple-100 text-purple-800 border-purple-200',
        target: '농장 이동',
        equipGuide: '이동속도 증가',
        effectSummary: '농장 이동 속도를 비약적으로 높여 주는 희귀 장신구입니다.',
        grades: { '다': '이동속도 대폭 증가', '금': '이동속도 증가' },
        desc: '이벤트 행사로 얻을 수 있는 희귀한 액세서리로 입수 확률이 극히 낮습니다.'
    },
    '뱀뱀': {
        officialName: '뱀뱀 액세서리',
        group: '특수',
        tags: ['특수'],
        box: '12지신 이벤트',
        colorBadge: 'bg-purple-100 text-purple-800 border-purple-200',
        target: '특수 효과',
        equipGuide: '12지신 한정',
        effectSummary: '12지신 뱀의 해 기념 특수 장신구입니다.',
        grades: { '다': '12지신 기념 특수 효과', '금': '12지신 기념 특수 효과' },
        desc: '12지신 이벤트 한정 기념 장신구입니다.'
    },
    '청룡': {
        officialName: '청룡 액세서리',
        group: '특수',
        tags: ['특수'],
        box: '청룡의 해 이벤트',
        colorBadge: 'bg-purple-100 text-purple-800 border-purple-200',
        target: '특수 효과',
        equipGuide: '청룡 한정',
        effectSummary: '청룡의 해 기념 특수 장신구입니다.',
        grades: { '다': '12지신 기념 특수 효과', '금': '12지신 기념 특수 효과' },
        desc: '청룡의 해 이벤트 한정 기념 장신구입니다.'
    },
    '갈갈': {
        officialName: '갈갈 액세서리',
        group: '갈갈',
        tags: ['갈갈'],
        box: '융해시설용',
        colorBadge: 'bg-gray-100 text-gray-700 border-gray-300',
        target: '융해 분해',
        equipGuide: '융해하여 조각 획득',
        effectSummary: '융해시설에서 갈아버려 조각을 얻는 장신구들입니다.',
        grades: { '다': '다이아 조각 획득', '금': '금 조각 획득', '은': '은 조각 획득' },
        desc: '갈갈액세란 융해시설에서 갈아버려 조각을 얻는 장신구들로, 최저가 시세에 거래됩니다.'
    }
};

const DUAL_ACC_PART_MAP = [
    ['씨앗', '씨앗'], ['새싹', '새싹'], ['발톱', '발톱'], ['손톱', '손톱'],
    ['흙', '흙'], ['진액', '진액'], ['칼날', '칼날'], ['물방울', '물방울'],
    ['생육', '생육'], ['치유', '치유'], ['살충', '살충'],
    ['씨', '씨앗'], ['새', '새싹'], ['발', '발톱'], ['손', '손톱'],
    ['진', '진액'], ['칼', '칼날'], ['물', '물방울'], ['생', '생육'],
    ['치', '치유'], ['살', '살충']
];

const getDualAccFullName = (accName) => {
    if (!accName) return accName;
    if (accName === '바씨새') return '바람씨앗새싹';
    if (accName === '바새치유') return '바람새싹치유';
    if (accName === '바새살' || accName === '바람새싹살충') return '바람새싹살충';
    if (accName === '바칼물') return '바람칼날물방울';

    let rest = accName;
    let prefix = '';
    if (rest.startsWith('바람의 ')) {
        prefix = '바람';
        rest = rest.slice(4);
    } else if (rest.startsWith('바람')) {
        prefix = '바람';
        rest = rest.slice(2);
    } else if (rest.startsWith('바')) {
        prefix = '바람';
        rest = rest.slice(1);
    }
    if (!prefix) return accName;

    let result = prefix;
    let idx = 0;
    while (idx < rest.length) {
        let matched = false;
        for (const [abbr, full] of DUAL_ACC_PART_MAP) {
            if (rest.startsWith(abbr, idx)) {
                result += full;
                idx += abbr.length;
                matched = true;
                break;
            }
        }
        if (!matched) {
            result += rest[idx];
            idx += 1;
        }
    }
    return result;
};

const getAccMeta = (accName) => {
    if (ACC_META_DB[accName]) return ACC_META_DB[accName];
    // 동적 듀얼 액세서리 파싱 (예: 바람새싹살충, 바새치유, 바씨새, 바람의 흙진액 등)
    if (accName.startsWith('바람') || accName.startsWith('바') || accName.startsWith('듀')) {
        const tags = ['듀얼'];
        if (accName.includes('살') || accName.includes('치') || accName.includes('에코')) {
            tags.push('에코');
        }
        if (accName.startsWith('바') || accName.includes('바람')) {
            tags.push('바람');
        }
        return {
            officialName: `${getDualAccFullName(accName)} 액세서리`,
            group: '듀얼',
            tags,
            box: '듀얼리박 (265레알)',
            colorBadge: 'bg-violet-100 text-violet-800 border-violet-200',
            target: '복합 농사 작업',
            equipGuide: '오로지 다이아만 존재',
            effectSummary: '두 가지 기능을 동시에 가진 희귀 듀얼 장신구입니다.',
            grades: { '다': '두 가지 특수 기능 동시 발동' },
            desc: '두 가지 장신구에서 따온 이름을 가지고 있으며 수량이 극히 드뭅니다. 오로지 다이아 액세서리만 있으며 금이나 은 듀얼 액세서리는 없습니다.'
        };
    }
    return null;
};

const VALID_ACC_OPTIONS = new Set([
    // 일반 / 퀘스트 / 드롭
    '하레', '하경', '발굴', '시균', '타우', '앰플', '키토', '효소', '농아', '고미',
    '신생', '신씨', '활씨', '활생', '미네랄', '아미노산',
    // 바람의 액세서리 (오로지 금 등급만 존재, 쥬얼리박)
    '바손', '바씨', '바진', '바칼', '바새', '바물', '바발', '바생', '바흙',
    // 친환경 재료 드롭 (에코 쥬얼리박)
    '무당벌레알', '진디벌', '이리응애', '천연방제균', '먹이진딧물', '먹이응애',
    '미생물방제균', 'EM', '농축유산균', '고효',
    // 친환경 신속 & 친환경 바람
    '신치', '신살', '바치', '바살',
    // 경험의 액세서리
    '경씨', '경새', '경발', '경손', '경흙', '경진', '경물', '경생',
    // 특수 / 희귀 / 이벤트
    '찰나', '다그닥', '뱀뱀', '청룡', '갈갈'
]);

const normalizeAccOption = (rawOpt) => {
    let opt = (rawOpt || '').trim();
    if (!opt) return '';
    if (opt.toUpperCase() === 'EM') return 'EM';
    if (opt === '무당벌레' || opt === '무당벌레알') return '무당벌레알';
    if (opt === '미생물방제제' || opt === '미생물방제균') return '미생물방제균';
    return opt;
};

const isAllowedAccOption = (rawOpt) => {
    const opt = normalizeAccOption(rawOpt);
    if (!opt) return false;
    if (VALID_ACC_OPTIONS.has(opt)) return true;
    if (opt.startsWith('듀') || opt.startsWith('바람') || opt.startsWith('바')) return true;
    return false;
};

// --- QUICK INDEX: 빠른 1차 파싱 (아이템 이름 + 세부 셀 카운트 + 강레 시세 자동 추출) ---
const buildQuickIndex = (lines) => {
    const index = {};
    const reaHistory = [];

    for (let i = 0; i < lines.length; i++) {
        const clean = lines[i].replace(/^\(|\)$/g, '');
        const parts = clean.split(',');
        if (parts.length < 4) continue;
        const rawCat = parts[2].trim();
        const cat = mapCategory(rawCat);
        if (!cat) continue;

        let itemName, cellKey;
        if (rawCat === '장비') {
            if (parts.length < 8) continue;
            itemName = normalizeEquipKey(parts[3].trim());
            const enc = Math.round(Number(parts[5].trim()));
            let dur = Math.round(Number(parts[6].trim()));
            if (enc === 10) {
                dur = 10; // 10/10, 10/11, 10/12는 10/10으로 통일
            }
            const option = normalizeOptionVariantKey(parts[4].trim(), enc);
            cellKey = `${option}__${enc}_${dur}`;
        } else if (rawCat === '악세') {
            if (parts.length < 7) continue;
            const opt = normalizeAccOption(parts[5]);
            if (!isAllowedAccOption(opt)) continue; // 잡옵션 악세는 노출 제외
            itemName = opt;
            cellKey = parts[4].trim();
        } else if (rawCat === '재료') {
            if (parts.length < 6) continue;
            itemName = parts[3].trim();
            cellKey = parts[4].trim();
            // (레알, 강화) 데이터 수집 -> 보호제 가격 자동 산출용
            if (itemName === '레알' && cellKey === '강화') {
                const p = parseFloat(parts[5].trim()) || 0;
                if (p > 0) {
                    const dp = parts[0].trim().split('.');
                    if (dp.length >= 3) {
                        const dObj = new Date(dp[0], dp[1] - 1, dp[2], dp[3] || 0, dp[4] || 0);
                        reaHistory.push({
                            isoDate: dObj,
                            price: p,
                            meta: { nickname: parts[1].trim() }
                        });
                    }
                }
            }
        } else continue;

        if (!index[cat]) index[cat] = {};
        if (!index[cat][itemName]) {
            index[cat][itemName] = { count: 0, lineIndices: [], cellCounts: {} };
        }
        const entry = index[cat][itemName];
        entry.count++;
        entry.lineIndices.push(i);
        if (cellKey) {
            entry.cellCounts[cellKey] = (entry.cellCounts[cellKey] || 0) + 1;
        }
    }

    // 일반 <-> 튼튼 종결 셀(10_10, 9_9, 8_8, 7_7) 카운트 상호 합산
    if (index['equip']) {
        const equipIndex = index['equip'];
        const processedPartners = new Set();
        Object.keys(equipIndex).forEach(itemName => {
            const partnerName = getEquipPartnerKey(itemName);
            if (!partnerName || !equipIndex[partnerName]) return;
            const pairKey = [itemName, partnerName].sort().join('___');
            if (processedPartners.has(pairKey)) return;
            processedPartners.add(pairKey);

            const item = equipIndex[itemName];
            const partner = equipIndex[partnerName];

            const allKeys = new Set([...Object.keys(item.cellCounts), ...Object.keys(partner.cellCounts)]);
            for (const fullKey of allKeys) {
                const parts = fullKey.split('__');
                if (parts.length === 2 && COMPLETED_ENHANCE_CELLS.has(parts[1])) {
                    const combined = (item.cellCounts[fullKey] || 0) + (partner.cellCounts[fullKey] || 0);
                    item.cellCounts[fullKey] = combined;
                    partner.cellCounts[fullKey] = combined;
                }
            }
        });
    }

    // 강레(레알, 강화) 최신 적정 시세 자동 계산
    if (reaHistory.length > 0) {
        try {
            const reaAnalysis = computeMarketAnalysis(reaHistory);
            if (reaAnalysis && reaAnalysis.spotFair > 0) {
                GLOBAL_REA_PRICE_EOK = Number(reaAnalysis.spotFair.toFixed(4));
            }
        } catch (e) {
            console.warn('강레 시세 자동 계산 실패, 기본값 사용:', e);
        }
    }

    // 유효한 셀(3건 이상)이 하나라도 있는지 마킹
    Object.keys(index).forEach(cat => {
        Object.keys(index[cat]).forEach(itemName => {
            const item = index[cat][itemName];
            item.hasValidCell = Object.values(item.cellCounts).some(c => HIDE_UNDER_3 ? c >= 3 : true);
        });
    });

    return index;
};

// --- ON-DEMAND PROCESSING: 클릭 시 해당 아이템만 상세 처리 ---
const processItemOnDemand = (cat, itemName) => {
    const canonicalName = cat === 'equip' ? normalizeEquipKey(itemName) : itemName;
    const info = ITEM_INDEX[cat]?.[canonicalName];
    if (!info) return null;

    const equipMeta = cat === 'equip' ? getEquipMeta(canonicalName) : null;

    const item = {
        id: `${cat}_${canonicalName}`,
        category: cat,
        name: canonicalName,
        displayName: equipMeta ? equipMeta.officialName : canonicalName,
        equipMeta,
        variants: {},
        history: []
    };

    for (const idx of info.lineIndices) {
        const entry = parseRawLine(RAW_LINES[idx]);
        if (!entry) continue;

        const price = parseFloat(entry.price) || 0;
        if (price <= 0) continue;

        const dateParts = entry.date.split('.');
        const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], dateParts[3] || 0, dateParts[4] || 0);
        const historyItem = {
            date: dateObj.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }),
            isoDate: dateObj,
            price: price,
            meta: entry,
            rawLineIdx: idx
        };

        item.history.push(historyItem);

        let variantKey = "Default";
        if (cat === 'equip') variantKey = normalizeOptionVariantKey(entry.option || "노옵션", entry.enhancement);
        else if (cat === 'acc') variantKey = entry.grade || "일반";
        else if (cat === 'mat') variantKey = entry.grade || "일반";

        if (!item.variants[variantKey]) {
            const optMeta = cat === 'equip' ? getOptionMeta(variantKey, equipMeta) : null;
            item.variants[variantKey] = {
                name: variantKey,
                displayName: optMeta ? optMeta.officialName : variantKey,
                optMeta,
                matrix: {},
                rawMatrixAll: {}, // 3건 미만 셀도 강화 시뮬레이터 참조용으로 보관
                spotCache: {},
                history: [],
                count: 0
            };
        }

        const variantNode = item.variants[variantKey];
        variantNode.history.push(historyItem);
        variantNode.count++;

        if (cat === 'equip') {
            const enc = Math.round(Number(entry.enhancement));
            let dur = Math.round(Number(entry.durability));
            if (enc === 10) {
                dur = 10; // 10/10, 10/11, 10/12는 10/10으로 통일
                entry.durability = 10;
            }
            const key = `${enc}_${dur}`;
            if (!variantNode.matrix[key]) {
                variantNode.matrix[key] = { price: price, history: [], count: 0 };
            }
            variantNode.matrix[key].history.push(historyItem);
            variantNode.matrix[key].price = price;
            variantNode.matrix[key].count++;
        }
    }

    // 일반 <-> 튼튼 종결 셀(10_10, 9_9, 8_8, 7_7) 데이터 암묵적 병합
    if (cat === 'equip') {
        const partnerName = getEquipPartnerKey(canonicalName);
        const partnerInfo = partnerName ? ITEM_INDEX['equip']?.[partnerName] : null;
        if (partnerInfo) {
            for (const pIdx of partnerInfo.lineIndices) {
                const pEntry = parseRawLine(RAW_LINES[pIdx]);
                if (!pEntry) continue;

                const pPrice = parseFloat(pEntry.price) || 0;
                if (pPrice <= 0) continue;

                const pEnc = Math.round(Number(pEntry.enhancement));
                let pDur = Math.round(Number(pEntry.durability));
                if (pEnc === 10) {
                    pDur = 10;
                    pEntry.durability = 10;
                }
                const cellKey = `${pEnc}_${pDur}`;
                if (!COMPLETED_ENHANCE_CELLS.has(cellKey)) continue; // 10_10, 9_9, 8_8, 7_7만 병합!

                const pVariantKey = normalizeOptionVariantKey(pEntry.option || "노옵션", pEnc);

                if (!item.variants[pVariantKey]) {
                    const optMeta = getOptionMeta(pVariantKey, equipMeta);
                    item.variants[pVariantKey] = {
                        name: pVariantKey,
                        displayName: optMeta ? optMeta.officialName : pVariantKey,
                        optMeta,
                        matrix: {},
                        rawMatrixAll: {},
                        spotCache: {},
                        history: [],
                        count: 0
                    };
                }

                const vNode = item.variants[pVariantKey];
                const pDateParts = pEntry.date.split('.');
                const pDateObj = new Date(pDateParts[0], pDateParts[1] - 1, pDateParts[2], pDateParts[3] || 0, pDateParts[4] || 0);
                const pHistoryItem = {
                    date: pDateObj.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }),
                    isoDate: pDateObj,
                    price: pPrice,
                    meta: pEntry,
                    rawLineIdx: pIdx
                };

                if (!vNode.matrix[cellKey]) {
                    vNode.matrix[cellKey] = { price: pPrice, history: [], count: 0 };
                }
                vNode.matrix[cellKey].history.push(pHistoryItem);
                vNode.matrix[cellKey].count++;

                if (!vNode.rawMatrixAll[cellKey]) {
                    vNode.rawMatrixAll[cellKey] = { price: pPrice, history: [], count: 0 };
                }
                vNode.rawMatrixAll[cellKey].history.push(pHistoryItem);
                vNode.rawMatrixAll[cellKey].count++;
            }
        }
    }

    item.history.sort((a, b) => a.isoDate - b.isoDate);

    const validVariants = {};
    let hasValidVariant = false;

    Object.entries(item.variants).forEach(([vKey, v]) => {
        if (cat === 'equip') {
            const validMatrix = {};
            const allMatrix = {};
            let matrixValidCount = 0;

            Object.entries(v.matrix).forEach(([mKey, m]) => {
                m.count = m.history.length;
                m.history.sort((a, b) => (a.isoDate - b.isoDate) || ((a.rawLineIdx || 0) - (b.rawLineIdx || 0)));
                if (m.history.length > 0) {
                    m.price = m.history[m.history.length - 1].price;
                }
                allMatrix[mKey] = m;

                if (HIDE_UNDER_3 ? m.count >= 3 : true) {
                    validMatrix[mKey] = m;
                    matrixValidCount++;
                }
            });

            // 7강 vs 8강 시세 역전(8강이 7강보다 더 싼 모순적 시세) 검사 및 조건부 표본 병합
            // 사용자의 요청: "현재 가격이 역전되어있는 사례에 대해서만 둘을 합치는 방식을 한번 적용해봐라."
            const cell7 = allMatrix['7_7'];
            const cell8 = allMatrix['8_8'];
            if (cell7 && cell8 && Array.isArray(cell7.history) && Array.isArray(cell8.history) && cell7.history.length > 0 && cell8.history.length > 0) {
                let s7 = 0;
                let s8 = 0;
                try {
                    s7 = (typeof computeMarketAnalysis === 'function' ? computeMarketAnalysis(cell7.history)?.spotFair : null) || cell7.price || 0;
                    s8 = (typeof computeMarketAnalysis === 'function' ? computeMarketAnalysis(cell8.history)?.spotFair : null) || cell8.price || 0;
                } catch (e) {
                    s7 = cell7.price || 0;
                    s8 = cell8.price || 0;
                }

                if (s7 > 0 && s8 > 0 && s8 < s7) {
                    const seen = new Set();
                    const combinedHistory = [];
                    [...cell7.history, ...cell8.history].forEach(h => {
                        const k = h.rawLineIdx !== undefined ? h.rawLineIdx : `${h.isoDate?.getTime()}_${h.price}`;
                        if (!seen.has(k)) {
                            seen.add(k);
                            combinedHistory.push(h);
                        }
                    });
                    combinedHistory.sort((a, b) => (a.isoDate - b.isoDate) || ((a.rawLineIdx || 0) - (b.rawLineIdx || 0)));

                    const lastPrice = combinedHistory.length > 0 ? combinedHistory[combinedHistory.length - 1].price : cell7.price;

                    cell7.history = combinedHistory;
                    cell7.count = combinedHistory.length;
                    cell7.price = lastPrice;

                    cell8.history = combinedHistory;
                    cell8.count = combinedHistory.length;
                    cell8.price = lastPrice;

                    if (HIDE_UNDER_3 && combinedHistory.length >= 3) {
                        validMatrix['7_7'] = cell7;
                        validMatrix['8_8'] = cell8;
                    }
                    if (v.spotCache) v.spotCache = {};
                }
            }

            if (matrixValidCount > 0) {
                v.matrix = validMatrix;
                v.rawMatrixAll = allMatrix;
                v.count = v.history.length;
                v.history.sort((a, b) => a.isoDate - b.isoDate);
                validVariants[vKey] = v;
                hasValidVariant = true;
            }
        } else {
            v.count = v.history.length;

            if (HIDE_UNDER_3 ? v.count >= 3 : true) {
                v.history.sort((a, b) => a.isoDate - b.isoDate);
                validVariants[vKey] = v;
                hasValidVariant = true;
            }
        }
    });

    if (hasValidVariant) {
        item.allVariantsRaw = item.variants;
        item.variants = validVariants;
        return item;
    }
    return null;
};

// 특정 옵션 variant에서 (enc_dur) 셀의 적정 시세(spotFair)를 가져오는 헬퍼 (캐싱 포함)
const getVariantCellSpotPrice = (variant, cellKey, allowUnder3Fallback = false) => {
    if (!variant) return { price: 0, source: 'none', count: 0 };
    if (!variant.spotCache) variant.spotCache = {};

    const cacheKey = `${cellKey}__${allowUnder3Fallback ? 'all' : 'valid'}`;
    if (variant.spotCache[cacheKey]) return variant.spotCache[cacheKey];

    let cell = variant.matrix?.[cellKey];
    let source = 'valid';
    if (!cell && allowUnder3Fallback && variant.rawMatrixAll?.[cellKey]) {
        cell = variant.rawMatrixAll[cellKey];
        source = 'under3';
    }
    if (!cell || !cell.history || cell.history.length === 0) {
        const res = { price: 0, source: 'none', count: 0 };
        variant.spotCache[cacheKey] = res;
        return res;
    }

    const analysis = computeMarketAnalysis(cell.history);
    const spot = analysis ? Number(analysis.spotFair.toFixed(2)) : Number(cell.price.toFixed(2));
    const res = { price: spot, source, count: cell.history.length };
    variant.spotCache[cacheKey] = res;
    return res;
};

const parseRawLine = (line) => {
    const clean = line.replace(/^\(|\)$/g, '');
    const parts = clean.split(',').map(s => s.trim());
    if (parts.length < 3) return null;
    const entry = { date: parts[0], nickname: parts[1], category: parts[2] };

    if (entry.category === '장비') {
        if (parts.length >= 8) {
            entry.item_name = parts[3];
            entry.option = parts[4];
            entry.enhancement = parts[5];
            entry.durability = parts[6];
            entry.price = parseFloat(parts[7]);
        } else return null;
    } else if (entry.category === '악세') {
        if (parts.length >= 7) {
            entry.piece_or_set = parts[3];
            entry.grade = parts[4];
            entry.item_name = normalizeAccOption(parts[5]);
            if (!isAllowedAccOption(entry.item_name)) return null; // 잡옵션 악세 제외
            entry.price = parseFloat(parts[6]);
        } else return null;
    } else if (entry.category === '재료') {
        if (parts.length >= 6) {
            entry.material_type = parts[3];
            entry.grade = parts[4];
            entry.price = parseFloat(parts[5]);
            entry.item_name = parts[3];
        } else return null;
    } else return null;
    return entry;
};

const mapCategory = (rawCat) => {
    if (rawCat === '장비') return 'equip';
    if (rawCat === '악세') return 'acc';
    if (rawCat === '재료') return 'mat';
    return null;
};

const setupEventListeners = () => {
    // --- SIDEBAR ---
    const toggleSidebar = (show) => {
        if (!elements.sidebar) return;
        if (show) {
            elements.sidebar.classList.remove('-translate-x-full');
            elements.sidebarOverlay.classList.remove('hidden');
            elements.sidebarOverlay.classList.add('active'); // CSS display:flex
        } else {
            elements.sidebar.classList.add('-translate-x-full');
            elements.sidebarOverlay.classList.add('hidden');
            elements.sidebarOverlay.classList.remove('active');
        }
    };
    if (elements.openSidebarBtn) elements.openSidebarBtn.onclick = () => toggleSidebar(true);
    if (elements.closeSidebarBtn) elements.closeSidebarBtn.onclick = () => toggleSidebar(false);
    if (elements.sidebarOverlay) elements.sidebarOverlay.onclick = () => toggleSidebar(false);

    // --- FILTERS ---
    if (elements.filterBtns) {
        elements.filterBtns.forEach(btn => {
            btn.onclick = (e) => {
                elements.filterBtns.forEach(b => {
                    b.classList.remove('active', 'bg-blue-600', 'text-white', 'hover:bg-blue-700');
                    b.classList.add('bg-gray-100', 'text-gray-600', 'hover:bg-gray-200');
                });
                e.target.classList.add('active', 'bg-blue-600', 'text-white', 'hover:bg-blue-700');
                e.target.classList.remove('bg-gray-100', 'text-gray-600', 'hover:bg-gray-200');
                currentCategory = e.target.dataset.category;
                if (currentCategory === 'acc' && (currentSortMode === 'level_asc' || currentSortMode === 'level_desc')) {
                    currentSortMode = 'freq';
                }
                isClothesUpgradeOpen = false;
                isGachaMainOpen = false;
                updateSortUI();
                renderFilters();
                renderGrid();
                renderGachaEVSection();
                renderClothesUpgradeSection();
            };
        });
    }

    // --- MODAL CLOSE ---
    const closeModal = () => {
        if (!elements.modalOverlay) return;
        elements.modalContent.style.opacity = '0';
        elements.modalContent.style.transform = 'translateY(100%)';
        setTimeout(() => {
            elements.modalOverlay.classList.remove('active'); // CSS display:none
        }, 200);
    };
    if (elements.closeModalBtn) elements.closeModalBtn.onclick = closeModal;
    if (elements.modalOverlay) elements.modalOverlay.onclick = (e) => {
        if (e.target === elements.modalOverlay) closeModal();
    };

    // --- SORT DROPDOWN (상단바) & SIDEBAR SORT ---
    const sortDropdownWrapper = document.getElementById('sort-dropdown-wrapper');
    const sortDropdownToggle = document.getElementById('sort-dropdown-toggle');
    const sortDropdownMenu = document.getElementById('sort-dropdown-menu');
    const sortDropdownIcon = document.getElementById('sort-dropdown-icon');

    const toggleSortDropdown = (forceClose = false) => {
        if (!sortDropdownMenu) return;
        const isClosed = sortDropdownMenu.classList.contains('hidden');
        if (forceClose || !isClosed) {
            sortDropdownMenu.classList.add('hidden');
            if (sortDropdownIcon) sortDropdownIcon.classList.remove('rotate-180');
        } else {
            sortDropdownMenu.classList.remove('hidden');
            if (sortDropdownIcon) sortDropdownIcon.classList.add('rotate-180');
        }
    };

    if (sortDropdownToggle) {
        sortDropdownToggle.onclick = (e) => {
            e.stopPropagation();
            toggleSortDropdown();
        };
    }

    document.querySelectorAll('.sort-select-option').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const mode = e.currentTarget.dataset.sort;
            setSortMode(mode);
            toggleSortDropdown(true);
        };
    });

    // 바깥 영역 클릭 시 상단바 드롭다운 닫기
    document.addEventListener('click', (e) => {
        if (sortDropdownWrapper && !sortDropdownWrapper.contains(e.target)) {
            toggleSortDropdown(true);
        }
    });

    // 사이드바 정렬 버튼 이벤트
    document.querySelectorAll('.sidebar-sort-btn').forEach(btn => {
        btn.onclick = (e) => {
            const mode = e.currentTarget.dataset.sort;
            setSortMode(mode);
        };
    });

    updateSortUI();
};

// --- SCROLL STATE ---
let visibleLimit = 60;
const BATCH_SIZE = 60;
let observer = null;

const PART_FILTER_OPTIONS = [
    { key: 'all', label: '전체' },
    { key: '괭이', label: '괭이' },
    { key: '낫', label: '낫' },
    { key: '물뿌', label: '물뿌' },
    { key: '거삽', label: '거삽' },
    { key: '모삽', label: '모삽' },
    { key: '모자', label: '모자' },
    { key: '상의', label: '상의' },
    { key: '하의', label: '하의' }
];

const TAG_FILTER_OPTIONS = [
    { key: 'all', label: '전체', activeCls: 'bg-blue-600 text-white border-blue-600 shadow-xs' },
    { key: '가족거래', label: '가족거래', activeCls: 'bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white border-rose-600 shadow-xs' },
    { key: '기술', label: '기술', activeCls: 'bg-sky-600 text-white border-sky-600 shadow-xs' },
    { key: '체력', label: '체력', activeCls: 'bg-orange-600 text-white border-orange-600 shadow-xs' },
    { key: '튼튼', label: '튼튼', activeCls: 'bg-amber-500 text-white border-amber-500 shadow-xs' },
    { key: '신속', label: '신속/쾌속', activeCls: 'bg-emerald-600 text-white border-emerald-600 shadow-xs' },
    { key: '쿠폰장비', label: '쿠폰장비', activeCls: 'bg-purple-600 text-white border-purple-600 shadow-xs' }
];

const ACC_TAG_FILTER_OPTIONS = [
    { key: 'all', label: '전체', activeCls: 'bg-blue-600 text-white border-blue-600 shadow-xs' },
    { key: '에코', label: '에코', activeCls: 'bg-emerald-600 text-white border-emerald-600 shadow-xs' },
    { key: '바람', label: '바람', activeCls: 'bg-sky-600 text-white border-sky-600 shadow-xs' },
    { key: '활력', label: '활력', activeCls: 'bg-rose-600 text-white border-rose-600 shadow-xs' },
    { key: '신속', label: '신속', activeCls: 'bg-cyan-600 text-white border-cyan-600 shadow-xs' },
    { key: '재료', label: '재료', activeCls: 'bg-amber-500 text-white border-amber-500 shadow-xs' },
    { key: '발굴', label: '발굴', activeCls: 'bg-orange-600 text-white border-orange-600 shadow-xs' },
    { key: '하레', label: '하레', activeCls: 'bg-teal-600 text-white border-teal-600 shadow-xs' },
    { key: '특수', label: '특수', activeCls: 'bg-purple-600 text-white border-purple-600 shadow-xs' },
    { key: '듀얼', label: '듀얼', activeCls: 'bg-violet-600 text-white border-violet-600 shadow-xs' },
    { key: '갈갈', label: '갈갈', activeCls: 'bg-gray-700 text-white border-gray-700 shadow-xs' }
];

const renderAccBadgesHtml = (accMeta) => {
    if (!accMeta) return '';
    const tags = Array.isArray(accMeta.tags) && accMeta.tags.length > 0
        ? accMeta.tags
        : [accMeta.group || '액세서리'];

    return tags.map(tag => {
        let cls = 'bg-blue-50 text-blue-700 border-blue-200';
        if (tag === '에코') cls = 'bg-emerald-50 text-emerald-700 border-emerald-200 font-extrabold';
        else if (tag === '바람') cls = 'bg-sky-50 text-sky-700 border-sky-200';
        else if (tag === '활력') cls = 'bg-rose-50 text-rose-700 border-rose-200';
        else if (tag === '신속') cls = 'bg-cyan-50 text-cyan-700 border-cyan-200';
        else if (tag === '재료') cls = 'bg-amber-50 text-amber-700 border-amber-200';
        else if (tag === '발굴') cls = 'bg-orange-50 text-orange-700 border-orange-200';
        else if (tag === '하레') cls = 'bg-teal-50 text-teal-700 border-teal-200';
        else if (tag === '특수') cls = 'bg-purple-50 text-purple-700 border-purple-200';
        else if (tag === '듀얼') cls = 'bg-violet-50 text-violet-700 border-violet-200';
        else if (tag === '갈갈') cls = 'bg-gray-100 text-gray-700 border-gray-300';

        return `<span class="shrink-0 px-2 py-0.5 rounded-md ${cls} border text-[11px] font-bold whitespace-nowrap">${tag}</span>`;
    }).join(' ');
};

const matchEquipPartFilter = (meta, partKey) => {
    if (!partKey || partKey === 'all') return true;
    if (!meta) return false;
    const p = meta.part || '';
    if (partKey === '괭이') return p === '괭이' || p === '로터리';
    if (partKey === '낫') return p === '낫' || p === '콤바인';
    if (partKey === '물뿌') return p === '물뿌리개';
    if (partKey === '거삽') return p === '거름삽' || p === '퇴비 살포기';
    if (partKey === '모삽') return p === '모종삽' || p === '파종기';
    return p === partKey;
};

const matchEquipTagFilter = (meta, tagKey) => {
    if (!tagKey || tagKey === 'all') return true;
    if (!meta) return false;
    if (tagKey === '가족거래') return Boolean(meta.isFamilyTrade);
    if (tagKey === '기술') return Boolean(meta.isTech);
    if (tagKey === '체력') return Boolean(meta.isHp);
    if (tagKey === '튼튼') return Boolean(meta.isSturdy);
    if (tagKey === '신속') return Boolean(meta.isSwift);
    if (tagKey === '쿠폰장비') return Boolean(meta.isCoupon);
    return true;
};

const renderFilters = () => {
    if (!elements.dynamicFilters) return;
    const prevSearch = document.getElementById('search-input')?.value || '';

    const extraFiltersHtml = currentCategory === 'equip' ? `
        <!-- 구분 필터 (부위/종류) -->
        <div>
            <div class="flex items-center justify-between mb-2">
                <label class="block text-sm font-medium text-gray-700">구분 필터 (부위/종류)</label>
                ${currentPartFilter !== 'all' ? `<button type="button" id="reset-part-filter" class="text-[11px] text-blue-600 hover:underline font-semibold">초기화</button>` : ''}
            </div>
            <div class="grid grid-cols-3 gap-1.5" id="part-filter-group">
                ${PART_FILTER_OPTIONS.map(opt => {
                    const isActive = currentPartFilter === opt.key;
                    const cls = isActive
                        ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 font-medium';
                    return `<button type="button" data-part="${opt.key}" class="part-filter-btn py-1.5 px-2 rounded-lg border text-xs transition text-center ${cls}">${opt.label}</button>`;
                }).join('')}
            </div>
        </div>

        <!-- 태그 필터 (특수 속성) -->
        <div>
            <div class="flex items-center justify-between mb-2">
                <label class="block text-sm font-medium text-gray-700">태그 필터 (속성)</label>
                ${currentTagFilter !== 'all' ? `<button type="button" id="reset-tag-filter" class="text-[11px] text-blue-600 hover:underline font-semibold">초기화</button>` : ''}
            </div>
            <div class="flex flex-wrap gap-1.5" id="tag-filter-group">
                ${TAG_FILTER_OPTIONS.map(opt => {
                    const isActive = currentTagFilter === opt.key;
                    const cls = isActive
                        ? `${opt.activeCls} font-bold`
                        : (opt.key === '가족거래'
                            ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 font-extrabold'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 font-medium');
                    return `<button type="button" data-tag="${opt.key}" class="tag-filter-btn py-1.5 px-2.5 rounded-lg border text-xs transition ${cls}">${opt.label}</button>`;
                }).join('')}
            </div>
        </div>
    ` : `
        <!-- 액세서리 태그 필터 -->
        <div>
            <div class="flex items-center justify-between mb-2">
                <label class="block text-sm font-medium text-gray-700">태그 필터 (속성)</label>
                ${currentAccTagFilter !== 'all' ? `<button type="button" id="reset-acc-tag-filter" class="text-[11px] text-blue-600 hover:underline font-semibold">초기화</button>` : ''}
            </div>
            <div class="flex flex-wrap gap-1.5" id="acc-tag-filter-group">
                ${ACC_TAG_FILTER_OPTIONS.map(opt => {
                    const isActive = currentAccTagFilter === opt.key;
                    const cls = isActive
                        ? `${opt.activeCls} font-bold`
                        : (opt.key === '에코'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 font-bold'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 font-medium');
                    return `<button type="button" data-acctag="${opt.key}" class="acc-tag-filter-btn py-1.5 px-2.5 rounded-lg border text-xs transition ${cls}">${opt.label}</button>`;
                }).join('')}
            </div>
        </div>
    `;

    const analysisLauncherHtml = currentCategory === 'equip'
        ? `
        <div class="pt-3 border-t border-gray-100">
            <button type="button" id="btn-sidebar-open-clothes-upgrade" class="w-full py-2.5 px-3 rounded-lg border text-xs font-bold transition text-left flex items-center justify-between shadow-2xs ${isClothesUpgradeOpen ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-white text-gray-800 border-gray-200 hover:bg-blue-50 hover:border-blue-300'}">
                <span>의상 체력/기술 단계별 상승 비용표</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] ${isClothesUpgradeOpen ? 'bg-white/20 text-white font-extrabold' : 'bg-gray-100 text-gray-700 font-semibold'}">${isClothesUpgradeOpen ? '닫기' : '열기'}</span>
            </button>
        </div>
        `
        : `
        <div class="pt-3 border-t border-gray-100">
            <button type="button" id="btn-sidebar-open-gacha-ev" class="w-full py-2.5 px-3 rounded-lg border text-xs font-bold transition text-left flex items-center justify-between shadow-2xs ${isGachaMainOpen ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-white text-gray-800 border-gray-200 hover:bg-blue-50 hover:border-blue-300'}">
                <span>금도 · 다도 기대수익 분석</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] ${isGachaMainOpen ? 'bg-white/20 text-white font-extrabold' : 'bg-gray-100 text-gray-700 font-semibold'}">${isGachaMainOpen ? '닫기' : '열기'}</span>
            </button>
        </div>
        `;

    const searchPlaceholder = currentCategory === 'equip'
        ? '예: 파종기, 크파, 선글라스, 튼썬...'
        : '예: 바씨, EM, 찰나, 에코, 바람, 신속...';

    elements.dynamicFilters.innerHTML = `
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">검색 (정식명칭 / 줄임말 / 속성)</label>
            <input type="text" id="search-input" value="${prevSearch.replace(/"/g, '&quot;')}" placeholder="${searchPlaceholder}" class="w-full bg-white border border-gray-300 text-gray-900 rounded p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition">
        </div>
        ${extraFiltersHtml}
        ${analysisLauncherHtml}
    `;

    const input = document.getElementById('search-input');
    if (input) input.oninput = (e) => {
        visibleLimit = BATCH_SIZE; // Reset scroll
        renderGrid(e.target.value);
    };

    document.getElementById('btn-sidebar-open-clothes-upgrade')?.addEventListener('click', () => {
        isClothesUpgradeOpen = !isClothesUpgradeOpen;
        renderFilters();
        renderClothesUpgradeSection();
        if (isClothesUpgradeOpen) {
            document.getElementById('clothes-upgrade-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (window.innerWidth < 768 && elements.sidebar) {
                elements.sidebar.classList.add('-translate-x-full');
                elements.sidebarOverlay?.classList.add('hidden');
                elements.sidebarOverlay?.classList.remove('active');
            }
        }
    });

    document.getElementById('btn-sidebar-open-gacha-ev')?.addEventListener('click', () => {
        isGachaMainOpen = !isGachaMainOpen;
        renderFilters();
        renderGachaEVSection();
        if (isGachaMainOpen) {
            document.getElementById('gacha-ev-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (window.innerWidth < 768 && elements.sidebar) {
                elements.sidebar.classList.add('-translate-x-full');
                elements.sidebarOverlay?.classList.add('hidden');
                elements.sidebarOverlay?.classList.remove('active');
            }
        }
    });

    if (currentCategory === 'equip') {
        elements.dynamicFilters.querySelectorAll('.part-filter-btn').forEach(btn => {
            btn.onclick = () => {
                const clicked = btn.dataset.part;
                currentPartFilter = (currentPartFilter === clicked && clicked !== 'all') ? 'all' : clicked;
                visibleLimit = BATCH_SIZE;
                renderFilters();
                renderGrid(document.getElementById('search-input')?.value || '');
            };
        });

        elements.dynamicFilters.querySelectorAll('.tag-filter-btn').forEach(btn => {
            btn.onclick = () => {
                const clicked = btn.dataset.tag;
                currentTagFilter = (currentTagFilter === clicked && clicked !== 'all') ? 'all' : clicked;
                visibleLimit = BATCH_SIZE;
                renderFilters();
                renderGrid(document.getElementById('search-input')?.value || '');
            };
        });

        document.getElementById('reset-part-filter')?.addEventListener('click', () => {
            currentPartFilter = 'all';
            visibleLimit = BATCH_SIZE;
            renderFilters();
            renderGrid(document.getElementById('search-input')?.value || '');
        });

        document.getElementById('reset-tag-filter')?.addEventListener('click', () => {
            currentTagFilter = 'all';
            visibleLimit = BATCH_SIZE;
            renderFilters();
            renderGrid(document.getElementById('search-input')?.value || '');
        });
    } else if (currentCategory === 'acc') {
        elements.dynamicFilters.querySelectorAll('.acc-tag-filter-btn').forEach(btn => {
            btn.onclick = () => {
                const clicked = btn.dataset.acctag;
                currentAccTagFilter = (currentAccTagFilter === clicked && clicked !== 'all') ? 'all' : clicked;
                visibleLimit = BATCH_SIZE;
                renderFilters();
                renderGrid(document.getElementById('search-input')?.value || '');
            };
        });

        document.getElementById('reset-acc-tag-filter')?.addEventListener('click', () => {
            currentAccTagFilter = 'all';
            visibleLimit = BATCH_SIZE;
            renderFilters();
            renderGrid(document.getElementById('search-input')?.value || '');
        });
    }
};

const renderGrid = (filterText = '') => {
    const grid = elements.grid;
    if (!grid) return;

    const catIndex = ITEM_INDEX[currentCategory] || {};
    const q = (filterText || '').trim().toLowerCase();

    let items = Object.entries(catIndex)
        .filter(([, info]) => info.hasValidCell)
        .map(([name, info]) => {
            const meta = currentCategory === 'equip' ? getEquipMeta(name) : null;
            return {
                name,
                displayName: meta ? meta.officialName : name,
                meta,
                count: info.count,
                category: currentCategory
            };
        });

    // 구분필터 & 태그필터 적용
    if (currentCategory === 'equip') {
        if (currentPartFilter !== 'all') {
            items = items.filter(item => matchEquipPartFilter(item.meta, currentPartFilter));
        }
        if (currentTagFilter !== 'all') {
            items = items.filter(item => matchEquipTagFilter(item.meta, currentTagFilter));
        }
    } else if (currentCategory === 'acc') {
        if (currentAccTagFilter !== 'all') {
            items = items.filter(item => {
                const accMeta = getAccMeta(item.name);
                const tags = accMeta?.tags || (accMeta?.group ? [accMeta.group] : []);
                return tags.includes(currentAccTagFilter);
            });
        }
    }

    if (q) {
        items = items.filter(item => {
            if (item.name.toLowerCase().includes(q) || item.displayName.toLowerCase().includes(q)) return true;
            if (item.meta) {
                const m = item.meta;
                const searchBlob = `${m.officialName} ${m.abbr} ${m.subType} ${m.part} ${m.level}렙 ${m.isFamilyTrade ? '가족거래 가족' : ''} ${m.isCoupon ? '쿠폰 쿠폰장비' : ''} ${m.isTech ? '기술' : ''} ${m.isHp ? '체력' : ''} ${m.isSturdy ? '튼튼' : ''} ${m.isSwift ? '신속 쾌속' : ''}`.toLowerCase();
                return searchBlob.includes(q);
            }
            if (item.category === 'acc') {
                const accMeta = getAccMeta(item.name);
                if (accMeta) {
                    const tagsStr = (accMeta.tags || []).join(' ');
                    const searchBlob = `${accMeta.officialName} ${accMeta.group} ${tagsStr} ${accMeta.target || ''} ${accMeta.effectSummary || ''} ${accMeta.desc || ''}`.toLowerCase();
                    return searchBlob.includes(q);
                }
            }
            return false;
        });
    }
    items = sortItemsOrVariants(items, currentSortMode);

    // 상단 페이지 타이틀에 현재 필터 및 개수 반영
    const pageTitleEl = document.getElementById('page-title');
    if (pageTitleEl) {
        if (currentCategory === 'equip') {
            const activeLabels = ['장비'];
            if (currentPartFilter !== 'all') activeLabels.push(currentPartFilter);
            if (currentTagFilter !== 'all') activeLabels.push(currentTagFilter);
            pageTitleEl.textContent = `${activeLabels.join(' · ')} (${items.length}종)`;
        } else {
            const activeLabels = ['액세서리'];
            if (currentAccTagFilter !== 'all') activeLabels.push(currentAccTagFilter);
            pageTitleEl.textContent = `${activeLabels.join(' · ')} (${items.length}종)`;
        }
    }

    if (items.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center text-gray-500 py-10">데이터가 없습니다.</div>`;
        return;
    }

    grid.innerHTML = '';
    const visibleItems = items.slice(0, visibleLimit);

    visibleItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl border border-gray-200 p-4 md:p-5 cursor-pointer flex flex-col justify-between hover:border-blue-500 hover:shadow-md transition-all shadow-sm';

        if (item.category === 'equip' && item.meta) {
            const m = item.meta;
            const badgesHtml = renderEquipBadgesHtml(m);

            card.innerHTML = `
                <div>
                    <div class="flex items-start justify-between gap-1.5 mb-1.5 min-h-[24px]">
                        <span class="shrink-0 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-[11px] font-bold whitespace-nowrap">Lv.${m.level} · ${m.part}</span>
                        <div class="flex flex-wrap items-center gap-1 justify-end">${badgesHtml}</div>
                    </div>
                    <h3 class="text-lg md:text-xl font-extrabold text-gray-900 leading-snug break-keep">${item.name}</h3>
                    <div class="mt-1 flex items-center justify-between gap-2">
                        <span class="text-xs text-gray-500 truncate">${m.officialName}</span>
                        <button type="button" class="card-detail-toggle-btn text-[11px] text-blue-600 hover:text-blue-800 font-semibold whitespace-nowrap px-1.5 py-0.5 rounded hover:bg-blue-50 transition">
                            상세정보 ▾
                        </button>
                    </div>
                    <div class="card-detail-panel hidden mt-2.5 pt-2.5 border-t border-gray-100 text-xs text-gray-600 space-y-1 bg-gray-50/80 rounded-lg p-2.5">
                        <div><span class="text-gray-400">정식 명칭:</span> <strong class="text-gray-800">${m.officialName}</strong></div>
                        <div><span class="text-gray-400">주요 줄임말:</span> <span class="text-blue-700 font-semibold">${m.abbr}</span></div>
                        <div><span class="text-gray-400">착용 렙제 / 분류:</span> <span class="font-semibold text-gray-800">${m.level}레벨 (${m.subType} · ${m.part})</span></div>
                        <div><span class="text-gray-400">특수 속성:</span> <span>${getSpecialAttrDesc(m)}</span></div>
                        ${m.desc ? `<div class="text-[11px] text-indigo-700 bg-indigo-50/80 p-1.5 rounded border border-indigo-100 mt-1">${m.desc}</div>` : ''}
                    </div>
                </div>
            `;

            const toggleBtn = card.querySelector('.card-detail-toggle-btn');
            const detailPanel = card.querySelector('.card-detail-panel');
            if (toggleBtn && detailPanel) {
                toggleBtn.onclick = (e) => {
                    e.stopPropagation();
                    const isHidden = detailPanel.classList.contains('hidden');
                    detailPanel.classList.toggle('hidden', !isHidden);
                    toggleBtn.textContent = isHidden ? '상세정보 ▴' : '상세정보 ▾';
                };
            }
        } else if (item.category === 'acc') {
            const accMeta = getAccMeta(item.name);
            const badgesHtml = renderAccBadgesHtml(accMeta);
            const officialName = accMeta?.officialName || `${item.name} 액세서리`;
            const effectSummary = accMeta?.effectSummary || '농사에 도움을 주는 장신구입니다.';

            card.innerHTML = `
                <div>
                    <div class="flex items-start justify-between gap-1.5 mb-1.5 min-h-[24px]">
                        <div class="flex flex-wrap items-center gap-1">${badgesHtml}</div>
                        <div class="flex flex-wrap items-center gap-1 justify-end">
                            <span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">장신구</span>
                        </div>
                    </div>
                    <h3 class="text-lg md:text-xl font-extrabold text-gray-900 leading-snug break-keep">${item.name}</h3>
                    <div class="mt-1 flex items-center justify-between gap-2">
                        <span class="text-xs text-gray-500 truncate">${officialName}</span>
                        <button type="button" class="card-detail-toggle-btn text-[11px] text-blue-600 hover:text-blue-800 font-semibold whitespace-nowrap px-1.5 py-0.5 rounded hover:bg-blue-50 transition">
                            상세정보 ▾
                        </button>
                    </div>
                    <div class="card-detail-panel hidden mt-2.5 pt-2.5 border-t border-gray-100 text-xs text-gray-600 space-y-1.5 bg-gray-50/80 rounded-lg p-2.5">
                        <div><span class="text-gray-400">정식 명칭:</span> <strong class="text-gray-800">${officialName}</strong></div>
                        ${accMeta?.target ? `<div><span class="text-gray-400">대상 작업:</span> <span class="font-medium text-gray-800">${accMeta.target}</span></div>` : ''}
                        <div><span class="text-gray-400">발동 효과:</span> <span class="font-bold text-gray-900">${effectSummary}</span></div>
                        ${accMeta?.grades ? `
                            <div class="mt-1 pt-1 border-t border-gray-200/60 text-[11px]">
                                <span class="text-gray-400 block mb-0.5 font-medium">등급별 효과:</span>
                                <div class="grid grid-cols-1 gap-1">
                                    ${Object.entries(accMeta.grades).map(([g, eff]) => `
                                        <div class="flex items-center gap-1.5 bg-white px-2 py-0.5 rounded border border-gray-100">
                                            <span class="font-bold ${g === '다' ? 'text-cyan-700' : (g === '금' ? 'text-amber-600' : 'text-gray-600')}">[${g === '다' ? '다이아' : (g === '금' ? '금' : '은')}]</span>
                                            <span class="text-gray-700 font-medium">${eff}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        ${accMeta?.desc ? `<div class="text-[11px] text-indigo-700 bg-indigo-50/80 p-1.5 rounded border border-indigo-100 mt-1">${accMeta.desc}</div>` : ''}
                    </div>
                </div>
            `;

            const toggleBtn = card.querySelector('.card-detail-toggle-btn');
            const detailPanel = card.querySelector('.card-detail-panel');
            if (toggleBtn && detailPanel) {
                toggleBtn.onclick = (e) => {
                    e.stopPropagation();
                    const isHidden = detailPanel.classList.contains('hidden');
                    detailPanel.classList.toggle('hidden', !isHidden);
                    toggleBtn.textContent = isHidden ? '상세정보 ▴' : '상세정보 ▾';
                };
            }
        } else {
            card.innerHTML = `
                <div>
                    <h3 class="text-lg font-bold text-gray-900">${item.name}</h3>
                </div>
            `;
        }

        card.onclick = () => {
            const processed = processItemOnDemand(item.category, item.name);
            if (processed) {
                openModal(processed);
            } else {
                alert(HIDE_UNDER_3 ? "유효한 데이터가 부족합니다 (3건 미만)." : "유효한 데이터가 존재하지 않습니다.");
            }
        };
        grid.appendChild(card);
    });

    // Infinite Scroll Sentinel
    if (visibleItems.length < items.length) {
        const sentinel = document.createElement('div');
        sentinel.className = "col-span-full h-10 flex justify-center items-center py-4";
        sentinel.innerHTML = `<div class="text-gray-500 text-xs">더 보기...</div>`;
        grid.appendChild(sentinel);

        if (observer) observer.disconnect();
        observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                visibleLimit += BATCH_SIZE;
                const currentSearch = document.getElementById('search-input')?.value || '';
                renderGrid(currentSearch);
            }
        }, { rootMargin: '100px' });
        observer.observe(sentinel);
    }
};

// 모달 상단 장비 & 옵션 상세정보 드로어 렌더링
const renderModalHeaderDetails = (item, selectedVariant = null) => {
    if (!elements.modalEquipBadges || !elements.equipDetailDrawer) return;

    if (item.category === 'acc') {
        const accMeta = getAccMeta(item.name);
        const officialName = accMeta?.officialName || `${item.name} 액세서리`;
        const groupName = accMeta?.group || '액세서리';
        const badgesHtml = renderAccBadgesHtml(accMeta);

        elements.modalEquipBadges.innerHTML = badgesHtml;

        elements.equipDetailDrawer.classList.remove('hidden');
        elements.equipDetailDrawer.innerHTML = `
            <div class="flex items-center justify-between pb-1.5 border-b border-gray-100">
                <span class="font-bold text-gray-800 text-xs">액세서리 세부정보</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div><span class="text-gray-400">정식 명칭:</span> <strong class="text-gray-800">${officialName}</strong></div>
                <div><span class="text-gray-400">분류:</span> <span class="font-semibold text-blue-700">${groupName} 액세서리 (목걸이/반지)</span></div>
                ${accMeta?.target ? `<div><span class="text-gray-400">대상 작업:</span> <span class="font-semibold text-gray-800">${accMeta.target}</span></div>` : ''}
                <div><span class="text-gray-400">발동 효과:</span> <span class="font-bold text-gray-900">${accMeta?.effectSummary || '농사 보조 효과'}</span></div>
            </div>
            ${accMeta?.grades ? `
                <div class="pt-2 border-t border-gray-100">
                    <span class="text-[11px] text-gray-400 font-semibold block mb-1">등급별 효과:</span>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-xs">
                        ${Object.entries(accMeta.grades).map(([g, eff]) => {
                            const isCur = selectedVariant && (selectedVariant.name === g || (g === '다' && selectedVariant.name.includes('다')));
                            return `
                                <div class="p-2 rounded-lg border ${isCur ? 'bg-blue-50/80 border-blue-300 ring-1 ring-blue-300 font-bold' : 'bg-white border-gray-100'}">
                                    <div class="flex items-center justify-between mb-0.5">
                                        <span class="${g === '다' ? 'text-cyan-700' : (g === '금' ? 'text-amber-600' : 'text-gray-600')} font-extrabold">[${g === '다' ? '다이아' : (g === '금' ? '금' : '은')}]</span>
                                        ${isCur ? '<span class="text-[10px] text-blue-600 font-bold">선택됨</span>' : ''}
                                    </div>
                                    <div class="text-gray-800 text-[11px]">${eff}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            ` : ''}
            ${accMeta?.desc ? `
                <div class="p-2 rounded-lg bg-indigo-50/60 border border-indigo-100 text-[11px] text-indigo-900 leading-relaxed">
                    ${accMeta.desc}
                </div>
            ` : ''}
        `;
        return;
    }

    if (item.category !== 'equip' || !item.equipMeta) {
        elements.modalEquipBadges.innerHTML = '';
        elements.equipDetailDrawer.classList.add('hidden');
        elements.equipDetailDrawer.innerHTML = '';
        return;
    }

    const m = item.equipMeta;
    const baseStats = getEquipBaseStats(m.key, m);
    const baseSummary = formatEquipBaseStatsSummary(baseStats, m);

    // 상단 헤더 배지 (옵션 세부정보 중복 제거, 장비 스탯 & 강화증가량 중심 버튼)
    const badgesHtml = renderEquipBadgesHtml(m);
    elements.modalEquipBadges.innerHTML = `
        <span class="text-xs text-gray-600 font-medium">${m.officialName}</span>
        <span class="shrink-0 px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-bold whitespace-nowrap">Lv.${m.level} · ${m.part}</span>
        ${badgesHtml}
        <button type="button" id="modal-detail-drawer-toggle" class="ml-auto px-2.5 py-1 rounded-lg bg-white hover:bg-blue-50 text-blue-600 border border-blue-200 text-xs font-bold shadow-2xs transition flex items-center gap-1 shrink-0">
            <span>장비 세부정보 & 강화스탯 열기</span>
            <span id="modal-detail-drawer-arrow">▾</span>
        </button>
    `;

    // 1~10강 강화 시 스탯 증가량 수치 컴포넌트 (모든 장비 및 농기계 공통, 상시 노출)
    const enhanceStatsHtml = buildAllEnhanceStatsTableHtml(baseStats, m);

    elements.equipDetailDrawer.innerHTML = `
        <div class="rounded-xl bg-blue-50/70 border border-blue-200 p-3.5 text-xs text-gray-700 shadow-inner">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><span class="text-gray-400 font-medium">장비 줄임말:</span> <strong class="text-blue-700">${m.abbr}</strong></div>
                <div><span class="text-gray-400 font-medium">정식 명칭:</span> <strong class="text-gray-900">${m.officialName}</strong></div>
                <div><span class="text-gray-400 font-medium">착용 레벨(렙제):</span> <strong class="text-gray-900">${m.level}레벨</strong> (강화 골드 비용 기준)</div>
                <div><span class="text-gray-400 font-medium">장비 분류/부위:</span> <strong class="text-gray-900">${m.subType} · ${m.part}</strong></div>
                <div><span class="text-gray-400 font-medium">특수 속성:</span> <span>${getSpecialAttrDesc(m)}</span></div>
                ${baseSummary ? `
                <div class="sm:col-span-2 p-2 rounded-lg bg-indigo-50/90 border border-indigo-200 text-indigo-900 font-medium flex items-center justify-between gap-2">
                    <div><span class="text-indigo-600 font-bold mr-1.5">장비 기본스탯:</span><strong>${baseSummary}</strong></div>
                </div>` : ''}
            </div>
            ${m.desc ? `<div class="mt-2 p-2 rounded-lg bg-white/90 border border-blue-100 text-indigo-800 text-[11px] font-medium">${m.desc}</div>` : ''}
            ${enhanceStatsHtml}
        </div>
    `;

    // 드로어 열기/닫기 토글
    const toggleBtn = document.getElementById('modal-detail-drawer-toggle');
    const arrow = document.getElementById('modal-detail-drawer-arrow');
    if (toggleBtn) {
        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            const isHidden = elements.equipDetailDrawer.classList.contains('hidden');
            elements.equipDetailDrawer.classList.toggle('hidden', !isHidden);
            if (arrow) arrow.textContent = isHidden ? '▴' : '▾';
        };
    }
};

const openModal = (item) => {
    try {
        currentModalItem = item;
        currentModalVariant = null;
        currentSelectedCell = null;

        elements.modalTitle.textContent = item.name;
        elements.modalSubtitle.textContent = item.category === 'equip' ? '옵션 선택' : '등급 선택';
        if (elements.equipDetailDrawer) elements.equipDetailDrawer.classList.add('hidden');

        renderModalHeaderDetails(item, null);
        renderVariantList(item);

        elements.modalOverlay.classList.remove('hidden');
        elements.modalOverlay.classList.add('active');

        elements.modalContent.classList.remove('hidden');
        elements.modalContent.style.opacity = '1';
        elements.modalContent.style.transform = 'translateY(0)';
        elements.modalContent.style.display = 'flex';

        const modalBody = document.getElementById('modal-body-container');
        if (modalBody) modalBody.scrollTop = 0;

    } catch (e) {
        alert("모달 열기 실패: " + e.message);
    }
};

const renderVariantList = (item) => {
    currentModalVariant = null;
    currentSelectedCell = null;
    elements.modalSubtitle.textContent = item.category === 'equip' ? '옵션 선택' : '등급 선택';
    renderModalHeaderDetails(item, null);

    const container = elements.matrixContainer;
    container.innerHTML = '';

    const headerRow = document.createElement('div');
    headerRow.className = "flex justify-between items-center px-2 py-1.5 mb-3 text-xs text-gray-600 bg-gray-50 rounded-lg border border-gray-200/80";

    const countLabel = item.category === 'equip' ? '옵션' : '등급';
    const isFreq = currentSortMode === 'freq';
    headerRow.innerHTML = `
        <span class="font-bold text-gray-700">${countLabel} 목록 (${Object.keys(item.variants).length}개)</span>
        <div class="flex items-center gap-1 bg-white rounded-md p-0.5 border border-gray-200 shadow-2xs">
            <button class="modal-sort-toggle-btn px-2 py-0.5 rounded text-[11px] font-semibold transition ${currentSortMode === 'freq' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'}" data-sort="freq">
                빈도순
            </button>
            <button class="modal-sort-toggle-btn px-2 py-0.5 rounded text-[11px] font-semibold transition ${currentSortMode === 'korean' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'}" data-sort="korean">
                ㄱㄴㄷ순
            </button>
            <button class="modal-sort-toggle-btn px-2 py-0.5 rounded text-[11px] font-semibold transition ${currentSortMode === 'korean_desc' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-500 hover:text-gray-900'}" data-sort="korean_desc">
                ㄱㄴㄷ 역순
            </button>
        </div>
    `;

    headerRow.querySelectorAll('.modal-sort-toggle-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            setSortMode(e.currentTarget.dataset.sort);
            renderVariantList(item);
        };
    });
    container.appendChild(headerRow);

    const variants = sortItemsOrVariants(Object.values(item.variants), currentSortMode);

    const list = document.createElement('div');
    list.className = "grid grid-cols-2 gap-2.5 p-1";

    variants.forEach(v => {
        const btn = document.createElement('button');
        btn.className = "p-3 bg-white hover:bg-blue-50 rounded-xl shadow-xs text-center border border-gray-200 hover:border-blue-400 flex flex-col items-center justify-center transition group";

        if (item.category === 'equip' && v.optMeta) {
            const om = v.optMeta;
            btn.innerHTML = `
                <div class="text-gray-900 font-extrabold text-sm sm:text-base group-hover:text-blue-700">${v.name}</div>
                <div class="mt-0.5 text-[11px] text-gray-500 break-keep leading-tight">${om.officialName}</div>
            `;
        } else {
            btn.innerHTML = `
                <div class="text-gray-900 font-bold text-sm text-center w-full">
                    ${v.name}
                </div>
            `;
        }

        btn.onclick = () => selectVariant(item, v);
        list.appendChild(btn);
    });
    container.appendChild(list);

    if (priceChart) { priceChart.destroy(); priceChart = null; }
    if (elements.chartPlaceholder) elements.chartPlaceholder.classList.remove('hidden');
    if (elements.marketSummaryCard) elements.marketSummaryCard.classList.add('hidden');
    if (elements.enhanceSimCard) elements.enhanceSimCard.classList.add('hidden');
};

const selectVariant = (item, variant) => {
    currentModalItem = item;
    currentModalVariant = variant;
    currentSelectedCell = null;

    elements.modalSubtitle.textContent = variant.name;
    renderModalHeaderDetails(item, variant);

    const container = elements.matrixContainer;
    container.innerHTML = '';

    // Back Button
    const header = document.createElement('div');
    header.className = "mb-3 pb-2 border-b border-gray-200 flex items-center justify-between gap-2";

    const backBtn = document.createElement('button');
    backBtn.className = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs sm:text-sm font-bold border border-blue-200/80 transition-all shadow-2xs";
    const backBtnText = item.category === 'equip' ? '옵션 목록으로 돌아가기' : '등급 목록으로 돌아가기';
    backBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"></path></svg> <span>${backBtnText}</span>`;
    backBtn.onclick = (e) => {
        e.stopPropagation();
        renderVariantList(item);
        const modalBody = document.getElementById('modal-body-container');
        if (modalBody) {
            modalBody.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    header.appendChild(backBtn);
    container.appendChild(header);

    // 옵션 상세 효과 카드 (줄임말 크게, 풀네임 작게 아래에 + 단계별 수치 열기)
    if (item.category === 'equip' && variant.optMeta) {
        const om = variant.optMeta;
        const m = item.equipMeta;
        const optInfoBox = document.createElement('div');
        optInfoBox.className = "mb-3 rounded-xl bg-indigo-50/60 border border-indigo-100 p-3 text-xs";
        optInfoBox.innerHTML = `
            <div class="flex items-center justify-between gap-2">
                <div class="min-w-0">
                    <div class="text-sm font-extrabold text-indigo-950">${variant.name}</div>
                    <div class="text-[11px] text-gray-500 truncate mt-0.5">${om.officialName}</div>
                </div>
                <button type="button" class="opt-stage-toggle text-[11px] text-indigo-600 hover:text-indigo-800 font-bold whitespace-nowrap">
                    단계별 수치 ▾
                </button>
            </div>
            <div class="opt-stage-detail hidden mt-2 pt-2 border-t border-indigo-100/80 space-y-1.5 text-gray-700">
                <div>${om.desc}</div>
                ${om.stages ? `
                <div class="grid grid-cols-4 gap-1 text-center pt-1">
                    <div class="bg-white rounded p-1 border border-indigo-100"><div class="text-[10px] text-gray-400">5강</div><div class="font-bold text-gray-800">${om.stages[5]}</div></div>
                    <div class="bg-white rounded p-1 border border-indigo-100"><div class="text-[10px] text-blue-500">7강</div><div class="font-bold text-blue-700">${om.stages[7]}</div></div>
                    <div class="bg-white rounded p-1 border border-indigo-100"><div class="text-[10px] text-indigo-500">9강</div><div class="font-bold text-indigo-700">${om.stages[9]}</div></div>
                    <div class="bg-amber-50 rounded p-1 border border-amber-200"><div class="text-[10px] text-amber-600 font-bold">10강</div><div class="font-extrabold text-amber-700">${om.stages[10]}</div></div>
                </div>
                ` : ''}
            </div>
        `;
        const tBtn = optInfoBox.querySelector('.opt-stage-toggle');
        const dBox = optInfoBox.querySelector('.opt-stage-detail');
        if (tBtn && dBox) {
            tBtn.onclick = (e) => {
                e.stopPropagation();
                const isHidden = dBox.classList.contains('hidden');
                dBox.classList.toggle('hidden', !isHidden);
                tBtn.textContent = isHidden ? '단계별 수치 ▴' : '단계별 수치 ▾';
            };
        }
        container.appendChild(optInfoBox);
    }

    if (item.category === 'equip') {
        renderMatrix(item, variant, container);
        if (priceChart) { priceChart.destroy(); priceChart = null; }
        if (elements.chartPlaceholder) elements.chartPlaceholder.classList.remove('hidden');
        if (elements.marketSummaryCard) elements.marketSummaryCard.classList.add('hidden');
        if (elements.enhanceSimCard) elements.enhanceSimCard.classList.add('hidden');
    } else {
        if (elements.enhanceSimCard) elements.enhanceSimCard.classList.add('hidden');
        const info = document.createElement('div');
        info.id = "acc-detail-info-panel";
        info.className = "mt-4 p-5 bg-white rounded-xl border border-gray-200 text-center shadow-sm";
        info.innerHTML = `
            <div class="text-xs text-gray-400 font-medium">선택된 등급</div>
            <div class="text-xl font-bold text-blue-600 mt-1">${variant.name}</div>
        `;
        container.appendChild(info);

        loadDataAndRender(variant.history, variant.count);
        if (window.innerWidth < 1024) {
            const chartSec = document.getElementById('chart-section');
            if (chartSec) {
                setTimeout(() => {
                    chartSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        }
    }
};

const renderMatrix = (item, variant, container) => {
    const isMu = variant.name === '무' || variant.name === '노옵션' || variant.name === '무옵';
    const equipMeta = item.equipMeta || getEquipMeta(item.name);
    const isSturdy = equipMeta ? equipMeta.isSturdy : false;

    // 1. Determine Columns (강화단계)
    // 무옵: 0강 ~ 10강 (11개 열: 0강 노작 포함)
    // 옵션: 5강 ~ 10강 (6개 열: 옵션 장비 규격)
    const encCols = isMu
        ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        : [5, 6, 7, 8, 9, 10];

    // 2. Determine Rows (내구도: 높은 내구도에서 낮은 내구도 순)
    // 무옵: 12 down to 1 (12개 행 - 10바이12 규격)
    // 옵션: 튼튼이면 12 down to 5 (8개 행 - 5바이8), 일반이면 10 down to 5 (6개 행 - 5바이6)
    const durRows = isMu
        ? [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
        : (isSturdy
            ? [12, 11, 10, 9, 8, 7, 6, 5]
            : [10, 9, 8, 7, 6, 5]);

    // 3. Precompute Option Benchmark Prices
    let s10 = 0, s9 = 0, s8 = 0, s7 = 0;
    if (!isMu) {
        s10 = getVariantCellSpotPrice(variant, '10_10', true).price;
        s9 = getVariantCellSpotPrice(variant, '9_9', true).price;
        s8 = getVariantCellSpotPrice(variant, '8_8', true).price;
        s7 = getVariantCellSpotPrice(variant, '7_7', true).price;
    }

    // 4. Header / Legend Info
    const legendBox = document.createElement('div');
    legendBox.className = "flex flex-wrap items-center justify-between text-[11px] text-gray-500 mb-2.5 px-1 gap-1.5";
    legendBox.innerHTML = `
        <span class="font-bold text-gray-700">시세표 (${isMu ? '10×12 규격 표' : (isSturdy ? '5×8 삼각형 표' : '5×6 삼각형 표')})</span>
        <div class="flex items-center gap-2.5">
            <span class="inline-flex items-center gap-1">
                <span class="w-2.5 h-2.5 rounded bg-white border border-gray-300 inline-block shadow-2xs"></span>
                <span>실제 시세</span>
            </span>
            ${!isMu ? `
            <span class="inline-flex items-center gap-1">
                <span class="w-2.5 h-2.5 rounded bg-indigo-100 border border-indigo-300 inline-block shadow-2xs"></span>
                <span class="text-indigo-700 font-semibold">강화 기댓값</span>
            </span>` : ''}
        </div>
    `;
    container.appendChild(legendBox);

    // 5. Table Container & Element
    const tableWrap = document.createElement('div');
    tableWrap.className = "overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-2xs pb-1";

    const table = document.createElement('table');
    table.className = "w-full border-collapse text-center text-xs";

    // Table Header
    const thead = document.createElement('thead');
    const headerTr = document.createElement('tr');
    headerTr.className = "bg-gray-100/90 text-gray-700 font-bold border-b border-gray-200";

    const cornerTh = document.createElement('th');
    cornerTh.className = "sticky left-0 z-20 bg-gray-100 py-2 px-1.5 text-[11px] font-bold text-gray-500 border-r border-gray-200 min-w-[50px] whitespace-nowrap shadow-xs";
    cornerTh.textContent = "내구＼강";
    headerTr.appendChild(cornerTh);

    encCols.forEach(e => {
        const th = document.createElement('th');
        th.className = "py-2 px-1 text-xs font-bold text-gray-800 border-r border-gray-200 min-w-[58px] sm:min-w-[64px] last:border-r-0 whitespace-nowrap";
        th.textContent = `${e}강`;
        headerTr.appendChild(th);
    });
    thead.appendChild(headerTr);
    table.appendChild(thead);

    // Table Body
    const tbody = document.createElement('tbody');

    durRows.forEach(dur => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-gray-100 last:border-b-0 hover:bg-gray-50/40 transition";

        // Sticky Row Header (Durability)
        const durTh = document.createElement('th');
        durTh.className = "sticky left-0 z-10 bg-gray-50 py-1.5 px-1.5 text-xs font-bold text-gray-700 border-r border-gray-200 whitespace-nowrap shadow-xs";
        durTh.textContent = `${dur}`;
        tr.appendChild(durTh);

        encCols.forEach(enc => {
            const td = document.createElement('td');
            td.className = "border-r border-gray-200 last:border-r-0 p-1 min-w-[58px] sm:min-w-[64px] align-middle transition";

            // 1) Impossible Cell:
            // 게임 내에서 내구도 < 강화단계는 불가 (dur < enc).
            // 또한 10/11, 10/12는 10/10으로 통일되므로 enc===10일 때 dur > 10인 칸은 빈칸(비활성).
            const isImpossible = (enc > dur) || (enc === 10 && dur > 10);

            if (isImpossible) {
                td.className += " bg-gray-50/50 text-gray-200 select-none cursor-default";
                td.innerHTML = `<span class="inline-block text-gray-200/60 select-none text-[10px]">&middot;</span>`;
                tr.appendChild(td);
                return;
            }

            // 2) Check Market Trade Data & Enhancement EV
            const cellKey = `${enc}_${dur}`;
            const cellData = variant.matrix ? variant.matrix[cellKey] : null;
            const spotInfo = getVariantCellSpotPrice(variant, cellKey, false);
            const hasMarketPrice = cellData && cellData.history && cellData.history.length > 0 && spotInfo.price > 0;

            // 강화 가능한 옵션 장비 셀인지 여부 (5~9강, 내구도 > 강화단계, 10강 기준가 존재)
            const isEnhanceable = !isMu && enc >= 5 && enc <= 9 && dur > enc && s10 > 0;
            let optRes = null;
            if (isEnhanceable) {
                optRes = optimizeEnhancementExact({
                    l: enc,
                    d: dur,
                    e: equipMeta.level,
                    u: equipMeta.isSturdy,
                    s7, s8, s9, s10,
                    reaEok: GLOBAL_REA_PRICE_EOK,
                    stone396Eok: FIXED_STONE_396_EOK
                });
            }
            const hasEv = isEnhanceable && optRes !== null && optRes.ev !== undefined;
            const evVal = hasEv ? optRes.ev : 0;

            if (hasMarketPrice && hasEv) {
                // 실제 시세와 강화 기댓값이 둘 다 있는 칸 (동시 표기)
                td.className += " matrix-choice-cell cursor-pointer bg-white hover:bg-blue-50/80 border border-gray-200 group";
                td.dataset.enc = enc;
                td.dataset.dur = dur;
                td.innerHTML = `
                    <div class="flex items-center justify-center gap-1 text-[11px] sm:text-xs font-bold text-gray-900 group-hover:text-blue-700 leading-tight">
                        <span>${formatPriceEok(spotInfo.price)}</span>
                        <span class="text-[9px] text-gray-400 font-normal">(${cellData.count})</span>
                    </div>
                    <div class="text-[10px] font-bold ${evVal >= 0 ? 'text-indigo-600' : 'text-rose-600'} leading-tight mt-0.5">
                        <span class="text-[9px] font-medium text-gray-400">기댓</span> ${formatPriceEok(evVal)}
                    </div>
                `;

                td.onclick = () => {
                    table.querySelectorAll('.matrix-choice-cell').forEach(c => {
                        c.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50', 'ring-indigo-500', 'bg-indigo-50');
                    });
                    td.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50');

                    loadDataAndRender(cellData.history, cellData.count);
                    currentSelectedCell = { enc: enc, dur: dur, spotFair: spotInfo.price };
                    renderEnhancementSimulatorUI(item, variant, currentSelectedCell);

                    if (window.innerWidth < 1024) {
                        const chartSec = document.getElementById('chart-section');
                        if (chartSec) {
                            setTimeout(() => {
                                chartSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }, 100);
                        }
                    }
                };
            } else if (hasMarketPrice) {
                // 실제 시세만 있는 칸 (10강 완성작, 마감작 또는 무옵션)
                td.className += " matrix-choice-cell cursor-pointer bg-white hover:bg-blue-50/80 border border-gray-200 group";
                td.dataset.enc = enc;
                td.dataset.dur = dur;
                td.innerHTML = `
                    <div class="text-[11px] sm:text-xs font-bold text-gray-900 group-hover:text-blue-700 leading-tight">
                        ${formatPriceEok(spotInfo.price)}
                    </div>
                    <div class="text-[9px] text-gray-400 font-medium leading-none mt-0.5">
                        ${cellData.count}건
                    </div>
                `;

                td.onclick = () => {
                    table.querySelectorAll('.matrix-choice-cell').forEach(c => {
                        c.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50', 'ring-indigo-500', 'bg-indigo-50');
                    });
                    td.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50');

                    loadDataAndRender(cellData.history, cellData.count);
                    currentSelectedCell = { enc: enc, dur: dur, spotFair: spotInfo.price };
                    renderEnhancementSimulatorUI(item, variant, currentSelectedCell);

                    if (window.innerWidth < 1024) {
                        const chartSec = document.getElementById('chart-section');
                        if (chartSec) {
                            setTimeout(() => {
                                chartSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }, 100);
                        }
                    }
                };
            } else if (hasEv) {
                // 실제 시세는 없지만 강화 기댓값은 산출 가능한 칸
                td.className += " matrix-choice-cell cursor-pointer bg-indigo-50/30 hover:bg-indigo-100/60 border border-indigo-100/80 group";
                td.dataset.enc = enc;
                td.dataset.dur = dur;
                td.innerHTML = `
                    <div class="text-[10px] text-gray-400 font-normal leading-tight select-none">
                        시세 없음
                    </div>
                    <div class="text-[10px] sm:text-[11px] font-extrabold ${evVal >= 0 ? 'text-indigo-700' : 'text-rose-600'} leading-tight mt-0.5">
                        <span class="text-[9px] font-medium text-indigo-400">기댓</span> ${formatPriceEok(evVal)}
                    </div>
                `;

                td.onclick = () => {
                    table.querySelectorAll('.matrix-choice-cell').forEach(c => {
                        c.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50', 'ring-indigo-500', 'bg-indigo-50');
                    });
                    td.classList.add('ring-2', 'ring-indigo-500', 'bg-indigo-50');

                    // 시세 거래 기록 없음 -> 차트 초기화 및 플레이스홀더 안내
                    if (priceChart) { priceChart.destroy(); priceChart = null; }
                    if (elements.chartPlaceholder) {
                        elements.chartPlaceholder.classList.remove('hidden');
                        elements.chartPlaceholder.innerHTML = `
                            <div class="p-3 text-center">
                                <div class="text-sm font-bold text-indigo-700 mb-1">${enc}강 ${dur}내구 (거래 기록 없음)</div>
                                <div class="text-xs text-gray-500">실제 거래 내역이 없어 시세 그래프 대신<br>아래 <span class="font-semibold text-blue-600">강화 완료 기대수익 및 최적 보호제 구간</span>을 표시합니다.</div>
                            </div>
                        `;
                    }
                    if (elements.marketSummaryCard) {
                        elements.marketSummaryCard.classList.add('hidden');
                    }

                    currentSelectedCell = { enc: enc, dur: dur, spotFair: 0 };
                    renderEnhancementSimulatorUI(item, variant, currentSelectedCell);

                    if (window.innerWidth < 1024) {
                        const chartSec = document.getElementById('chart-section');
                        if (chartSec) {
                            setTimeout(() => {
                                chartSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }, 100);
                        }
                    }
                };
            } else {
                // 시세 없음 + 강화 기댓값 대상 아님 (무옵션 또는 10강/마감작인데 거래 없음)
                // "무옵은 기댓값이 없으니 시세가 없으면 칸을 비워두는 방식을 적용하라."
                td.className += " bg-white/30 text-gray-300 select-none cursor-default";
                td.innerHTML = `<span class="text-gray-300">-</span>`;
            }

            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableWrap.appendChild(table);
    container.appendChild(tableWrap);
};

// ============================================================================
// ★ 4. 비-몬테카를로 강화 기대수익(EV) & 최적 보호제 구간 UI 렌더링
// ============================================================================
const renderEnhancementSimulatorUI = (item, variant, selectedCell = null) => {
    const card = elements.enhanceSimCard;
    if (!card) return;

    // 무옵션이거나, 선택된 셀이 없거나, 강화 불가능한 셀(10강 완성작 또는 내구도 <= 강화단계 마감작)이면 숨김
    if (
        !item ||
        item.category !== 'equip' ||
        !variant ||
        variant.name === '무' ||
        !selectedCell ||
        selectedCell.enc < 5 ||
        selectedCell.enc > 9 ||
        selectedCell.dur <= selectedCell.enc
    ) {
        card.classList.add('hidden');
        return;
    }

    const equipMeta = item.equipMeta || getEquipMeta(item.name);
    const l = selectedCell.enc;
    const d = selectedCell.dur;
    const e = equipMeta.level;
    const u = equipMeta.isSturdy;

    // 10강(10/10), 9강(9/9), 8강(8/8), 7강(7/7) 시세 자동 추출 (3건 미만 셀 폴백 허용)
    const s10 = getVariantCellSpotPrice(variant, '10_10', true).price;
    const s9 = getVariantCellSpotPrice(variant, '9_9', true).price;
    const s8 = getVariantCellSpotPrice(variant, '8_8', true).price;
    const s7 = getVariantCellSpotPrice(variant, '7_7', true).price;

    const optRes = optimizeEnhancementExact({
        l,
        d,
        e,
        u,
        s7,
        s8,
        s9,
        s10,
        reaEok: GLOBAL_REA_PRICE_EOK,
        stone396Eok: FIXED_STONE_396_EOK
    });

    const fmtTh = (th) => th === 100
        ? '<span class="text-gray-500 font-semibold">안씀</span>'
        : `<span class="text-blue-600 font-bold">${th}강부터 보호제</span>`;

    card.classList.remove('hidden');
    card.innerHTML = `
        <div class="flex items-baseline gap-2.5 pb-2 border-b border-blue-100/80">
            <span class="text-xs font-bold text-blue-800 uppercase tracking-tight">강화 완료 기대수익</span>
            <span class="text-xl font-extrabold ${optRes.ev >= 0 ? 'text-blue-600' : 'text-rose-600'} tracking-tight">${formatPriceEok(optRes.ev)}</span>
        </div>

        <div class="grid grid-cols-3 gap-2 pt-2.5 text-center sm:text-left">
            <div class="bg-white/80 rounded-lg px-2.5 py-1.5 border border-gray-100">
                <div class="text-[10px] text-gray-400 font-medium">내구도 10 이상</div>
                <div class="text-xs sm:text-sm mt-0.5">${d >= 10 ? fmtTh(optRes.th10) : '<span class="text-gray-400 font-normal">해당없음</span>'}</div>
            </div>
            <div class="bg-white/80 rounded-lg px-2.5 py-1.5 border border-gray-100">
                <div class="text-[10px] text-gray-400 font-medium">내구도 9</div>
                <div class="text-xs sm:text-sm mt-0.5">${d >= 9 ? fmtTh(optRes.th9) : '<span class="text-gray-400 font-normal">해당없음</span>'}</div>
            </div>
            <div class="bg-white/80 rounded-lg px-2.5 py-1.5 border border-gray-100">
                <div class="text-[10px] text-gray-400 font-medium">내구도 8</div>
                <div class="text-xs sm:text-sm mt-0.5">${d >= 8 ? fmtTh(optRes.th8) : '<span class="text-gray-400 font-normal">해당없음</span>'}</div>
            </div>
        </div>

        <div class="pt-2.5 mt-2.5 border-t border-blue-100/80">
            <div class="text-[10px] text-gray-500 font-bold mb-1.5">최종 결과 도달 확률</div>
            <div class="grid grid-cols-5 gap-1.5 text-center">
                <div class="bg-white/80 rounded-lg py-1.5 px-1 border border-gray-100">
                    <div class="text-[10px] text-blue-600 font-bold">10강</div>
                    <div class="text-xs font-extrabold text-gray-900 mt-0.5">${optRes.probs[10].toFixed(2)}%</div>
                </div>
                <div class="bg-white/80 rounded-lg py-1.5 px-1 border border-gray-100">
                    <div class="text-[10px] text-indigo-600 font-semibold">9강</div>
                    <div class="text-xs font-bold text-gray-800 mt-0.5">${optRes.probs[9].toFixed(2)}%</div>
                </div>
                <div class="bg-white/80 rounded-lg py-1.5 px-1 border border-gray-100">
                    <div class="text-[10px] text-sky-600 font-semibold">8강</div>
                    <div class="text-xs font-bold text-gray-800 mt-0.5">${optRes.probs[8].toFixed(2)}%</div>
                </div>
                <div class="bg-white/80 rounded-lg py-1.5 px-1 border border-gray-100">
                    <div class="text-[10px] text-emerald-600 font-semibold">7강</div>
                    <div class="text-xs font-bold text-gray-800 mt-0.5">${optRes.probs[7].toFixed(2)}%</div>
                </div>
                <div class="bg-white/80 rounded-lg py-1.5 px-1 border border-gray-100">
                    <div class="text-[10px] text-rose-500 font-semibold">파괴</div>
                    <div class="text-xs font-bold text-rose-600 mt-0.5">${optRes.probs[0].toFixed(2)}%</div>
                </div>
            </div>
        </div>
    `;
};

// ============================================================================
// ★ ADAPTIVE MARKET MICROSTRUCTURE ENGINE (시세곡선 추상화 & 실시간 적정가 엔진)
// ============================================================================
const calcMedian = (arr) => {
    if (!arr || arr.length === 0) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const formatPriceEok = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '-';
    if (val >= 100) return Math.round(val).toLocaleString('ko-KR') + '억';
    if (val >= 10) return (Math.round(val * 10) / 10).toLocaleString('ko-KR') + '억';
    return Number(val.toFixed(2)).toString() + '억';
};

const calcWeightedMedian = (sortedPairs) => {
    if (!sortedPairs || sortedPairs.length === 0) return 0;
    if (sortedPairs.length === 1) return sortedPairs[0].p;
    let totalW = 0;
    for (const item of sortedPairs) totalW += item.w;
    if (totalW <= 0) return calcMedian(sortedPairs.map(x => x.p));

    const halfW = totalW * 0.5;
    let cumW = 0;
    for (let i = 0; i < sortedPairs.length; i++) {
        cumW += sortedPairs[i].w;
        if (cumW >= halfW) {
            if (Math.abs(cumW - halfW) < 1e-9 && i + 1 < sortedPairs.length) {
                return 0.5 * (sortedPairs[i].p + sortedPairs[i + 1].p);
            }
            return sortedPairs[i].p;
        }
    }
    return sortedPairs[sortedPairs.length - 1].p;
};

/**
 * 1D 2-Means (Otsu Bimodal Partition):
 * 구매자(Bid)와 판매자(Ask)의 건수 비율이 9:1 또는 1:9로 극단적 비대칭이어도
 * 두 호가 클러스터를 독립 분리하여 50:50 정중앙 균형 시세(Mid-Market Price)를 복원합니다.
 */
const bimodalBidAsk = (prices, weights) => {
    if (!prices || prices.length === 0) return { mid: 0, bid: 0, ask: 0 };
    const pairs = prices.map((p, i) => ({ p, w: weights ? weights[i] : 1.0 })).sort((a, b) => a.p - b.p);
    const n = pairs.length;
    const minP = pairs[0].p;
    const maxP = pairs[n - 1].p;

    if (n === 1 || (maxP - minP) <= Math.max(maxP * 0.03, 0.05)) {
        let sw = 0, sp = 0;
        for (const item of pairs) { sw += item.w; sp += item.p * item.w; }
        const m = sw > 0 ? sp / sw : minP;
        return { mid: m, bid: m, ask: m };
    }

    let bestCost = Infinity;
    let bestBid = minP;
    let bestAsk = maxP;
    let bestW1 = 1.0;
    let bestW2 = 1.0;

    for (let k = 1; k < n; k++) {
        if (pairs[k].p === pairs[k - 1].p) continue;

        let w1 = 0, s1 = 0;
        for (let i = 0; i < k; i++) { w1 += pairs[i].w; s1 += pairs[i].p * pairs[i].w; }
        const m1 = s1 / Math.max(w1, 1e-9);
        let v1 = 0;
        for (let i = 0; i < k; i++) { v1 += pairs[i].w * Math.pow(pairs[i].p - m1, 2); }
        v1 /= Math.max(w1, 1e-9);

        let w2 = 0, s2 = 0;
        for (let i = k; i < n; i++) { w2 += pairs[i].w; s2 += pairs[i].p * pairs[i].w; }
        const m2 = s2 / Math.max(w2, 1e-9);
        let v2 = 0;
        for (let i = k; i < n; i++) { v2 += pairs[i].w * Math.pow(pairs[i].p - m2, 2); }
        v2 /= Math.max(w2, 1e-9);

        // 군집 크기 가중치를 배제한 순수 군집 내 분산 합 -> 소수 집단(1~2명)도 독립 호가 군집으로 보존
        const cost = v1 + v2;
        if (cost < bestCost) {
            bestCost = cost;
            bestBid = calcWeightedMedian(pairs.slice(0, k));
            bestAsk = calcWeightedMedian(pairs.slice(k));
            bestW1 = w1;
            bestW2 = w2;
        }
    }

    const consensus = calcWeightedMedian(pairs);
    const totalW = bestW1 + bestW2;
    const ratio = Math.min(bestW1, bestW2) / Math.max(totalW, 1e-9);
    // 동시대 양쪽 호가 군집이 1:2~1:2.5 수준까지는 50:50 스프레드 중간값을 보존(balanceFactor = 1.0)
    // 과거 시세 잔상이나 1명의 고립된 호가로 가중치가 작아진 군집은 가중 컨센서스로 부드럽게 앵커링
    const balanceFactor = Math.min(1.0, 2.5 * ratio);
    const rawMid = 0.5 * (bestBid + bestAsk);
    const mid = balanceFactor * rawMid + (1.0 - balanceFactor) * consensus;

    return { mid, bid: bestBid, ask: bestAsk };
};

const computeMarketAnalysis = (rawHistory) => {
    if (!rawHistory || rawHistory.length === 0) return null;

    const DAY_MS = 86400 * 1000;
    const sorted = [...rawHistory].sort((a, b) => a.isoDate - b.isoDate);

    // [1단계] 동일인 일별 도배 통합 (1 User + 1 Day = 1 Representative Vote)
    const dayUserMap = new Map();
    const allUniqueUsers = new Set();

    for (const h of sorted) {
        const t = h.isoDate.getTime();
        const dayIdx = Math.floor(t / DAY_MS);
        const rawNick = h.meta?.nickname || 'anon';
        const baseNick = rawNick.split('/')[0].trim() || 'anon';
        allUniqueUsers.add(baseNick);

        const key = `${dayIdx}__${baseNick}`;
        if (!dayUserMap.has(key)) {
            dayUserMap.set(key, []);
        }
        dayUserMap.get(key).push({ t, isoDate: h.isoDate, price: h.price, nick: baseNick });
    }

    const userDays = [];
    for (const [, pts] of dayUserMap.entries()) {
        pts.sort((a, b) => a.t - b.t);
        const medP = calcMedian(pts.map(x => x.price));
        const lastPt = pts[pts.length - 1];
        userDays.push({
            ts: lastPt.t,
            isoDate: lastPt.isoDate,
            dayIdx: Math.floor(lastPt.t / DAY_MS),
            nick: lastPt.nick,
            price: medP,
            rawCount: pts.length
        });
    }
    userDays.sort((a, b) => a.ts - b.ts);

    // [2단계] 고유 유저(1인 1표) 기반 국소 햄펠 필터 & 단독 스파이크 보정
    const globalMed = calcMedian(userDays.map(u => u.price));
    let hardOutlierRawCount = 0;
    let spikeClampedRawCount = 0;

    for (let i = 0; i < userDays.length; i++) {
        const ud = userDays[i];
        const p = ud.price;

        // 주변 +-45일 고유 유저 수집 (유저 수가 부족하면 +-90일, +-150일, 전체로 확장)
        let uMap = new Map();
        for (const winDays of [45, 90, 150, 99999]) {
            uMap.clear();
            for (const other of userDays) {
                if (Math.abs(other.dayIdx - ud.dayIdx) <= winDays) {
                    if (!uMap.has(other.nick)) uMap.set(other.nick, []);
                    uMap.get(other.nick).push(other.price);
                }
            }
            const reqUsers = winDays >= 90 ? Math.min(3, allUniqueUsers.size) : Math.min(4, allUniqueUsers.size);
            if (uMap.size >= reqUsers) break;
        }

        const uMeds = [];
        for (const [, pList] of uMap.entries()) {
            uMeds.push(calcMedian(pList));
        }

        const lMed = uMeds.length > 0 ? calcMedian(uMeds) : globalMed;
        const mad = calcMedian(uMeds.map(m => Math.abs(m - lMed)));
        const sigma = Math.max(1.4826 * mad, lMed * 0.08);

        // 본인 외에 전후 ±150일 내 이 가격(±12%)에 동의하는 다른 고유 유저 수 (추세 전환 징검다리 보존)
        const nearUserSet = new Set();
        for (const other of userDays) {
            if (other.nick === ud.nick) continue;
            if (Math.abs(other.dayIdx - ud.dayIdx) <= 150) {
                const relDiff = Math.abs(other.price - p) / Math.max(Math.min(lMed, p), 1e-6);
                if (relDiff <= 0.12) {
                    nearUserSet.add(other.nick);
                }
            }
        }
        const otherUsersNear = nearUserSet.size;

        // 주변 ±25일 내 유사 가격(±8%)이 등장한 날짜 수
        const simDays = new Set();
        for (const other of userDays) {
            if (Math.abs(other.dayIdx - ud.dayIdx) <= 25 && Math.abs(other.price - p) / Math.max(p, 1e-6) <= 0.08) {
                simDays.add(other.dayIdx);
            }
        }

        if (p > lMed * 1.85 || p < lMed * 0.45) {
            // 1) 셋/피스 미분할 오류 또는 10배/0.1배 오타 및 극단적 투매
            ud.status = 'hard_outlier';
            hardOutlierRawCount += ud.rawCount;
        } else if (userDays.length >= 6 && Math.abs(p - lMed) > 2.2 * sigma && simDays.size <= 2) {
            // 2) 1~2일 단발성으로 튀는 오타/급처 특이값
            ud.status = 'hard_outlier';
            hardOutlierRawCount += ud.rawCount;
        } else if (Math.abs(p - lMed) > 2.2 * sigma && otherUsersNear === 0 && simDays.size < 4) {
            // 3) 단독 1인이 고립된 가격에 고집하는 미체결 알박기/배짱 호가 (동조자 0명) 제거
            ud.status = 'hard_outlier';
            hardOutlierRawCount += ud.rawCount;
        } else {
            ud.status = 'normal';
            ud.effPrice = p;
        }
    }

    let validUD = userDays.filter(u => u.status !== 'hard_outlier');
    if (validUD.length === 0) {
        validUD = userDays.map(u => ({ ...u, status: 'normal', effPrice: u.price }));
    }

    // [3단계] 적응형 타임 그리드 기반 2-Cluster 호가 분리 및 시세곡선 생성
    const tStart = validUD[0].ts;
    const tEnd = validUD[validUD.length - 1].ts;
    const spanDays = Math.max(1, (tEnd - tStart) / DAY_MS);

    // 전체 기간에 맞춰 7일 단위(또는 기간이 짧으면 세밀하게) 그리드 생성
    const stepDays = spanDays > 180 ? 7 : Math.max(1, Math.floor(spanDays / 25));
    const stepMs = stepDays * DAY_MS;

    const gridPoints = [];
    for (let curT = tStart; curT < tEnd; curT += stepMs) {
        gridPoints.push(curT);
    }
    gridPoints.push(tEnd);

    const minTargetUsers = Math.min(4, allUniqueUsers.size);
    const rawGrid = [];

    for (const gt of gridPoints) {
        let winPts = [];
        let chosenWinDays = 30;
        for (const wd of [30, 45, 60, 90, 135, 180, 270, 99999]) {
            chosenWinDays = wd;
            winPts = validUD.filter(u => Math.abs(u.ts - gt) <= wd * DAY_MS);
            const uSet = new Set(winPts.map(u => u.nick));
            const reqUsers = wd >= 180
                ? Math.min(2, allUniqueUsers.size)
                : (wd >= 120 ? Math.min(3, allUniqueUsers.size) : minTargetUsers);
            if (uSet.size >= reqUsers && winPts.length >= 2) break;
        }
        if (winPts.length === 0) winPts = validUD;

        // 윈도우 내 고유 유저별 시간 가중 평균 호가 계산 (1인 독식 방지 캡 + 시간 감쇠 상한 + 최근성 가중치 연동)
        const userAcc = new Map();
        const tau = Math.min(45, Math.max(7, chosenWinDays * 0.40));
        for (const u of winPts) {
            const dtDays = Math.abs(u.ts - gt) / DAY_MS;
            const w = Math.exp(-0.5 * Math.pow(dtDays / tau, 2));
            if (!userAcc.has(u.nick)) userAcc.set(u.nick, { swp: 0, sw: 0, minDtDays: dtDays });
            const acc = userAcc.get(u.nick);
            acc.swp += w * u.effPrice;
            acc.sw += w;
            if (dtDays < acc.minDtDays) acc.minDtDays = dtDays;
        }

        const uPrices = [];
        const uWeights = [];
        for (const [, acc] of userAcc.entries()) {
            if (acc.sw > 0) {
                uPrices.push(acc.swp / acc.sw);
                const recencyFactor = Math.exp(-0.5 * Math.pow(acc.minDtDays / 35, 2));
                uWeights.push(Math.min(acc.sw, 1.5) * Math.max(0.01, recencyFactor)); // 도배 상한 캡 + 최근성 감쇠
            }
        }

        const { mid, bid, ask } = bimodalBidAsk(uPrices, uWeights);
        rawGrid.push({ t: gt, mid, bid, ask, userCount: uPrices.length });
    }

    // [4단계] 가우시안 커널 스무딩 (시각적 추상화 곡선 완성)
    const bw = 1.8;
    const curve = [];
    for (let i = 0; i < rawGrid.length; i++) {
        let sw = 0, sMid = 0, sBid = 0, sAsk = 0;
        for (let j = 0; j < rawGrid.length; j++) {
            const w = Math.exp(-0.5 * Math.pow((i - j) / bw, 2));
            sw += w;
            sMid += w * rawGrid[j].mid;
            sBid += w * rawGrid[j].bid;
            sAsk += w * rawGrid[j].ask;
        }
        const fMid = sMid / sw;
        const fBid = Math.min(fMid, sBid / sw);
        const fAsk = Math.max(fMid, sAsk / sw);
        curve.push({
            x: rawGrid[i].t,
            fair: fMid,
            bid: fBid,
            ask: fAsk,
            userCount: rawGrid[i].userCount
        });
    }

    // [5단계] "지금 당장의 시세" (Spot Nowcast) 및 요약 지표 산출
    const lastNode = curve[curve.length - 1];
    const spotFair = lastNode.fair;
    const spotBid = lastNode.bid;
    const spotAsk = lastNode.ask;
    const halfSpread = Math.max(0, (spotAsk - spotBid) / 2);
    const spreadPct = spotFair > 0 ? (halfSpread / spotFair) * 100 : 0;

    // 30일 전 대비 추세 계산
    const targetPrevT = lastNode.x - 30 * DAY_MS;
    let prevNode = curve[0];
    for (const c of curve) {
        if (Math.abs(c.x - targetPrevT) < Math.abs(prevNode.x - targetPrevT)) {
            prevNode = c;
        }
    }
    const trendPct = prevNode.fair > 0 ? ((spotFair - prevNode.fair) / prevNode.fair) * 100 : 0;

    const spamRemovedCount = Math.max(0, rawHistory.length - userDays.length);
    const totalOutlierFixed = hardOutlierRawCount + spikeClampedRawCount;

    return {
        curve,
        userDays,
        validUD,
        spotFair,
        spotBid,
        spotAsk,
        halfSpread,
        spreadPct,
        trendPct,
        rawCount: rawHistory.length,
        uniqueUserCount: allUniqueUsers.size,
        userDayCount: userDays.length,
        spamRemovedCount,
        totalOutlierFixed,
        hardOutlierRawCount,
        spikeClampedRawCount
    };
};

const renderMarketSummaryUI = (analysis) => {
    if (!analysis) return;

    if (elements.marketSummaryCard) {
        elements.marketSummaryCard.classList.remove('hidden');
        elements.marketSummaryCard.innerHTML = `
            <div class="flex items-baseline gap-2.5 pb-2 border-b border-blue-100/80">
                <span class="text-xs font-bold text-blue-800 uppercase tracking-tight">적정 시세</span>
                <span class="text-2xl font-extrabold text-blue-600 tracking-tight">${formatPriceEok(analysis.spotFair)}</span>
            </div>
            <div class="grid grid-cols-3 gap-2 pt-2.5 text-center sm:text-left">
                <div class="bg-white/80 rounded-lg px-2.5 py-1.5 border border-gray-100">
                    <div class="text-[10px] text-gray-400 font-medium">사요 호가</div>
                    <div class="text-xs sm:text-sm font-bold text-emerald-600 mt-0.5">${formatPriceEok(analysis.spotBid)}</div>
                </div>
                <div class="bg-white/80 rounded-lg px-2.5 py-1.5 border border-gray-100">
                    <div class="text-[10px] text-gray-400 font-medium">팔아요 호가</div>
                    <div class="text-xs sm:text-sm font-bold text-rose-600 mt-0.5">${formatPriceEok(analysis.spotAsk)}</div>
                </div>
                <div class="bg-white/80 rounded-lg px-2.5 py-1.5 border border-gray-100">
                    <div class="text-[10px] text-gray-400 font-medium">사요·팔아요 오차범위</div>
                    <div class="text-xs sm:text-sm font-bold text-gray-800 mt-0.5">±${formatPriceEok(analysis.halfSpread)} <span class="text-[10px] font-normal text-gray-500">(±${analysis.spreadPct.toFixed(1)}%)</span></div>
                </div>
            </div>
        `;
    }
};

const loadDataAndRender = (history, count) => {
    try {
        currentChartData = history;
        currentAnalysis = computeMarketAnalysis(history);
        renderMarketSummaryUI(currentAnalysis);
        updateChart();
    } catch (e) {
        console.error(e);
        alert("차트 데이터 로드 중 오류: " + e.message);
    }
};

// ★ 커서 떨림 방지 & 적정 시세 단일 타겟팅 커스텀 인터랙션 모드
if (typeof Chart !== 'undefined' && Chart.Interaction && Chart.Interaction.modes) {
    Chart.Interaction.modes.fairPriceOnly = function (chart, e) {
        const pos = Chart.helpers && Chart.helpers.getRelativePosition
            ? Chart.helpers.getRelativePosition(e, chart)
            : (e.x !== undefined ? { x: e.x, y: e.y } : { x: 0, y: 0 });

        if (chart.chartArea) {
            if (pos.x < chart.chartArea.left || pos.x > chart.chartArea.right ||
                pos.y < chart.chartArea.top || pos.y > chart.chartArea.bottom) {
                return [];
            }
        }

        const meta = chart.getDatasetMeta(0); // dataset 0: '적정 시세'
        if (!meta || meta.hidden || !meta.data || meta.data.length === 0) return [];

        let nearestDist = Infinity;
        let nearestIdx = -1;
        for (let i = 0; i < meta.data.length; i++) {
            const el = meta.data[i];
            const dist = Math.abs(el.x - pos.x);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestIdx = i;
            }
        }

        if (nearestIdx !== -1) {
            return [{ element: meta.data[nearestIdx], datasetIndex: 0, index: nearestIdx }];
        }
        return [];
    };
}

const updateChart = () => {
    try {
        if (!elements.chartCanvas || typeof Chart === 'undefined') return;
        if (elements.chartPlaceholder) elements.chartPlaceholder.classList.add('hidden');
        if (priceChart) priceChart.destroy();

        if (!currentChartData || currentChartData.length === 0) return;
        if (!currentAnalysis) {
            currentAnalysis = computeMarketAnalysis(currentChartData);
            renderMarketSummaryUI(currentAnalysis);
        }

        const now = new Date();
        const todayTime = now.getTime();
        const latestDataTime = currentChartData[currentChartData.length - 1].isoDate.getTime();
        const refEndTime = Math.max(todayTime, latestDataTime);

        let cutoffTime = 0;
        if (currentChartRange === '3m') {
            const d3m = new Date(latestDataTime);
            d3m.setMonth(d3m.getMonth() - 3);
            cutoffTime = d3m.getTime();
        }

        // 1. Raw Data (기존 빨간 선용)
        const filteredRaw = currentChartData.filter(d => d.isoDate.getTime() >= cutoffTime);
        const firstT = filteredRaw.length > 0 ? filteredRaw[0].isoDate.getTime() : refEndTime;
        const range = refEndTime - firstT;
        const eps = range > 0 ? range * 0.002 : 1000 * 60 * 30;

        const rawDisplayData = [];
        for (let i = 0; i < filteredRaw.length; i++) {
            const t = filteredRaw[i].isoDate.getTime();
            const p = filteredRaw[i].price;
            rawDisplayData.push({ x: t - eps, y: p, groupId: i });
            rawDisplayData.push({ x: t + eps, y: p, groupId: i });
        }
        const lastRawTime = rawDisplayData.length > 0 ? rawDisplayData[rawDisplayData.length - 1].x : refEndTime;
        if (rawDisplayData.length > 0 && refEndTime > lastRawTime) {
            rawDisplayData.push({ x: lastRawTime + 1, y: null });
        }

        // 2. Smoothed Blue Curve & Bid-Ask Band Data
        const visibleCurve = currentAnalysis.curve;
        const fairCurvePoints = visibleCurve.map(c => ({ x: c.x, y: c.fair, bid: c.bid, ask: c.ask }));
        const askBandPoints = visibleCurve.map(c => ({ x: c.x, y: c.ask }));
        const bidBandPoints = visibleCurve.map(c => ({ x: c.x, y: c.bid }));

        // 정제된 일일 호가 점 (배경) - 마우스 이벤트 무시(떨림 방지)
        const cleanScatterPoints = currentAnalysis.validUD
            .filter(u => u.status === 'normal')
            .map(u => ({ x: u.ts, y: u.price }));

        // X축 범위 및 틱 생성
        const fixedStartTime = new Date(2025, 1, 12).getTime();
        const xMin = fixedStartTime;
        const firstDate = new Date(xMin);
        const quarterTicks = [];
        let tickYear = firstDate.getFullYear();
        let tickMonth = firstDate.getMonth();
        const tickStepMonths = 3;

        while (true) {
            const tickDate = new Date(tickYear, tickMonth, 1);
            const tickTime = tickDate.getTime();
            if (tickTime > refEndTime) break;
            if (tickTime >= xMin) {
                quarterTicks.push(tickTime);
            }
            tickMonth += tickStepMonths;
            if (tickMonth >= 12) {
                tickMonth -= 12;
                tickYear++;
            }
        }

        const datasets = [
            {
                label: '적정 시세',
                data: fairCurvePoints,
                borderColor: '#2563eb',
                backgroundColor: '#2563eb',
                borderWidth: 3.5,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: '#2563eb',
                pointHoverBorderColor: '#ffffff',
                pointHoverBorderWidth: 2,
                pointHitRadius: 20,
                tension: 0.3,
                cubicInterpolationMode: 'monotone',
                fill: false,
                order: 1
            },
            {
                label: '팔아요 호가',
                data: askBandPoints,
                borderColor: 'rgba(59, 130, 246, 0.30)',
                backgroundColor: 'rgba(59, 130, 246, 0.10)',
                borderWidth: 1.2,
                borderDash: [4, 4],
                pointRadius: 0,
                pointHoverRadius: 0,
                pointHitRadius: 0,
                tension: 0.3,
                cubicInterpolationMode: 'monotone',
                fill: '+1',
                order: 2
            },
            {
                label: '사요 호가',
                data: bidBandPoints,
                borderColor: 'rgba(16, 185, 129, 0.35)',
                backgroundColor: 'rgba(59, 130, 246, 0.10)',
                borderWidth: 1.2,
                borderDash: [4, 4],
                pointRadius: 0,
                pointHoverRadius: 0,
                pointHitRadius: 0,
                tension: 0.3,
                cubicInterpolationMode: 'monotone',
                fill: false,
                order: 3
            },
            {
                label: '거래 데이터',
                data: cleanScatterPoints,
                type: 'scatter',
                backgroundColor: 'rgba(148, 163, 184, 0.28)',
                borderColor: 'rgba(100, 116, 139, 0.35)',
                borderWidth: 1,
                pointRadius: 2.0,
                pointHoverRadius: 0,
                pointHitRadius: 0,
                order: 4
            }
        ];

        const ctx = elements.chartCanvas.getContext('2d');

        priceChart = new Chart(ctx, {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: {
                            boxWidth: 12,
                            boxHeight: 3,
                            usePointStyle: false,
                            font: { size: 11 },
                            color: '#4b5563'
                        }
                    },
                    tooltip: {
                        enabled: true,
                        displayColors: false,
                        animation: { duration: 80 },
                        padding: 8,
                        backgroundColor: 'rgba(15, 23, 42, 0.90)',
                        titleColor: '#94a3b8',
                        titleFont: { size: 11, weight: '500' },
                        bodyColor: '#ffffff',
                        bodyFont: { size: 13, weight: '700' },
                        callbacks: {
                            title: function (context) {
                                if (!context || context.length === 0) return '';
                                const d = new Date(context[0].parsed.x);
                                return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate();
                            },
                            label: function (context) {
                                if (context.parsed.y === null || context.parsed.y === undefined) return '';
                                return `적정 시세: ${formatPriceEok(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        display: true,
                        min: xMin,
                        max: refEndTime,
                        afterBuildTicks: function (axis) {
                            if (quarterTicks.length > 0) {
                                axis.ticks = quarterTicks.map(t => ({ value: t }));
                            }
                        },
                        ticks: {
                            color: '#6b7280',
                            maxRotation: 0,
                            minRotation: 0,
                            callback: function (value) {
                                const d = new Date(value);
                                const yy = String(d.getFullYear()).slice(-2);
                                const m = d.getMonth() + 1;
                                return yy + '.' + m;
                            }
                        },
                        grid: {
                            color: '#e5e7eb',
                            drawBorder: false,
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grace: '5%',
                        grid: { color: '#e5e7eb' },
                        ticks: {
                            color: '#6b7280',
                            callback: function (value) {
                                return Number(value).toFixed(1).replace(/\.0$/, '') + '억';
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'fairPriceOnly',
                    intersect: false,
                    axis: 'x'
                },
                hover: {
                    mode: 'fairPriceOnly',
                    intersect: false,
                    axis: 'x'
                }
            }
        });
    } catch (e) {
        console.error(e);
    }
};


// ============================================================================
// 도박(금도·다도) 기대수익 및 손익 백분위 곡선 시스템
// ============================================================================
let currentGachaType = 'gold'; // 'gold' | 'dia'
let currentGachaMetric = 'profit'; // 'profit' (순수익 억) | 'roi' (수익률 %)
let gachaChartInstance = null;
let gachaSpotCache = {};
let isGachaTableExpanded = false;
let isGachaMainOpen = false; // 기본값: 닫힘 (장비탭 숨김 & 악세탭에서 버튼 눌러야 열림)

// 1. 액세서리 실시간 적정 시세 조회기 (캐싱 지원)
const getAccSpotPrice = (itemName, targetGrade) => {
    const cacheKey = `${itemName}__${targetGrade}`;
    if (window.PRECOMPUTED_WEB_STATS && window.PRECOMPUTED_WEB_STATS.accSpotPrices && window.PRECOMPUTED_WEB_STATS.accSpotPrices[cacheKey] !== undefined) {
        return window.PRECOMPUTED_WEB_STATS.accSpotPrices[cacheKey];
    }
    if (gachaSpotCache[cacheKey] !== undefined) {
        return gachaSpotCache[cacheKey];
    }

    const itemData = ITEM_INDEX['acc']?.[itemName];
    if (!itemData || !itemData.lineIndices || itemData.lineIndices.length === 0) {
        gachaSpotCache[cacheKey] = 0;
        return 0;
    }

    const history = [];
    for (const idx of itemData.lineIndices) {
        const line = RAW_LINES[idx];
        const clean = line.replace(/^\(|\)$/g, '');
        const parts = clean.split(',').map(s => s.trim());
        if (parts.length >= 7 && parts[2] === '악세' && parts[4] === targetGrade) {
            const price = parseFloat(parts[6]) || 0;
            if (price <= 0) continue;
            const dateParts = parts[0].split('.');
            if (dateParts.length < 3) continue;
            const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], dateParts[3] || 0, dateParts[4] || 0);
            history.push({
                date: dateObj.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }),
                isoDate: dateObj,
                price: price,
                meta: { nickname: parts[1] }
            });
        }
    }

    if (history.length === 0) {
        gachaSpotCache[cacheKey] = 0;
        return 0;
    }

    try {
        const analysis = computeMarketAnalysis(history);
        if (analysis && analysis.spotFair > 0) {
            const spot = Number(analysis.spotFair.toFixed(2));
            gachaSpotCache[cacheKey] = spot;
            return spot;
        }
    } catch (e) {
        console.warn('computeMarketAnalysis error for', itemName, targetGrade, e);
    }

    // 폴백: 최근 5건 중앙값
    const recent = history.slice(-5).map(h => h.price);
    recent.sort((a, b) => a - b);
    const fallback = recent[Math.floor(recent.length / 2)] || history[history.length - 1].price;
    gachaSpotCache[cacheKey] = Number(fallback.toFixed(2));
    return gachaSpotCache[cacheKey];
};

// 2. 도박 확률 및 품목 정의
const GACHA_GOLD_CONFIG = [
    { name: '바씨', label: '바씨 (반/목)', count: 2, probPerPiece: 0.009710, grade: '금' },
    { name: '바새', label: '바새 (반/목)', count: 2, probPerPiece: 0.009710, grade: '금' },
    { name: '바발', label: '바발 (반/목)', count: 2, probPerPiece: 0.009710, grade: '금' },
    { name: '바흙', label: '바흙 (반/목)', count: 2, probPerPiece: 0.009710, grade: '금' },
    { name: '바진', label: '바진 (반/목)', count: 2, probPerPiece: 0.009710, grade: '금' },
    { name: '바물', label: '바물 (반/목)', count: 2, probPerPiece: 0.009710, grade: '금' },
    { name: '바손', label: '바손 (반/목)', count: 2, probPerPiece: 0.009710, grade: '금' },
    { name: '바칼', label: '바칼 (반/목)', count: 2, probPerPiece: 0.009710, grade: '금' },
    { name: '바생', label: '바생 (반/목)', count: 2, probPerPiece: 0.009710, grade: '금' },
    { name: '활씨', label: '활씨 (반/목)', count: 2, probPerPiece: 0.019420, grade: '금' },
    { name: '활생', label: '활생 (반/목)', count: 2, probPerPiece: 0.019420, grade: '금' },
    { name: '신씨', label: '신씨 (반/목)', count: 2, probPerPiece: 0.013870, grade: '금' },
    { name: '신생', label: '신생 (반/목)', count: 2, probPerPiece: 0.016180, grade: '금' },
    { name: '고미', label: '고미 (반/목)', count: 2, probPerPiece: 0.019420, grade: '금' },
    { name: '농아', label: '농아 (반/목)', count: 2, probPerPiece: 0.019420, grade: '금' },
    { name: '효소', label: '효소 (반/목)', count: 2, probPerPiece: 0.019420, grade: '금' },
    { name: '키토', label: '키토 (반/목)', count: 2, probPerPiece: 0.019420, grade: '금' },
    { name: '타우', label: '타우 (반/목)', count: 2, probPerPiece: 0.019420, grade: '금' },
    { name: '앰플', label: '앰플 (반/목)', count: 2, probPerPiece: 0.019420, grade: '금' },
    { name: '시균', label: '시균 (반/목)', count: 2, probPerPiece: 0.019420, grade: '금' },
    { name: '발굴', label: '발굴 (반/목)', count: 2, probPerPiece: 0.011650, grade: '금' },
    { name: '하경', label: '하경 (반/목)', count: 2, probPerPiece: 0.016180, grade: '금' },
    { name: '하레', label: '하레 (반/목)', count: 2, probPerPiece: 0.016180, grade: '금' }
];

const GACHA_DIA_CONFIG = [
    { name: '활씨', label: '활씨 (반/목)', count: 2, probPerPiece: 0.020830, grade: '다' },
    { name: '활생', label: '활생 (반/목)', count: 2, probPerPiece: 0.020830, grade: '다' },
    { name: '신씨', label: '신씨 (반/목)', count: 2, probPerPiece: 0.020830, grade: '다' },
    { name: '신생', label: '신생 (반/목)', count: 2, probPerPiece: 0.020830, grade: '다' },
    { name: '고미', label: '고미 (반/목)', count: 2, probPerPiece: 0.020830, grade: '다' },
    { name: '농아', label: '농아 (반/목)', count: 2, probPerPiece: 0.020830, grade: '다' },
    { name: '효소', label: '효소 (반/목)', count: 2, probPerPiece: 0.020830, grade: '다' },
    { name: '키토', label: '키토 (반/목)', count: 2, probPerPiece: 0.020830, grade: '다' },
    { name: '타우', label: '타우 (반/목)', count: 2, probPerPiece: 0.020830, grade: '다' },
    { name: '앰플', label: '앰플 (반/목)', count: 2, probPerPiece: 0.020830, grade: '다' },
    { name: '시균', label: '시균 (반/목)', count: 2, probPerPiece: 0.020830, grade: '다' },
    { name: '발굴', label: '발굴 (반/목)', count: 2, probPerPiece: 0.020830, grade: '다' },
    { name: '하경', label: '하경 (반/목)', count: 2, probPerPiece: 0.020830, grade: '다' },
    { name: '하레', label: '하레 (반/목)', count: 2, probPerPiece: 0.020830, grade: '다' }
];

// 3. 기대치 및 통계 산출
const computeGachaStats = (type) => {
    const isGold = type === 'gold';
    const grade = isGold ? '금' : '다';
    const config = isGold ? GACHA_GOLD_CONFIG : GACHA_DIA_CONFIG;

    const galgalSpot = getAccSpotPrice('갈갈', grade);
    const pieceCost = galgalSpot > 0 ? (galgalSpot / 18) : 0;
    const pullCost = pieceCost * 99;

    let valuableProbSum = 0;
    const items = [];

    for (const conf of config) {
        const spot = getAccSpotPrice(conf.name, grade);
        const totalProb = conf.count * conf.probPerPiece;
        valuableProbSum += totalProb;
        const evCont = spot * totalProb;
        const profit = spot - pullCost;
        const roi = pullCost > 0 ? (profit / pullCost) * 100 : 0;

        items.push({
            name: conf.name,
            label: conf.label,
            count: conf.count,
            probPerPiece: conf.probPerPiece,
            totalProb: totalProb,
            spotPrice: spot,
            evContribution: evCont,
            profit: profit,
            roi: roi,
            isGalgal: false
        });
    }

    const galgalProb = Math.max(0, 1.0 - valuableProbSum);
    const galgalCount = isGold ? 1 : 20;
    const galgalEV = galgalSpot * galgalProb;
    const galgalProfit = galgalSpot - pullCost;
    const galgalRoi = pullCost > 0 ? (galgalProfit / pullCost) * 100 : 0;

    items.push({
        name: '갈갈',
        label: isGold ? '기타 꽝(갈갈)' : '기타 20종(갈갈)',
        count: galgalCount,
        probPerPiece: isGold ? galgalProb : galgalProb / galgalCount,
        totalProb: galgalProb,
        spotPrice: galgalSpot,
        evContribution: galgalEV,
        profit: galgalProfit,
        roi: galgalRoi,
        isGalgal: true
    });

    items.sort((a, b) => b.spotPrice - a.spotPrice);

    let cumProb = 0;
    for (const it of items) {
        it.cumStart = cumProb;
        cumProb += it.totalProb;
        it.cumEnd = Math.min(1.0, cumProb);
    }

    const totalEV = items.reduce((sum, it) => sum + it.evContribution, 0);
    const netProfit = totalEV - pullCost;
    const avgRoi = pullCost > 0 ? (netProfit / pullCost) * 100 : 0;

    const bepProb = items
        .filter(it => it.profit >= 0)
        .reduce((sum, it) => sum + it.totalProb, 0);

    return {
        type,
        grade,
        galgalSpot,
        pieceCost,
        pullCost,
        items,
        totalEV,
        netProfit,
        avgRoi,
        bepProb
    };
};

// 4. Chart.js 데이터셋 생성
const buildGachaChartData = (stats, metric) => {
    const isProfit = metric === 'profit';
    const pts = [];

    for (const it of stats.items) {
        const yVal = isProfit ? it.profit : it.roi;
        const xStart = it.cumStart * 100;
        const xEnd = it.cumEnd * 100;

        pts.push({
            x: xStart,
            y: yVal,
            item: it.label,
            spotPrice: it.spotPrice,
            profit: it.profit,
            roi: it.roi,
            prob: it.totalProb * 100
        });

        pts.push({
            x: xEnd,
            y: yVal,
            item: it.label,
            spotPrice: it.spotPrice,
            profit: it.profit,
            roi: it.roi,
            prob: it.totalProb * 100
        });
    }

    return pts;
};

// 5. 차트 렌더링
const renderGachaChart = (stats) => {
    const canvas = document.getElementById('gacha-curve-chart');
    if (!canvas) return;

    if (gachaChartInstance) {
        try {
            gachaChartInstance.destroy();
        } catch (e) {}
        gachaChartInstance = null;
    }

    const isProfit = currentGachaMetric === 'profit';
    const curvePoints = buildGachaChartData(stats, currentGachaMetric);
    const evY = isProfit ? stats.netProfit : stats.avgRoi;

    const ctx = canvas.getContext('2d');
    gachaChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: isProfit ? '손익 백분위 곡선 (억)' : '수익률 백분위 곡선 (%)',
                    data: curvePoints,
                    borderColor: '#2563eb',
                    fill: {
                        target: 'origin',
                        above: 'rgba(16, 185, 129, 0.16)',
                        below: 'rgba(239, 68, 68, 0.14)'
                    },
                    tension: 0,
                    borderWidth: 2.5,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHitRadius: 10
                },
                {
                    label: '본전선 (0선)',
                    data: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
                    borderColor: '#10b981',
                    borderWidth: 2,
                    borderDash: [6, 4],
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: `평균 기대손익 (${evY >= 0 ? '+' : ''}${evY.toFixed(1)}${isProfit ? '억' : '%'})`,
                    data: [{ x: 0, y: evY }, { x: 100, y: evY }],
                    borderColor: '#ef4444',
                    borderWidth: 2,
                    borderDash: [4, 4],
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            scales: {
                x: {
                    type: 'linear',
                    min: 0,
                    max: 100,
                    title: {
                        display: true,
                        text: '결과의 좋은 정도 (상위 백분위 %)',
                        font: { size: 11, weight: 'bold' },
                        color: '#6b7280'
                    },
                    ticks: {
                        callback: (val) => `${val}%`,
                        font: { size: 10 },
                        color: '#9ca3af'
                    },
                    grid: {
                        color: 'rgba(229, 231, 235, 0.6)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: isProfit ? '1회당 순수익 (억 단위)' : '1회당 수익률 (%)',
                        font: { size: 11, weight: 'bold' },
                        color: '#6b7280'
                    },
                    ticks: {
                        callback: (val) => isProfit
                            ? `${val > 0 ? '+' : ''}${Math.round(val).toLocaleString()}억`
                            : `${val > 0 ? '+' : ''}${Math.round(val)}%`,
                        font: { size: 10 },
                        color: '#9ca3af'
                    },
                    grid: {
                        color: (c) => c.tick.value === 0 ? 'rgba(16, 185, 129, 0.5)' : 'rgba(229, 231, 235, 0.6)',
                        lineWidth: (c) => c.tick.value === 0 ? 1.5 : 1
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        boxWidth: 14,
                        font: { size: 11, weight: '600' },
                        color: '#4b5563',
                        padding: 12
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    titleFont: { size: 12, weight: 'bold' },
                    bodyFont: { size: 11 },
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        title: (items) => {
                            const pt = items[0]?.raw;
                            if (!pt) return '';
                            return `상위 ${pt.x.toFixed(2)}% 구간`;
                        },
                        label: (item) => {
                            const pt = item.raw;
                            if (item.datasetIndex === 0) {
                                return [
                                    `결과 품목: ${pt.item || ''}`,
                                    `최신 시세: ${pt.spotPrice ? pt.spotPrice.toLocaleString() + '억' : '-'}`,
                                    `1회 순수익: ${pt.profit > 0 ? '+' : ''}${pt.profit.toFixed(1)}억`,
                                    `1회 수익률: ${pt.roi > 0 ? '+' : ''}${pt.roi.toFixed(1)}%`
                                ];
                            } else if (item.datasetIndex === 1) {
                                return `본전선 (순수익 0억 / 0.0%)`;
                            } else {
                                return `평균 기대손익: ${evY > 0 ? '+' : ''}${evY.toFixed(1)}${isProfit ? '억' : '%'}`;
                            }
                        }
                    }
                }
            }
        }
    });
};

// 6. 전체 UI 렌더링
const renderGachaEVSection = () => {
    const container = document.getElementById('gacha-ev-section');
    if (!container) return;

    // 1. 장비 탭에서는 완전히 숨김 (노출 안 됨)
    if (currentCategory === 'equip') {
        container.classList.add('hidden');
        container.innerHTML = '';
        if (gachaChartInstance) {
            try { gachaChartInstance.destroy(); } catch (e) {}
            gachaChartInstance = null;
        }
        return;
    }

    // 액세서리 탭에서는 컨테이너 표시
    container.classList.remove('hidden');

    if (!RAW_LINES || RAW_LINES.length === 0 || !ITEM_INDEX['acc']) {
        container.innerHTML = '';
        return;
    }

    // 2. 닫혀 있는 상태: 메인화면 상단에 배치하지 않고 숨김 (왼쪽 더보기 메뉴를 통해 진입)
    if (!isGachaMainOpen) {
        container.classList.add('hidden');
        container.innerHTML = '';
        if (gachaChartInstance) {
            try { gachaChartInstance.destroy(); } catch (e) {}
            gachaChartInstance = null;
        }
        return;
    }

    // 3. 열려 있는 상태: 전체 분석 카드 + Chart.js 곡선 + 상세표 + 상단 '접기' 버튼
    const isGold = currentGachaType === 'gold';
    const stats = computeGachaStats(currentGachaType);

    container.innerHTML = `
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-6 mb-6">
            <!-- Header & Tabs & Close Button -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
                <div>
                    <div class="flex items-center gap-2">
                        
                        <h2 class="text-base sm:text-lg font-bold text-gray-900">도박(금도 · 다도) 기대수익 및 손익 백분위 곡선</h2>
                        <span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">실시간 연동</span>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">
                        갈갈 및 액세서리 최신 적정 시세 자동 반영 (1회 비용 = 갈갈 시세 ÷ 18 × 99)
                    </p>
                </div>

                <!-- Mode Controls & Fold Button -->
                <div class="flex flex-wrap items-center gap-2">
                    <!-- Gacha Switcher -->
                    <div class="flex bg-gray-100 p-1 rounded-xl">
                        <button id="btn-gacha-gold" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${isGold ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}">
                            금도 (금조각 99)
                        </button>
                        <button id="btn-gacha-dia" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${!isGold ? 'bg-cyan-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}">
                            다도 (다조각 99)
                        </button>
                    </div>

                    <!-- Metric Switcher -->
                    <div class="flex bg-gray-100 p-1 rounded-xl">
                        <button id="btn-metric-profit" class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${currentGachaMetric === 'profit' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}">
                            순수익 (억)
                        </button>
                        <button id="btn-metric-roi" class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${currentGachaMetric === 'roi' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}">
                            수익률 (%)
                        </button>
                    </div>

                    <!-- Fold (Close) Button -->
                    <button id="btn-close-gacha-main" class="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition cursor-pointer">
                        <span>접기</span>
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- KPI Summary Cards -->
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 my-4">
                <!-- 1회 비용 -->
                <div class="bg-gray-50/70 border border-gray-100 rounded-xl p-3 sm:p-3.5">
                    <div class="text-[11px] font-medium text-gray-500">1회 뽑기 비용 (조각 99개)</div>
                    <div class="text-lg sm:text-xl font-extrabold text-gray-900 mt-0.5">
                        ${stats.pullCost.toFixed(1)}억
                    </div>
                    <div class="text-[10px] text-gray-400 mt-1 truncate">
                        갈갈 ${stats.galgalSpot.toFixed(1)}억 (개당 ${(stats.galgalSpot / 18).toFixed(2)}억)
                    </div>
                </div>

                <!-- 1회 기대가 -->
                <div class="bg-gray-50/70 border border-gray-100 rounded-xl p-3 sm:p-3.5">
                    <div class="text-[11px] font-medium text-gray-500">1회 기대 획득가 (EV)</div>
                    <div class="text-lg sm:text-xl font-extrabold text-blue-600 mt-0.5">
                        ${stats.totalEV.toFixed(1)}억
                    </div>
                    <div class="text-[10px] text-gray-400 mt-1">
                        전 품목 확률 가중 기대값
                    </div>
                </div>

                <!-- 1회 기대손익 -->
                <div class="bg-gray-50/70 border border-gray-100 rounded-xl p-3 sm:p-3.5">
                    <div class="text-[11px] font-medium text-gray-500">1회 평균 손익 · 수익률</div>
                    <div class="text-lg sm:text-xl font-extrabold ${stats.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'} mt-0.5">
                        ${stats.netProfit >= 0 ? '+' : ''}${stats.netProfit.toFixed(1)}억
                        <span class="text-xs sm:text-sm font-semibold">(${stats.avgRoi >= 0 ? '+' : ''}${stats.avgRoi.toFixed(1)}%)</span>
                    </div>
                    <div class="text-[10px] ${stats.netProfit >= 0 ? 'text-emerald-500' : 'text-rose-400'} mt-1">
                        ${stats.netProfit >= 0 ? '평균 수익 기대' : '1회당 평균 손실'}
                    </div>
                </div>

                <!-- 본전 승률 -->
                <div class="bg-gray-50/70 border border-gray-100 rounded-xl p-3 sm:p-3.5">
                    <div class="text-[11px] font-medium text-gray-500">본전 이상 확률 (승률)</div>
                    <div class="text-lg sm:text-xl font-extrabold text-indigo-600 mt-0.5">
                        상위 ${(stats.bepProb * 100).toFixed(1)}%
                    </div>
                    <div class="text-[10px] text-gray-400 mt-1">
                        하위 ${(100 - stats.bepProb * 100).toFixed(1)}%는 비용 미만 손실
                    </div>
                </div>
            </div>

            <!-- Chart Section -->
            <div class="mt-4 pt-4 border-t border-gray-100">
                <div class="flex items-center justify-between mb-2">
                    <div class="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                        <span>결과 좋은 정도(상위 %)에 따른 손익 백분위 곡선</span>
                    </div>
                    <span class="text-[10px] text-gray-400">마우스 호버/터치 시 상세 정보</span>
                </div>
                <div class="relative w-full h-[260px] sm:h-[300px]">
                    <canvas id="gacha-curve-chart"></canvas>
                </div>
            </div>

            <!-- Table Toggle -->
            <div class="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                <button id="btn-toggle-gacha-table" class="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition cursor-pointer">
                    <span id="btn-toggle-gacha-table-text">
                        ${isGachaTableExpanded ? '▲ 전 품목 출현 확률 및 기대치 상세표 접기' : '▼ 전 품목 출현 확률 및 기대치 상세표 보기 (' + stats.items.length + '개 항목)'}
                    </span>
                </button>
                <span class="text-[10px] text-gray-400">정렬: 시세 높은 순</span>
            </div>

            <!-- Detailed Table Container -->
            <div id="gacha-table-container" class="${isGachaTableExpanded ? '' : 'hidden'} mt-3 overflow-x-auto">
                <table class="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr class="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                            <th class="py-2.5 px-3">품목 (옵션)</th>
                            <th class="py-2.5 px-2 text-center">피스 구성</th>
                            <th class="py-2.5 px-2 text-right">개당 확률</th>
                            <th class="py-2.5 px-2 text-right">합산 확률</th>
                            <th class="py-2.5 px-3 text-center">상위 백분위 구간</th>
                            <th class="py-2.5 px-3 text-right">최신 적정 시세</th>
                            <th class="py-2.5 px-3 text-right">1회 기여 기대가</th>
                            <th class="py-2.5 px-3 text-right">1회 순손익</th>
                            <th class="py-2.5 px-3 text-right">1회 수익률</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        ${stats.items.map(it => `
                            <tr class="${it.isGalgal ? 'bg-gray-50/70 text-gray-500' : 'hover:bg-blue-50/40 transition'}">
                                <td class="py-2 px-3 font-medium text-gray-900 flex items-center gap-1.5">
                                    
                                    <span>${it.label}</span>
                                </td>
                                <td class="py-2 px-2 text-center text-gray-500">
                                    ${it.isGalgal ? (isGold ? '나머지 꽝' : '20개 품목') : (it.count === 2 ? '반지+목걸이' : it.count + '개')}
                                </td>
                                <td class="py-2 px-2 text-right text-gray-600 font-mono">
                                    ${(it.probPerPiece * 100).toFixed(4)}%
                                </td>
                                <td class="py-2 px-2 text-right font-bold text-gray-800 font-mono">
                                    ${(it.totalProb * 100).toFixed(4)}%
                                </td>
                                <td class="py-2 px-3 text-center text-[11px] text-gray-500 font-mono">
                                    상위 ${(it.cumStart * 100).toFixed(2)}% ~ ${(it.cumEnd * 100).toFixed(2)}%
                                </td>
                                <td class="py-2 px-3 text-right font-semibold text-gray-900 font-mono">
                                    ${it.spotPrice.toLocaleString()}억
                                </td>
                                <td class="py-2 px-3 text-right font-medium text-blue-600 font-mono">
                                    ${it.evContribution.toFixed(2)}억
                                </td>
                                <td class="py-2 px-3 text-right font-bold font-mono ${it.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
                                    ${it.profit >= 0 ? '+' : ''}${it.profit.toFixed(1)}억
                                </td>
                                <td class="py-2 px-3 text-right font-bold font-mono ${it.roi >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
                                    ${it.roi >= 0 ? '+' : ''}${it.roi.toFixed(1)}%
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot class="bg-gray-50 border-t-2 border-gray-300 font-bold text-gray-900">
                        <tr>
                            <td class="py-2.5 px-3">합계 (${stats.items.length}개 항목)</td>
                            <td class="py-2.5 px-2 text-center text-gray-500">-</td>
                            <td class="py-2.5 px-2 text-right text-gray-500">-</td>
                            <td class="py-2.5 px-2 text-right text-indigo-700 font-mono">100.0000%</td>
                            <td class="py-2.5 px-3 text-center text-gray-500 font-mono">상위 0.00% ~ 100.00%</td>
                            <td class="py-2.5 px-3 text-right text-gray-500">-</td>
                            <td class="py-2.5 px-3 text-right text-blue-700 font-mono">${stats.totalEV.toFixed(2)}억</td>
                            <td class="py-2.5 px-3 text-right font-mono ${stats.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
                                ${stats.netProfit >= 0 ? '+' : ''}${stats.netProfit.toFixed(1)}억
                            </td>
                            <td class="py-2.5 px-3 text-right font-mono ${stats.avgRoi >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
                                ${stats.avgRoi >= 0 ? '+' : ''}${stats.avgRoi.toFixed(1)}%
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    `;

    // Event Listeners
    document.getElementById('btn-close-gacha-main')?.addEventListener('click', () => {
        isGachaMainOpen = false;
        renderFilters();
        renderGachaEVSection();
    });

    document.getElementById('btn-gacha-gold')?.addEventListener('click', () => {
        currentGachaType = 'gold';
        renderGachaEVSection();
    });

    document.getElementById('btn-gacha-dia')?.addEventListener('click', () => {
        currentGachaType = 'dia';
        renderGachaEVSection();
    });

    document.getElementById('btn-metric-profit')?.addEventListener('click', () => {
        currentGachaMetric = 'profit';
        renderGachaEVSection();
    });

    document.getElementById('btn-metric-roi')?.addEventListener('click', () => {
        currentGachaMetric = 'roi';
        renderGachaEVSection();
    });

    document.getElementById('btn-toggle-gacha-table')?.addEventListener('click', () => {
        isGachaTableExpanded = !isGachaTableExpanded;
        const tbl = document.getElementById('gacha-table-container');
        const txt = document.getElementById('btn-toggle-gacha-table-text');
        if (tbl) {
            tbl.classList.toggle('hidden', !isGachaTableExpanded);
        }
        if (txt) {
            txt.textContent = isGachaTableExpanded
                ? '▲ 전 품목 출현 확률 및 기대치 상세표 접기'
                : '▼ 전 품목 출현 확률 및 기대치 상세표 보기 (' + stats.items.length + '개 항목)';
        }
    });

    // Draw Chart
    renderGachaChart(stats);
};


// ============================================================================
// 7. 의상 체력(HP) · 기술(Tech) 상승 비용 및 가성비 비교 분석기 (표 열거 방식)
// ============================================================================
let isClothesUpgradeOpen = false; // 기본값: 닫힘 (왼쪽 더보기를 눌러 열기)
let currentUpgradeStatType = 'hp'; // 'hp' | 'tech'
let currentUpgradePart = 'all';    // 'all' | '모자' | '상의' | '하의'
let selectedUpgradeRefRowMap = {}; // key: `${statType}__${part}` -> rowKey (행 클릭 시 지정 장비 기준 비교용)

const getDefaultUpgradeStartConfig = (part, statType) => {
    if (part === '모자') {
        return { itemName: '일팬모', enc: 7, optGroup: '무/잡' };
    }
    if (part === '상의') {
        return statType === 'hp'
            ? { itemName: '체팬상', enc: 7, optGroup: '무/잡' }
            : { itemName: '기팬상', enc: 7, optGroup: '무/잡' };
    }
    return statType === 'hp'
        ? { itemName: '체팬하', enc: 7, optGroup: '무/잡' }
        : { itemName: '기팬하', enc: 7, optGroup: '무/잡' };
};

const getClothesOptionStatBonus = (optGroup, enc, statType) => {
    if (statType === 'hp') {
        if (optGroup === '추체') return enc === 10 ? 60 : (enc === 9 ? 30 : 15);
        if (optGroup === '향추체') return enc === 10 ? 100 : (enc === 9 ? 45 : 20);
        return 0;
    } else {
        if (optGroup === '추기') return enc === 10 ? 20 : (enc === 9 ? 10 : 5);
        if (optGroup === '향추기') return enc === 10 ? 30 : (enc === 9 ? 15 : 7);
        return 0;
    }
};

const getCombinedMuJapSpotPrice = (processedItem, cellKey) => {
    if (!processedItem || !processedItem.variants) return { price: 0, count: 0 };
    if (!processedItem._muJapSpotCache) processedItem._muJapSpotCache = {};
    if (processedItem._muJapSpotCache[cellKey]) return processedItem._muJapSpotCache[cellKey];

    const getRawMuJapHistory = (targetCellKey) => {
        const history = [];
        const seenLineIdx = new Set();
        ['무', '잡'].forEach(optKey => {
            const v = (processedItem.allVariantsRaw && processedItem.allVariantsRaw[optKey]) || processedItem.variants[optKey];
            const cell = v?.rawMatrixAll?.[targetCellKey] || v?.matrix?.[targetCellKey];
            if (cell && Array.isArray(cell.history)) {
                cell.history.forEach(h => {
                    const lineKey = h.rawLineIdx !== undefined ? h.rawLineIdx : `${h.isoDate?.getTime()}_${h.price}`;
                    if (!seenLineIdx.has(lineKey)) {
                        seenLineIdx.add(lineKey);
                        history.push(h);
                    }
                });
            }
        });
        history.sort((a, b) => (a.isoDate - b.isoDate) || ((a.rawLineIdx || 0) - (b.rawLineIdx || 0)));
        return history;
    };

    const combinedHistory = getRawMuJapHistory(cellKey);
    if (combinedHistory.length < 3) {
        const res = { price: 0, count: combinedHistory.length };
        processedItem._muJapSpotCache[cellKey] = res;
        return res;
    }

    const analysis = computeMarketAnalysis(combinedHistory);
    const spot = analysis ? Number(analysis.spotFair.toFixed(2)) : Number(combinedHistory[combinedHistory.length - 1].price.toFixed(2));
    const res = { price: spot, count: combinedHistory.length };
    processedItem._muJapSpotCache[cellKey] = res;

    // 7_7 또는 8_8 시세 계산 시 가격 역전(8강이 7강보다 더 싼 경우) 발생 검사 및 표본 병합
    if (cellKey === '7_7' || cellKey === '8_8') {
        const otherKey = cellKey === '7_7' ? '8_8' : '7_7';
        if (processedItem._muJapSpotCache[otherKey]) {
            const info7 = cellKey === '7_7' ? res : processedItem._muJapSpotCache['7_7'];
            const info8 = cellKey === '8_8' ? res : processedItem._muJapSpotCache['8_8'];
            if (info7.price > 0 && info8.price > 0 && info8.price < info7.price) {
                const hist7 = getRawMuJapHistory('7_7');
                const hist8 = getRawMuJapHistory('8_8');
                const merged = [];
                const seen = new Set();
                [...hist7, ...hist8].forEach(h => {
                    const k = h.rawLineIdx !== undefined ? h.rawLineIdx : `${h.isoDate?.getTime()}_${h.price}`;
                    if (!seen.has(k)) {
                        seen.add(k);
                        merged.push(h);
                    }
                });
                merged.sort((a, b) => (a.isoDate - b.isoDate) || ((a.rawLineIdx || 0) - (b.rawLineIdx || 0)));
                const mergedAnalysis = computeMarketAnalysis(merged);
                const mergedSpot = mergedAnalysis ? Number(mergedAnalysis.spotFair.toFixed(2)) : Number(merged[merged.length - 1].price.toFixed(2));
                const mergedRes = { price: mergedSpot, count: merged.length };
                processedItem._muJapSpotCache['7_7'] = mergedRes;
                processedItem._muJapSpotCache['8_8'] = mergedRes;
                return mergedRes;
            }
        }
    }

    return res;
};

/**
 * 사전 계산된 window.PRECOMPUTED_WEB_STATS가 있으면 즉시(0ms) 반환하고,
 * 없을 때만 런타임에 계산합니다.
 */
const computeClothesStepTable = (part, statType) => {
    if (
        window.PRECOMPUTED_WEB_STATS &&
        window.PRECOMPUTED_WEB_STATS.clothesStepTables &&
        window.PRECOMPUTED_WEB_STATS.clothesStepTables[statType] &&
        Array.isArray(window.PRECOMPUTED_WEB_STATS.clothesStepTables[statType][part])
    ) {
        return window.PRECOMPUTED_WEB_STATS.clothesStepTables[statType][part];
    }

    const equipIndex = ITEM_INDEX['equip'] || {};
    const startCfg = getDefaultUpgradeStartConfig(part, statType);
    const startMeta = getEquipMeta(startCfg.itemName);
    const startBase = getEquipBaseStats(startCfg.itemName, startMeta);
    const startStatVal = (startBase ? startBase[statType] : 0) + (ENHANCE_ADD_STATS.clothes[statType][startCfg.enc] || 0);

    const allCandidates = [];
    const visitedCanonical = new Set();

    Object.keys(equipIndex).forEach(rawItemName => {
        const meta = getEquipMeta(rawItemName);
        if (!meta || meta.part !== part) return;

        const partnerKey = getEquipPartnerKey(meta.key);
        if (meta.isSturdy && meta.key.startsWith('튼') && partnerKey && equipIndex[partnerKey]) {
            return;
        }
        if (visitedCanonical.has(meta.key)) return;
        visitedCanonical.add(meta.key);

        const base = getEquipBaseStats(meta.key, meta);
        if (!base || (base.hp === undefined && base.tech === undefined)) return;
        if ((base[statType] || 0) <= 0) return;

        const processed = processItemOnDemand('equip', meta.key);
        if (!processed || !processed.variants) return;

        const targetOptGroups = statType === 'hp'
            ? ['무/잡', '추체', '향추체']
            : ['무/잡', '추기', '향추기'];

        for (const enc of [7, 8, 9, 10]) {
            const cellKey = `${enc}_${enc}`;
            const baseStatVal = base[statType] || 0;
            const enhStatVal = ENHANCE_ADD_STATS.clothes[statType][enc] || 0;

            for (const optGroup of targetOptGroups) {
                let spotInfo = null;
                if (optGroup === '무/잡') {
                    spotInfo = getCombinedMuJapSpotPrice(processed, cellKey);
                } else {
                    const v = processed.variants[optGroup];
                    spotInfo = v ? getVariantCellSpotPrice(v, cellKey, false) : null;
                }

                if (!spotInfo || spotInfo.price <= 0 || spotInfo.count < 3) continue;

                const optStatVal = getClothesOptionStatBonus(optGroup, enc, statType);
                const totalStat = baseStatVal + enhStatVal + optStatVal;

                if (totalStat < startStatVal) continue;

                allCandidates.push({
                    rowKey: `${meta.key}__${enc}__${optGroup}`,
                    part,
                    level: meta.level,
                    itemName: meta.key,
                    officialName: meta.officialName,
                    enc,
                    nmName: `${enc}/${enc} ${meta.key}`,
                    optGroup,
                    baseStatVal,
                    enhStatVal,
                    optStatVal,
                    totalStat,
                    spotPrice: spotInfo.price,
                    tradeCount: spotInfo.count
                });
            }
        }
    });

    if (allCandidates.length === 0) return [];

    const startRowKey = `${startCfg.itemName}__${startCfg.enc}__${startCfg.optGroup}`;
    let current = allCandidates.find(c => c.rowKey === startRowKey);
    if (!current) {
        allCandidates.sort((a, b) => (a.totalStat - b.totalStat) || (a.spotPrice - b.spotPrice));
        current = allCandidates[0];
    }

    const selectedRows = [
        {
            ...current,
            isStart: true,
            prevStatDiff: 0,
            prevCostDiff: 0,
            costPerStat: 0
        }
    ];

    while (true) {
        const higherCandidates = allCandidates.filter(c => c.totalStat > current.totalStat);
        if (higherCandidates.length === 0) break;

        higherCandidates.sort((a, b) => {
            if (a.totalStat !== b.totalStat) return a.totalStat - b.totalStat;
            return a.spotPrice - b.spotPrice;
        });

        const nextItem = higherCandidates[0];
        const prevStatDiff = nextItem.totalStat - current.totalStat;
        const prevCostDiff = nextItem.spotPrice - current.spotPrice;
        const costPerStat = prevStatDiff > 0 ? (prevCostDiff / prevStatDiff) : 0;

        selectedRows.push({
            ...nextItem,
            isStart: false,
            prevStatDiff,
            prevCostDiff,
            costPerStat
        });

        current = nextItem;
    }

    return selectedRows;
};

const renderSinglePartTableHtml = (part, statType) => {
    const statName = statType === 'hp' ? '체력' : '기술';
    const rows = computeClothesStepTable(part, statType);
    const startCfg = getDefaultUpgradeStartConfig(part, statType);

    if (rows.length === 0) {
        return `<div class="p-4 text-center text-xs text-gray-500">${part} 데이터가 없습니다.</div>`;
    }

    const refMapKey = `${statType}__${part}`;
    const activeRefKey = selectedUpgradeRefRowMap[refMapKey] || null;
    const refRow = activeRefKey ? rows.find(r => r.rowKey === activeRefKey) : null;
    const isRefMode = Boolean(refRow);

    const colHeader6 = isRefMode ? '지정 장비대비 변동' : '전단계 대비 상승';
    const colHeader7 = isRefMode ? '가격차' : '추가 소요 골드';
    const colHeader8 = isRefMode ? `${statName}당 소요골드` : `추가 ${statName}당 소요 골드`;

    return `
        <div class="mb-6 last:mb-0">
            <div class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-gray-100/80 rounded-t-xl border border-b-0 border-gray-200">
                <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded bg-indigo-600 text-white text-xs font-extrabold">${part}</span>
                    <span class="text-xs font-extrabold text-gray-800">${part} ${statName} 단계별 상승 및 소요 골드 표</span>
                </div>
                <div class="text-[11px] text-gray-500 font-semibold">
                    ${isRefMode
                        ? `<span class="text-indigo-700 font-bold">지정 기준 장비: ${refRow.nmName} (${refRow.optGroup}) — 다시 누르면 원래 화면으로 복귀</span>`
                        : `행의 빈 공간을 누르면 해당 장비 기준으로 비교합니다 (장비명 클릭 시 상세창)`}
                </div>
            </div>
            <div class="overflow-x-auto border border-gray-200 rounded-b-xl">
                <table class="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr class="bg-gray-50 border-b border-gray-200 text-gray-700 font-extrabold">
                            <th class="py-2.5 px-3 text-center whitespace-nowrap">구분</th>
                            <th class="py-2.5 px-3 text-center whitespace-nowrap">레벨 제한</th>
                            <th class="py-2.5 px-3 whitespace-nowrap">장비 종류</th>
                            <th class="py-2.5 px-3 text-center whitespace-nowrap">옵션</th>
                            <th class="py-2.5 px-3 text-right whitespace-nowrap">장비 제공 ${statName}</th>
                            <th class="py-2.5 px-3 text-right whitespace-nowrap">${colHeader6}</th>
                            <th class="py-2.5 px-3 text-right whitespace-nowrap">${colHeader7}</th>
                            <th class="py-2.5 px-3 text-right whitespace-nowrap">${colHeader8}</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                        ${rows.map(r => {
                            const optBadge = r.optGroup === '무/잡'
                                ? `<span class="px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-bold">무/잡</span>`
                                : (r.optGroup.startsWith('향')
                                    ? `<span class="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-extrabold">${r.optGroup}</span>`
                                    : `<span class="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">${r.optGroup}</span>`);

                            let statDiffHtml = '';
                            let goldDiffHtml = '';
                            let perStatGoldHtml = '';
                            let trClass = '';

                            if (isRefMode) {
                                const isThisRef = r.rowKey === refRow.rowKey;
                                const diffStat = r.totalStat - refRow.totalStat;
                                const diffPrice = r.spotPrice - refRow.spotPrice;
                                const perStat = diffStat !== 0 ? (diffPrice / Math.abs(diffStat)) : 0;

                                trClass = isThisRef
                                    ? 'bg-indigo-100/70 font-semibold ring-1 ring-inset ring-indigo-400'
                                    : 'hover:bg-gray-50';

                                if (isThisRef) {
                                    statDiffHtml = `<span class="text-indigo-700 font-bold">기준 (0)</span>`;
                                    goldDiffHtml = `<span class="text-indigo-700 font-bold">기준 (${r.spotPrice.toFixed(1)}억)</span>`;
                                    perStatGoldHtml = `<span class="text-gray-400 font-bold">-</span>`;
                                } else {
                                    const statDiffColor = diffStat > 0 ? 'text-emerald-600' : (diffStat < 0 ? 'text-rose-600' : 'text-gray-400');
                                    statDiffHtml = `<span class="${statDiffColor} font-extrabold">${diffStat > 0 ? '+' : ''}${diffStat}</span>`;

                                    const goldDiffColor = diffPrice >= 0 ? 'text-gray-900' : 'text-emerald-600';
                                    goldDiffHtml = `<span class="font-bold ${goldDiffColor}">${diffPrice >= 0 ? '+' : ''}${diffPrice.toFixed(1)}억</span> <span class="text-[10px] text-gray-400 font-normal">(${r.spotPrice.toFixed(1)}억)</span>`;

                                    const perStatColor = perStat >= 0 ? 'text-rose-600' : 'text-emerald-600';
                                    perStatGoldHtml = `<span class="font-extrabold ${perStatColor}">${perStat.toFixed(2)}억</span>`;
                                }
                            } else {
                                trClass = r.isStart ? 'bg-indigo-50/60 font-semibold' : 'hover:bg-gray-50';

                                statDiffHtml = r.isStart
                                    ? `<span class="text-gray-400">-</span>`
                                    : `<span class="text-emerald-600 font-extrabold">+${r.prevStatDiff}</span>`;

                                goldDiffHtml = r.isStart
                                    ? `<span class="text-indigo-700 font-bold">기준 (${r.spotPrice.toFixed(1)}억)</span>`
                                    : `<span class="font-bold ${r.prevCostDiff >= 0 ? 'text-gray-900' : 'text-emerald-600'}">${r.prevCostDiff >= 0 ? '+' : ''}${r.prevCostDiff.toFixed(1)}억</span> <span class="text-[10px] text-gray-400 font-normal">(${r.spotPrice.toFixed(1)}억)</span>`;

                                perStatGoldHtml = r.isStart
                                    ? `<span class="text-gray-400 font-bold">-</span>`
                                    : `<span class="font-extrabold ${r.costPerStat >= 0 ? 'text-rose-600' : 'text-emerald-600'}">${r.costPerStat.toFixed(2)}억</span>`;
                            }

                            return `
                                <tr data-ref-part="${part}" data-ref-rowkey="${r.rowKey}" class="upg-Selectable-row ${trClass} transition cursor-pointer">
                                    <td class="py-2 px-3 text-center font-bold text-gray-700 whitespace-nowrap">${r.part}</td>
                                    <td class="py-2 px-3 text-center font-mono text-gray-600 whitespace-nowrap">${r.level}</td>
                                    <td class="py-2 px-3 font-extrabold text-gray-900 whitespace-nowrap">
                                        <button type="button" data-open-equip="${r.itemName}" class="btn-upg-open-modal hover:text-blue-600 hover:underline cursor-pointer text-left">
                                            ${r.nmName}
                                        </button>
                                    </td>
                                    <td class="py-2 px-3 text-center whitespace-nowrap">${optBadge}</td>
                                    <td class="py-2 px-3 text-right font-mono font-black text-rose-600 whitespace-nowrap">
                                        ${r.totalStat}
                                    </td>
                                    <td class="py-2 px-3 text-right font-mono whitespace-nowrap">
                                        ${statDiffHtml}
                                    </td>
                                    <td class="py-2 px-3 text-right font-mono whitespace-nowrap">
                                        ${goldDiffHtml}
                                    </td>
                                    <td class="py-2 px-3 text-right font-mono whitespace-nowrap">
                                        ${perStatGoldHtml}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
};

const renderClothesUpgradeSection = () => {
    const container = document.getElementById('clothes-upgrade-section');
    if (!container) return;

    if (currentCategory !== 'equip' || !isClothesUpgradeOpen) {
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
    }

    if (!RAW_LINES || RAW_LINES.length === 0 || !ITEM_INDEX['equip']) {
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
    }

    container.classList.remove('hidden');

    const isHp = currentUpgradeStatType === 'hp';
    const statName = isHp ? '체력' : '기술';
    const partsToRender = currentUpgradePart === 'all' ? ['모자', '상의', '하의'] : [currentUpgradePart];

    container.innerHTML = `
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 md:p-6 mb-6">
            <!-- 상단 헤더 & 컨트롤 바 -->
            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-gray-100 mb-4">
                <div>
                    <div class="flex flex-wrap items-center gap-2">
                        <h2 class="text-base sm:text-lg font-extrabold text-gray-900">의상 ${statName} 단계별 상승 비용 표</h2>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">
                        장비별 스탯 상승량과 소요 골드를 열거합니다
                    </p>
                </div>

                <!-- 스탯 / 부위 / 닫기 컨트롤 -->
                <div class="flex flex-wrap items-center gap-2">
                    <!-- 체력 vs 기술 스위치 (동일하게 빨강 계열 활성 스타일 적용) -->
                    <div class="flex bg-gray-100 p-1 rounded-xl">
                        <button type="button" id="btn-upg-stat-hp" class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${isHp ? 'bg-rose-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}">
                            체력 상승 표
                        </button>
                        <button type="button" id="btn-upg-stat-tech" class="px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${!isHp ? 'bg-rose-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}">
                            기술 상승 표
                        </button>
                    </div>

                    <!-- 부위 스위치 (전체 / 모자 / 상의 / 하의) -->
                    <div class="flex bg-gray-100 p-1 rounded-xl">
                        ${[
                            { k: 'all', l: '전체 부위' },
                            { k: '모자', l: '모자' },
                            { k: '상의', l: '상의' },
                            { k: '하의', l: '하의' }
                        ].map(p => `
                            <button type="button" data-upg-part="${p.k}" class="btn-upg-part px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${currentUpgradePart === p.k ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}">
                                ${p.l}
                            </button>
                        `).join('')}
                    </div>

                    <!-- 닫기 버튼 -->
                    <button type="button" id="btn-close-clothes-upgrade" class="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition cursor-pointer">
                        <span>닫기</span>
                    </button>
                </div>
            </div>

            <!-- 부위별 단계 표 렌더링 -->
            <div>
                ${partsToRender.map(part => renderSinglePartTableHtml(part, currentUpgradeStatType)).join('')}
            </div>
        </div>
    `;

    // 이벤트 바인딩
    document.getElementById('btn-close-clothes-upgrade')?.addEventListener('click', () => {
        isClothesUpgradeOpen = false;
        renderFilters();
        renderClothesUpgradeSection();
    });

    document.getElementById('btn-upg-stat-hp')?.addEventListener('click', () => {
        currentUpgradeStatType = 'hp';
        renderClothesUpgradeSection();
    });

    document.getElementById('btn-upg-stat-tech')?.addEventListener('click', () => {
        currentUpgradeStatType = 'tech';
        renderClothesUpgradeSection();
    });

    container.querySelectorAll('.btn-upg-part').forEach(btn => {
        btn.addEventListener('click', () => {
            currentUpgradePart = btn.dataset.upgPart;
            renderClothesUpgradeSection();
        });
    });

    // 장비명 클릭 시 장비 상세 모달 열기 (행 클릭 이벤트로 전파 차단)
    container.querySelectorAll('.btn-upg-open-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemName = btn.dataset.openEquip;
            const processed = processItemOnDemand('equip', itemName);
            if (processed) openModal(processed);
        });
    });

    // 표의 행 공간 클릭 시 지정 장비 대비 모드로 전환 / 다시 누르면 원래 화면으로 복귀
    container.querySelectorAll('.upg-Selectable-row').forEach(tr => {
        tr.addEventListener('click', () => {
            const part = tr.dataset.refPart;
            const clickedKey = tr.dataset.refRowkey;
            const mapKey = `${currentUpgradeStatType}__${part}`;
            if (selectedUpgradeRefRowMap[mapKey] === clickedKey) {
                delete selectedUpgradeRefRowMap[mapKey];
            } else {
                selectedUpgradeRefRowMap[mapKey] = clickedKey;
            }
            renderClothesUpgradeSection();
        });
    });
};

document.addEventListener('DOMContentLoaded', init);
