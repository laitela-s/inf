// --- IMMEDIATE VISIBILITY CHECK ---
// If this doesn't run, the file is not loading or has a syntax error.
// alert("앱 스크립트 로드됨 (STEP 570)");

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
let GLOBAL_DATA = [];
let PROCESSED_DATA = [];
let currentCategory = 'equip';
let currentChartRange = 'all';
let currentYScale = 'zoom';
let currentChartData = [];
let priceChart = null;

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
            statPrice: document.getElementById('stat-price'),
            // statFreq removed
            chartCanvas: document.getElementById('priceChart'),
            chartPlaceholder: document.getElementById('chart-placeholder'),
            chartRangeBtns: document.querySelectorAll('.chart-range-btn'),
            yScaleBtns: document.querySelectorAll('.y-scale-btn'),
            sidebar: document.getElementById('sidebar'),
            openSidebarBtn: document.getElementById('open-sidebar'),
            closeSidebarBtn: document.getElementById('close-sidebar'),
            sidebarOverlay: document.getElementById('mobile-sidebar-overlay')
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
    // data.txt (plain text) 우선 시도, 실패시 window.FARM_DATA (data.js) 폴백
    fetch('data.txt')
        .then(res => {
            if (!res.ok) throw new Error('data.txt not found');
            return res.text();
        })
        .then(text => {
            const rawData = text.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0 && line.startsWith('('));
            PROCESSED_DATA = processRealData(rawData);
            renderFilters();
            renderGrid();
        })
        .catch(() => {
            // fetch 실패 시 (file:// 프로토콜 등) data.js 폴백
            if (typeof window.FARM_DATA !== 'undefined') {
                PROCESSED_DATA = processRealData(window.FARM_DATA);
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

const processRealData = (data) => {
    const list = [];
    const tree = {};

    data.forEach(line => {
        const entry = parseRawLine(line);
        if (!entry) return;
        const cat = mapCategory(entry.category);
        if (!cat) return;
        const mainName = entry.item_name || "알 수 없음";

        if (!tree[cat]) tree[cat] = {};
        if (!tree[cat][mainName]) {
            tree[cat][mainName] = {
                id: `${cat}_${mainName}`,
                category: cat,
                name: mainName,
                variants: {},
                history: []
            };
        }

        const itemNode = tree[cat][mainName];
        const price = parseFloat(entry.price) || 0;
        if (price <= 0) return;

        const dateParts = entry.date.split('.');
        const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
        const historyItem = {
            date: dateObj.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }),
            isoDate: dateObj,
            price: price,
            meta: entry
        };

        itemNode.history.push(historyItem);

        let variantKey = "Default";
        if (cat === 'equip') variantKey = entry.option || "노옵션";
        else if (cat === 'acc') variantKey = entry.grade || "일반";
        else if (cat === 'mat') variantKey = entry.grade || "일반";

        if (!itemNode.variants[variantKey]) {
            itemNode.variants[variantKey] = {
                name: variantKey,
                matrix: {},
                history: [],
                count: 0
            };
        }

        const variantNode = itemNode.variants[variantKey];
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
    });

    Object.keys(tree).forEach(cat => {
        Object.values(tree[cat]).forEach(item => {
            // Apply Outlier Filter
            item.history = filterPriceOutliers(item.history);
            item.history.sort((a, b) => a.isoDate - b.isoDate);
            
            const validVariants = {};
            let hasValidVariant = false;

            Object.entries(item.variants).forEach(([vKey, v]) => {
                if (cat === 'equip') {
                    const validMatrix = {};
                    let matrixValidCount = 0;
                    
                    Object.entries(v.matrix).forEach(([mKey, m]) => {
                        m.history = filterPriceOutliers(m.history);
                        // 이상치 제거 후 개수 다시 평가
                        m.count = m.history.length;
                        
                        if (m.count >= 3) {
                            m.history.sort((a, b) => a.isoDate - b.isoDate);
                            // Update display price to latest valid price
                            if (m.history.length > 0) {
                                m.price = m.history[m.history.length - 1].price;
                            }
                            validMatrix[mKey] = m;
                            matrixValidCount++;
                        }
                    });
                    
                    if (matrixValidCount > 0) {
                        v.matrix = validMatrix;
                        v.history = filterPriceOutliers(v.history);
                        v.count = v.history.length;
                        v.history.sort((a, b) => a.isoDate - b.isoDate);
                        validVariants[vKey] = v;
                        hasValidVariant = true;
                    }

                } else {
                    v.history = filterPriceOutliers(v.history);
                    v.count = v.history.length;
                    
                    if (v.count >= 3) {
                        v.history.sort((a, b) => a.isoDate - b.isoDate);
                        validVariants[vKey] = v;
                        hasValidVariant = true;
                    }
                }
            });

            if (hasValidVariant) {
                item.variants = validVariants;
                list.push(item);
            }
        });
    });
    return list;
};

const parseRawLine = (line) => {
    const clean = line.replace(/^\(|\)$/g, '');
    const parts = clean.split(',').map(s => s.trim());
    if (parts.length < 3) return null;
    const entry = { date: parts[0], nickname: parts[1], category: parts[2] };

    if (entry.category === '장비' || entry.category === '장비셋') {
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
    if (rawCat === '장비' || rawCat === '장비셋') return 'equip';
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

    // --- CHART RANGE BUTTONS ---
    if (elements.chartRangeBtns) {
        elements.chartRangeBtns.forEach(btn => {
            btn.onclick = (e) => {
                elements.chartRangeBtns.forEach(b => {
                    b.classList.remove('active', 'bg-white', 'text-blue-600', 'font-medium', 'shadow-sm', 'border', 'border-gray-200');
                    b.classList.add('text-gray-500', 'hover:text-gray-900', 'hover:bg-gray-200');
                });
                e.target.classList.add('active', 'bg-white', 'text-blue-600', 'font-medium', 'shadow-sm', 'border', 'border-gray-200');
                e.target.classList.remove('text-gray-500', 'hover:text-gray-900', 'hover:bg-gray-200');
                currentChartRange = e.target.dataset.range;
                updateChart();
            };
        });
    }

    // --- Y SCALE BUTTONS ---
    if (elements.yScaleBtns) {
        elements.yScaleBtns.forEach(btn => {
            btn.onclick = (e) => {
                elements.yScaleBtns.forEach(b => {
                    b.classList.remove('active', 'bg-white', 'text-blue-600', 'font-medium', 'shadow-sm', 'border', 'border-gray-200');
                    b.classList.add('text-gray-500', 'hover:text-gray-900', 'hover:bg-gray-200');
                });
                e.target.classList.add('active', 'bg-white', 'text-blue-600', 'font-medium', 'shadow-sm', 'border', 'border-gray-200');
                e.target.classList.remove('text-gray-500', 'hover:text-gray-900', 'hover:bg-gray-200');
                currentYScale = e.target.scale || e.target.dataset.scale;
                updateChart();
            };
        });
    }
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

    // 1. Filter Data
    let items = PROCESSED_DATA.filter(item => item.category === currentCategory);
    if (filterText) items = items.filter(item => item.name.includes(filterText));

    // SORTER: Sort by Count Falling
    items.sort((a, b) => b.history.length - a.history.length);

    if (items.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center text-gray-500 py-10">데이터가 없습니다.</div>`;
        return;
    }

    // 2. Setup Infinite Scroll (Clear and init)
    grid.innerHTML = '';

    const visibleItems = items.slice(0, visibleLimit);

    visibleItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl border border-gray-200 p-5 cursor-pointer flex flex-col justify-between hover:border-blue-500 hover:shadow-md transition-all shadow-sm';
        const latest = item.history[item.history.length - 1];
        const price = latest ? latest.price : 0;

        const variantCount = Object.keys(item.variants).length;
        const sub = item.category === 'equip' ? `${variantCount}개 옵션` : `${variantCount}등급`;

        // REMOVED COUNT DISPLAY (Strict request)
        card.innerHTML = `
            <div>
                <div class="flex justify-between items-start mb-2">
                    <span class="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 font-medium">${sub}</span>
                </div>
                <h3 class="text-lg font-bold text-gray-900">${item.name}</h3>
            </div>
            <div class="mt-4 pt-4 border-t border-gray-100">
               <div class="text-red-500 font-bold text-xl">${price.toLocaleString()}억</div>
            </div>
        `;
        card.onclick = () => openModal(item);
        grid.appendChild(card);
    });

    // 3. Add Sentinel for Infinite Scroll
    if (visibleItems.length < items.length) {
        const sentinel = document.createElement('div');
        sentinel.className = "col-span-full h-10 flex justify-center items-center py-4";
        sentinel.innerHTML = `<div class="text-gray-500 text-xs">데이터 로딩 중...</div>`;
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
        // Default Subtitle
        elements.modalSubtitle.textContent = item.category === 'equip' ? '옵션 선택' : '등급 선택';

        renderVariantList(item);

        elements.modalOverlay.classList.remove('hidden');
        elements.modalOverlay.classList.add('active');

        elements.modalContent.classList.remove('hidden');
        elements.modalContent.style.opacity = '1';
        elements.modalContent.style.transform = 'translateY(0)';
        elements.modalContent.style.display = 'flex';

    } catch (e) {
        alert("모달 열기 실패: " + e.message);
    }
};

const renderVariantList = (item) => {
    // Reset Subtitle to instruction
    elements.modalSubtitle.textContent = item.category === 'equip' ? '옵션 선택' : '등급 선택';

    const container = elements.matrixContainer;
    container.innerHTML = '';

    const variants = Object.values(item.variants).sort((a, b) => b.count - a.count);

    const list = document.createElement('div');
    list.className = "grid grid-cols-2 gap-3 p-2";

    variants.forEach(v => {
        const btn = document.createElement('button');
        // STRICT: Hide Price AND Count on Button (User Request)
        btn.className = "p-3 bg-white hover:bg-blue-50 rounded shadow-sm text-left border border-gray-200 hover:border-blue-300 flex justify-between items-center transition";
        btn.innerHTML = `
            <div class="text-gray-900 font-bold text-sm text-center w-full">${v.name}</div>
        `;
        btn.onclick = () => selectVariant(item, v);
        list.appendChild(btn);
    });
    container.appendChild(list);

    if (priceChart) { priceChart.destroy(); priceChart = null; }
    if (elements.chartPlaceholder) elements.chartPlaceholder.classList.remove('hidden');
    elements.statPrice.textContent = '-';
    // No statFreq update here
};

const selectVariant = (item, variant) => {
    // Update Subtitle
    elements.modalSubtitle.textContent = variant.name;

    const container = elements.matrixContainer;
    container.innerHTML = '';

    // Back Button (Explicit Click Handler)
    const header = document.createElement('div');
    header.className = "mb-4 pb-2 border-b border-gray-200";

    const backBtn = document.createElement('button');
    backBtn.className = "text-sm text-blue-600 font-medium hover:text-blue-800 flex items-center gap-1 transition-colors";
    backBtn.innerHTML = `<span>◀</span> 목록으로 돌아가기`;
    backBtn.onclick = (e) => {
        e.stopPropagation(); // Safe logic
        renderVariantList(item);
    };

    header.appendChild(backBtn);
    container.appendChild(header);

    // Render Matrix or Grade Info
    if (item.category === 'equip') {
        renderMatrix(variant, container);
        // STRICT: DO NOT render chart yet for Equip. User must click Matrix cell.
        if (priceChart) { priceChart.destroy(); priceChart = null; }
        if (elements.chartPlaceholder) elements.chartPlaceholder.classList.remove('hidden');
        elements.statPrice.textContent = '-';

    } else {
        const info = document.createElement('div');
        info.className = "text-center text-gray-500 mt-10 p-4 bg-gray-50 rounded border border-gray-200";
        info.innerHTML = `
            <div class="text-gray-900 font-bold text-lg mb-2">${variant.name}</div>
            <div>해당 등급의 시세 기록입니다.</div>
        `;
        container.appendChild(info);

        // For Acc, Grade IS the final step, so we show chart
        loadDataAndRender(variant.history, variant.count);
    }
};

const renderMatrix = (variant, container) => {
    const keys = Object.keys(variant.matrix);

    // Sort logic
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

        // STRICT: Hide Price on Cell
        cell.className = "bg-white p-2 rounded shadow-sm text-center cursor-pointer border border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition flex flex-col items-center justify-center min-h-[50px]";
        cell.innerHTML = `
            <div class="text-sm font-bold text-gray-900">${e}/${dur}</div>
        `;
        cell.onclick = () => loadDataAndRender(d.history, d.count);
        grid.appendChild(cell);
    });
    container.appendChild(grid);
};

const loadDataAndRender = (history, count) => {
    try {
        currentChartData = history;
        // Update Stats (using last item price)
        const lastPrice = history.length > 0 ? history[history.length - 1].price : 0;
        if (elements.statPrice) elements.statPrice.textContent = lastPrice.toLocaleString() + "억";
        // REMOVED statFreq update

        updateChart();
    } catch (e) {
        console.error(e);
        alert("차트 데이터 로드 중 오류: " + e.message);
    }
};

const updateChart = () => {
    try {
        if (!elements.chartCanvas || typeof Chart === 'undefined') return;
        if (elements.chartPlaceholder) elements.chartPlaceholder.classList.add('hidden');
        if (priceChart) priceChart.destroy();

        // 1. Filter Data by Range
        let filteredData = [...currentChartData];
        if (currentChartRange === '3m') {
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            filteredData = filteredData.filter(d => d.isoDate >= threeMonthsAgo);
        }
        filteredData.sort((a, b) => a.isoDate - b.isoDate);

        // 2. Smooth Data (Simple Moving Average)
        const prices = filteredData.map(d => d.price);
        const smoothedPrices = [];
        const windowSize = 3;
        for (let i = 0; i < prices.length; i++) {
            let sum = 0;
            let count = 0;
            for (let j = Math.max(0, i - windowSize + 1); j <= i; j++) {
                sum += prices[j];
                count++;
            }
            smoothedPrices.push(sum / count);
        }

        // 오늘 날짜를 명시적으로 구성 (한국 시간대)
        const nowParts = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).split(/[- T:]/);
        const today = new Date(Number(nowParts[0]), Number(nowParts[1]) - 1, Number(nowParts[2]));
        const todayTime = today.getTime();

        const displayData = [];
        for (let i = 0; i < filteredData.length; i++) {
            displayData.push({
                x: filteredData[i].isoDate.getTime(),
                y: smoothedPrices[i]
            });
        }

        // 마지막 거래 이후 선 끊기
        const lastDataTime = displayData.length > 0 ? displayData[displayData.length - 1].x : todayTime;
        if (displayData.length > 0 && todayTime > lastDataTime) {
            displayData.push({ x: lastDataTime + 1, y: null });
        }

        // 3개월 단위 틱 생성 (25.3, 25.6, 25.9, 25.12 ...)
        const firstTime = displayData.length > 0 ? displayData[0].x : todayTime;
        const firstDate = new Date(firstTime);
        const quarterTicks = [];
        let tickYear = firstDate.getFullYear();
        let tickMonth = Math.floor(firstDate.getMonth() / 3) * 3;
        while (true) {
            const tickDate = new Date(tickYear, tickMonth, 1);
            const tickTime = tickDate.getTime();
            if (tickTime > todayTime) break;
            if (tickTime >= firstTime) {
                quarterTicks.push(tickTime);
            }
            tickMonth += 3;
            if (tickMonth >= 12) {
                tickMonth -= 12;
                tickYear++;
            }
        }

        const ctx = elements.chartCanvas.getContext('2d');

        priceChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: '시세 (억)',
                    data: displayData,
                    borderColor: '#ef4444',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    tension: 0.1,
                    fill: false,
                    spanGaps: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                const d = new Date(context[0].parsed.x);
                                return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate();
                            },
                            label: function (context) {
                                if (context.parsed.y === null) return '';
                                return context.parsed.y.toFixed(1) + '억';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        display: true,
                        min: firstTime,
                        max: todayTime,
                        afterBuildTicks: function(axis) {
                            axis.ticks = quarterTicks.map(t => ({ value: t }));
                        },
                        ticks: {
                            color: '#6b7280',
                            maxRotation: 0,
                            minRotation: 0,
                            callback: function(value) {
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
                        beginAtZero: currentYScale === 'normal',
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
                    mode: 'nearest',
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

