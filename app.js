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
let currentCategory = 'equip';
let currentChartRange = 'all';
let currentYScale = 'normal';
let currentChartMode = 'curve'; // 'curve' (시세곡선) | 'compare' (원본비교)
let currentChartData = [];
let currentAnalysis = null;
let priceChart = null;
const HIDE_UNDER_3 = true; // 3개 미만 옵션 노출 안함

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
            matrixContainer: document.getElementById('matrix-container'),
            statPrice: { textContent: '', style: {} }, // Safety stub (Prevent Firefox null-pointer)
            marketSummaryCard: document.getElementById('market-summary-card'),
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
            ITEM_INDEX = buildQuickIndex(RAW_LINES);
            updateLastUpdateUI(RAW_LINES);
            renderFilters();
            renderGrid();
        })
        .catch(() => {
            if (typeof window.FARM_DATA !== 'undefined') {
                RAW_LINES = Array.isArray(window.FARM_DATA) ? window.FARM_DATA : [];
                ITEM_INDEX = buildQuickIndex(RAW_LINES);
                updateLastUpdateUI(RAW_LINES);
                renderFilters();
                renderGrid();
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

// --- QUICK INDEX: 빠른 1차 파싱 (아이템 이름 + 세부 셀 카운트까지 추출) ---
const buildQuickIndex = (lines) => {
    const index = {};
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
            itemName = parts[3].trim();
            const option = parts[4].trim();
            const enc = Math.round(Number(parts[5].trim()));
            const dur = Math.round(Number(parts[6].trim()));
            cellKey = `${option}__${enc}_${dur}`;
        } else if (rawCat === '악세') {
            if (parts.length < 7) continue;
            itemName = parts[5].trim();
            cellKey = parts[4].trim();
        } else if (rawCat === '재료') {
            if (parts.length < 6) continue;
            itemName = parts[3].trim();
            cellKey = parts[4].trim();
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

    // 유효한 셀(5건 이상)이 하나라도 있는지 마킹 (HIDE_UNDER_5 플래그로 제어)
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
    const info = ITEM_INDEX[cat]?.[itemName];
    if (!info) return null;

    const item = {
        id: `${cat}_${itemName}`,
        category: cat,
        name: itemName,
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
            meta: entry
        };

        item.history.push(historyItem);

        let variantKey = "Default";
        if (cat === 'equip') variantKey = entry.option || "노옵션";
        else if (cat === 'acc') variantKey = entry.grade || "일반";
        else if (cat === 'mat') variantKey = entry.grade || "일반";

        if (!item.variants[variantKey]) {
            item.variants[variantKey] = {
                name: variantKey,
                matrix: {},
                history: [],
                count: 0
            };
        }

        const variantNode = item.variants[variantKey];
        variantNode.history.push(historyItem);
        variantNode.count++;

        if (cat === 'equip') {
            const enc = Math.round(Number(entry.enhancement));
            const dur = Math.round(Number(entry.durability));
            const key = `${enc}_${dur}`;
            if (!variantNode.matrix[key]) {
                variantNode.matrix[key] = { price: price, history: [], count: 0 };
            }
            variantNode.matrix[key].history.push(historyItem);
            variantNode.matrix[key].price = price;
            variantNode.matrix[key].count++;
        }
    }

    // No outlier filtering, just sort by date
    item.history.sort((a, b) => a.isoDate - b.isoDate);

    const validVariants = {};
    let hasValidVariant = false;

    Object.entries(item.variants).forEach(([vKey, v]) => {
        if (cat === 'equip') {
            const validMatrix = {};
            let matrixValidCount = 0;

            Object.entries(v.matrix).forEach(([mKey, m]) => {
                m.count = m.history.length;

                if (HIDE_UNDER_3 ? m.count >= 3 : true) {
                    m.history.sort((a, b) => a.isoDate - b.isoDate);
                    if (m.history.length > 0) {
                        m.price = m.history[m.history.length - 1].price;
                    }
                    validMatrix[mKey] = m;
                    matrixValidCount++;
                }
            });

            if (matrixValidCount > 0) {
                v.matrix = validMatrix;
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
        item.variants = validVariants;
        return item;
    }
    return null;
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
            entry.item_name = parts[5];
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
                renderFilters();
                renderGrid();
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

};

// --- SCROLL STATE ---
let visibleLimit = 60;
const BATCH_SIZE = 60;
let observer = null;

const renderFilters = () => {
    if (!elements.dynamicFilters) return;
    elements.dynamicFilters.innerHTML = `
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">검색</label>
            <input type="text" id="search-input" placeholder="이름 검색..." class="w-full bg-white border border-gray-300 text-gray-900 rounded p-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition">
        </div>`;

    const input = document.getElementById('search-input');
    if (input) input.oninput = (e) => {
        visibleLimit = BATCH_SIZE; // Reset scroll
        renderGrid(e.target.value);
    };
};

const renderGrid = (filterText = '') => {
    const grid = elements.grid;
    if (!grid) return;

    // ITEM_INDEX 기반 렌더링 (무거운 처리 없이 이름만 표시)
    const catIndex = ITEM_INDEX[currentCategory] || {};
    let items = Object.entries(catIndex)
        .filter(([name, info]) => info.hasValidCell)
        .map(([name, info]) => ({
            name,
            count: info.count,
            category: currentCategory
        }));

    if (filterText) items = items.filter(item => item.name.includes(filterText));
    items.sort((a, b) => b.count - a.count);

    if (items.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center text-gray-500 py-10">데이터가 없습니다.</div>`;
        return;
    }

    grid.innerHTML = '';
    const visibleItems = items.slice(0, visibleLimit);

    visibleItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl border border-gray-200 p-5 cursor-pointer flex flex-col justify-between hover:border-blue-500 hover:shadow-md transition-all shadow-sm';

        card.innerHTML = `
            <div>
                <h3 class="text-lg font-bold text-gray-900">${item.name}</h3>
            </div>
        `;
        card.onclick = () => {
            // 클릭 시에만 해당 아이템의 상세 데이터를 처리
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

const openModal = (item) => {
    try {
        elements.modalTitle.textContent = item.name;
        elements.modalSubtitle.textContent = item.category === 'equip' ? '옵션 선택' : '등급 선택';

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
    elements.modalSubtitle.textContent = item.category === 'equip' ? '옵션 선택' : '등급 선택';

    const container = elements.matrixContainer;
    container.innerHTML = '';

    const variants = Object.values(item.variants).sort((a, b) => b.count - a.count);

    const list = document.createElement('div');
    list.className = "grid grid-cols-2 gap-3 p-2";

    variants.forEach(v => {
        const btn = document.createElement('button');
        btn.className = "p-3 bg-white hover:bg-blue-50 rounded shadow-sm text-left border border-gray-200 hover:border-blue-300 flex justify-between items-center transition";
        btn.innerHTML = `
            <div class="text-gray-900 font-bold text-sm text-center w-full">
                ${v.name}
            </div>
        `;
        btn.onclick = () => selectVariant(item, v);
        list.appendChild(btn);
    });
    container.appendChild(list);

    if (priceChart) { priceChart.destroy(); priceChart = null; }
    if (elements.chartPlaceholder) elements.chartPlaceholder.classList.remove('hidden');
    if (elements.marketSummaryCard) elements.marketSummaryCard.classList.add('hidden');
};

const selectVariant = (item, variant) => {
    elements.modalSubtitle.textContent = variant.name;

    const container = elements.matrixContainer;
    container.innerHTML = '';

    // Back Button
    const header = document.createElement('div');
    header.className = "mb-4 pb-2 border-b border-gray-200";

    const backBtn = document.createElement('button');
    backBtn.className = "text-sm text-blue-600 font-medium hover:text-blue-800 flex items-center gap-1 transition-colors";
    backBtn.innerHTML = `<span>◀</span> 목록으로 돌아가기`;
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

    if (item.category === 'equip') {
        renderMatrix(variant, container);
        if (priceChart) { priceChart.destroy(); priceChart = null; }
        if (elements.chartPlaceholder) elements.chartPlaceholder.classList.remove('hidden');
        if (elements.marketSummaryCard) elements.marketSummaryCard.classList.add('hidden');
    } else {
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

const renderMatrix = (variant, container) => {
    const keys = Object.keys(variant.matrix);

    keys.sort((a, b) => {
        const [e1] = a.split('_');
        const [e2] = b.split('_');
        return Number(e1) - Number(e2);
    });

    const grid = document.createElement('div');
    grid.className = "grid grid-cols-4 gap-2";

    keys.forEach(k => {
        const d = variant.matrix[k];
        const [e, dur] = k.split('_');
        const cell = document.createElement('div');

        cell.className = "matrix-choice-cell bg-white p-2 rounded shadow-sm text-center cursor-pointer border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition flex flex-col items-center justify-center min-h-[50px]";
        cell.innerHTML = `
            <div class="text-sm font-bold text-gray-900">${e}/${dur}</div>
        `;
        cell.onclick = () => {
            const allCells = grid.querySelectorAll('.matrix-choice-cell');
            allCells.forEach(c => c.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50'));
            cell.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50');

            loadDataAndRender(d.history, d.count);

            if (window.innerWidth < 1024) {
                const chartSec = document.getElementById('chart-section');
                if (chartSec) {
                    setTimeout(() => {
                        chartSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 100);
                }
            }
        };
        grid.appendChild(cell);
    });
    container.appendChild(grid);
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
            bestBid = calcMedian(pairs.slice(0, k).map(x => x.p));
            bestAsk = calcMedian(pairs.slice(k).map(x => x.p));
            bestW1 = w1;
            bestW2 = w2;
        }
    }

    const consensus = calcMedian(prices);
    const totalW = bestW1 + bestW2;
    const ratio = Math.min(bestW1, bestW2) / Math.max(totalW, 1e-9);
    // 양쪽 호가 군집이 1:2~1:3 수준까지는 50:50 스프레드 중간값을 온전히 보존(balanceFactor = 1.0)
    // 1:6, 1:10 처럼 1명의 고립된 호가로 치우칠 경우 다수파 컨센서스로 앵커링하여 솟구침(오버슈트) 방지
    const balanceFactor = Math.min(1.0, 3.5 * ratio);
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

        // 주변 +-45일 고유 유저 수집 (유저 수가 부족하면 +-90일, 전체로 확장)
        let uMap = new Map();
        for (const winDays of [45, 90, 99999]) {
            uMap.clear();
            for (const other of userDays) {
                if (Math.abs(other.dayIdx - ud.dayIdx) <= winDays) {
                    if (!uMap.has(other.nick)) uMap.set(other.nick, []);
                    uMap.get(other.nick).push(other.price);
                }
            }
            if (uMap.size >= Math.min(4, allUniqueUsers.size)) break;
        }

        const uMeds = [];
        for (const [, pList] of uMap.entries()) {
            uMeds.push(calcMedian(pList));
        }

        const lMed = uMeds.length > 0 ? calcMedian(uMeds) : globalMed;
        const mad = calcMedian(uMeds.map(m => Math.abs(m - lMed)));
        const sigma = Math.max(1.4826 * mad, lMed * 0.08);

        // 본인 외에 이 가격(±10%)에 동의하는 다른 고유 유저 수
        let otherUsersNear = 0;
        for (const [uNick, pList] of uMap.entries()) {
            if (uNick === ud.nick) continue;
            if (pList.some(val => Math.abs(val - p) / Math.max(lMed, 1e-6) <= 0.10)) {
                otherUsersNear++;
            }
        }

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
        } else if (Math.abs(p - lMed) > 2.2 * sigma && otherUsersNear === 0) {
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
        for (const wd of [30, 45, 60, 90, 180, 99999]) {
            chosenWinDays = wd;
            winPts = validUD.filter(u => Math.abs(u.ts - gt) <= wd * DAY_MS);
            const uSet = new Set(winPts.map(u => u.nick));
            if (uSet.size >= minTargetUsers && winPts.length >= 2) break;
        }
        if (winPts.length === 0) winPts = validUD;

        // 윈도우 내 고유 유저별 시간 가중 평균 호가 계산 (1인 독식 방지 캡 적용)
        const userAcc = new Map();
        const tau = Math.max(7, chosenWinDays * 0.55);
        for (const u of winPts) {
            const dtDays = (u.ts - gt) / DAY_MS;
            const w = Math.exp(-0.5 * Math.pow(dtDays / tau, 2));
            if (!userAcc.has(u.nick)) userAcc.set(u.nick, { swp: 0, sw: 0 });
            const acc = userAcc.get(u.nick);
            acc.swp += w * u.effPrice;
            acc.sw += w;
        }

        const uPrices = [];
        const uWeights = [];
        for (const [, acc] of userAcc.entries()) {
            if (acc.sw > 0) {
                uPrices.push(acc.swp / acc.sw);
                uWeights.push(Math.min(acc.sw, 1.5)); // 도배 유저 가중치 상한 캡
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

document.addEventListener('DOMContentLoaded', init);

