// 보따작 시뮬레이터 - 단순화된 버전

// ===== 과금 상품 정의 =====
const PRODUCTS = {
    // 월간 구독 (30일 주기)
    subscriptions: {
        geumdongi: {
            id: 'geumdongi',
            name: '금동이',
            price: 3300,
            totalReal: 450,
            instant: 15,
            daily: 15,
            days: 29,
            type: 'normal'
        },
        saessakGeum: {
            id: 'saessakGeum',
            name: '새싹금동이',
            price: 5500,
            totalReal: 775,
            instant: 50,
            daily: 25,
            days: 29,
            type: 'saessak'
        },
        weekendGeum: {
            id: 'weekendGeum',
            name: '주말금동이',
            price: 7500,
            totalReal: 752,
            weekendOnly: true,
            perWeekend: 94,
            weekends: 8,
            type: 'weekend'
        }
    },

    // 월간 패키지 (월초 1회, 각각 구매 가능)
    packages: {
        banjjak1: { id: 'banjjak1', name: '반짝꾸러미1', price: 11000, real: 420 },
        banjjak2: { id: 'banjjak2', name: '반짝꾸러미2', price: 55000, real: 2250 },
        banjjak3: { id: 'banjjak3', name: '반짝꾸러미3', price: 110000, real: 4800 }
    },

    // 무제한 깡레알
    directReal: [
        { id: 'direct_0', price: 1100, real: 25 },
        { id: 'direct_1', price: 3300, real: 75 },
        { id: 'direct_2', price: 5500, real: 130 },
        { id: 'direct_3', price: 11000, real: 280 },
        { id: 'direct_4', price: 55000, real: 1500 },
        { id: 'direct_5', price: 110000, real: 3180 }
    ]
};

// 시간가치 상수
const TIME_VALUE_BASE = 2.7;

// 전역 변수
let simulator = null;
let debugLogs = [];

// ===== 일별 시뮬레이션 =====
function simulate(initialBotta, targetBotta, initialReal, purchasePlan, enableDebug = false) {
    let botta = initialBotta;
    let real = initialReal;
    let day = 0;
    debugLogs = [];

    // 일별 지급 스케줄 생성
    const schedule = buildPaymentSchedule(purchasePlan);

    if (enableDebug) {
        debugLogs.push(`=== 시뮬레이션 시작 ===`);
        debugLogs.push(`초기 보따: ${botta}, 초기 레알: ${real}, 목표: ${targetBotta}`);
        debugLogs.push(`구매 계획: ${JSON.stringify(purchasePlan)}`);
        debugLogs.push('');
    }

    const maxDay = 5000;

    // 마지막 30일간 레알 수익 추적
    let last30DaysReal = 0;
    let recentDailyReal = [];

    while (botta < targetBotta && day < maxDay) {
        day++;
        const prevBotta = botta;

        // 보따로부터 수익
        real += botta;
        let dailyReal = botta;

        // 과금 지급
        let payment = schedule[day] || 0;
        real += payment;
        dailyReal += payment;

        // 보따 구매
        let purchased = 0;
        while (real >= 365 && botta < targetBotta) {
            real -= 365;
            botta++;
            purchased++;
        }

        // 최근 31일 레알 추적 (오차 상쇄 목적)
        recentDailyReal.push(dailyReal);
        if (recentDailyReal.length > 31) {
            recentDailyReal.shift();
        }

        // 디버그 로그
        if (enableDebug && (day <= 30 || purchased > 0 || payment > 0)) {
            let log = `[${day}일] +${prevBotta}(보따)`;
            if (payment > 0) log += ` +${payment}(과금)`;
            if (purchased > 0) log += ` → 보따 ${purchased}마리 구매 (${prevBotta}→${botta})`;
            debugLogs.push(log);
        }
    }

    // 마지막 31일간 총 레알 (1일 환산용)
    last30DaysReal = recentDailyReal.reduce((sum, r) => sum + r, 0);

    if (enableDebug) {
        debugLogs.push('');
        debugLogs.push(`=== 시뮬레이션 종료: ${day}일, 최종 ${botta}마리 ===`);
    }

    return {
        days: day,
        finalBotta: botta,
        finalReal: real,
        last30DaysReal: last30DaysReal,
        realPerDay: last30DaysReal / 31  // 1일 = 31일간 레알 / 31
    };
}

// 지급 스케줄 생성
function buildPaymentSchedule(purchasePlan) {
    const schedule = {};

    for (const item of purchasePlan) {
        const { productId, count } = item;

        // 구독
        const sub = PRODUCTS.subscriptions[productId];
        if (sub) {
            for (let i = 0; i < count; i++) {
                const startDay = i * 30 + 1;
                // 즉시
                if (sub.instant) {
                    schedule[startDay] = (schedule[startDay] || 0) + sub.instant;
                }
                // 일일
                if (sub.daily) {
                    for (let d = 1; d <= sub.days; d++) {
                        schedule[startDay + d] = (schedule[startDay + d] || 0) + sub.daily;
                    }
                }
                // 주말
                if (sub.weekendOnly) {
                    let weekendCount = 0;
                    let d = startDay;
                    while (weekendCount < sub.weekends) {
                        d++;
                        if ((d - startDay) % 7 === 6 || (d - startDay) % 7 === 0) {
                            schedule[d] = (schedule[d] || 0) + sub.perWeekend;
                            weekendCount++;
                        }
                    }
                }
            }
            continue;
        }

        // 패키지
        const pkg = PRODUCTS.packages[productId];
        if (pkg) {
            for (let i = 0; i < count; i++) {
                const day = i * 30 + 1;
                schedule[day] = (schedule[day] || 0) + pkg.real;
            }
            continue;
        }

        // 깡레알
        if (productId.startsWith('direct_')) {
            const idx = parseInt(productId.split('_')[1]);
            const direct = PRODUCTS.directReal[idx];
            if (direct) {
                schedule[1] = (schedule[1] || 0) + direct.real * count;
            }
        }
    }

    return schedule;
}

// ===== 최적화 알고리즘 =====
function optimizeByBudget(initialBotta, targetBotta, initialReal, budget) {
    console.log('=== optimizeByBudget 시작 ===');
    console.log('입력값:', { initialBotta, targetBotta, initialReal, budget });

    // 무과금 시뮬레이션
    const baseResult = simulate(initialBotta, targetBotta, initialReal, []);
    const baseDays = baseResult.days;
    console.log('무과금 시뮬:', baseDays, '일');

    // 예산이 0이면 무과금 결과 반환
    if (budget <= 0) {
        return {
            plan: [],
            days: baseDays,
            baseDays: baseDays,
            savedDays: 0,
            totalCost: 0,
            efficiency: 0
        };
    }

    // 1단계: 깡레알만으로 예산 배분
    let plan = allocateToDirectReal(budget);
    console.log('1단계 깡레알 플랜:', plan);

    let result = simulate(initialBotta, targetBotta, initialReal, plan);
    let estimatedDays = result.days;
    console.log('1단계 예상일수:', estimatedDays);

    // 2단계: 반복 최적화 (10회)
    for (let iter = 0; iter < 10; iter++) {
        // 시간가치 보정 효율 계산
        const timeMultiplier = Math.pow(TIME_VALUE_BASE, estimatedDays / 365);
        console.log(`반복 ${iter}: timeMultiplier=${timeMultiplier.toFixed(4)}`);

        // 최적 상품 선택
        plan = selectBestProducts(budget, estimatedDays, timeMultiplier);
        console.log(`반복 ${iter}: 플랜 개수=${plan.length}`);

        // 새 계획으로 시뮬레이션
        result = simulate(initialBotta, targetBotta, initialReal, plan);
        const newDays = result.days;
        console.log(`반복 ${iter}: 새 예상일수=${newDays}`);

        // 수렴 체크
        if (Math.abs(newDays - estimatedDays) < 7) {
            console.log(`반복 ${iter}: 수렴 완료`);
            break;
        }
        estimatedDays = newDays;
    }

    const totalCost = calculateTotalCost(plan);
    const savedDays = baseDays - result.days;

    console.log('=== 최종 결과 ===');
    console.log('days:', result.days, 'savedDays:', savedDays, 'totalCost:', totalCost);
    console.log('plan:', plan);

    return {
        plan: plan,
        days: result.days,
        baseDays: baseDays,
        savedDays: savedDays,
        totalCost: totalCost,
        efficiency: savedDays > 0 ? totalCost / savedDays : Infinity
    };
}

// 예산을 깡레알에 배분
function allocateToDirectReal(budget) {
    const plan = [];
    let remaining = budget;

    // 효율 높은 순서 (5→4→3→2→1→0)
    for (let i = 5; i >= 0; i--) {
        const direct = PRODUCTS.directReal[i];
        const count = Math.floor(remaining / direct.price);
        if (count > 0) {
            plan.push({ productId: direct.id, count: count, name: `깡레알 ${direct.price.toLocaleString()}원`, price: direct.price });
            remaining -= count * direct.price;
        }
    }

    return plan;
}

// 최적 상품 선택
// 모든 구매 인스턴스를 시간가치 보정 효율로 정렬 후 구매
function selectBestProducts(budget, estimatedDays, timeMultiplier) {
    const plan = [];
    let remaining = budget;

    // 모든 구매 인스턴스 생성
    const allInstances = [];

    // 구독 상품 간격: 금동이/새싹금동이 = 29일, 주말금동이 = 28일
    // 1차=1일, 2차=30일(29일후), 3차=59일...
    const subIntervals = {
        geumdongi: 29,
        saessakGeum: 29,
        weekendGeum: 28
    };

    // 반짝꾸러미 간격: 30일 (1차=1일, 2차=31일, 3차=61일...)
    const pkgInterval = 30;

    // 구독 상품 인스턴스 생성
    for (const [subId, sub] of Object.entries(PRODUCTS.subscriptions)) {
        const interval = subIntervals[subId] || 30;
        const maxInstances = Math.ceil(estimatedDays / interval);

        for (let i = 0; i < maxInstances; i++) {
            const dayOfPurchase = 1 + i * interval; // 1, 30, 59... or 1, 29, 57...
            if (dayOfPurchase > estimatedDays) break;

            const remainingDays = estimatedDays - dayOfPurchase;
            const multiplier = Math.pow(TIME_VALUE_BASE, remainingDays / 365);
            const adjEfficiency = (sub.totalReal / sub.price) * multiplier;

            allInstances.push({
                type: 'subscription',
                id: subId,
                name: sub.name,
                price: sub.price,
                subType: sub.type,
                instance: i,
                dayOfPurchase: dayOfPurchase,
                adjEfficiency: adjEfficiency
            });
        }
    }

    // 패키지 상품 인스턴스 생성
    for (const [pkgId, pkg] of Object.entries(PRODUCTS.packages)) {
        const maxInstances = Math.ceil(estimatedDays / pkgInterval);

        for (let i = 0; i < maxInstances; i++) {
            const dayOfPurchase = 1 + i * pkgInterval; // 1, 31, 61...
            if (dayOfPurchase > estimatedDays) break;

            const remainingDays = estimatedDays - dayOfPurchase;
            const multiplier = Math.pow(TIME_VALUE_BASE, remainingDays / 365);
            const adjEfficiency = (pkg.real / pkg.price) * multiplier;

            allInstances.push({
                type: 'package',
                id: pkgId,
                name: pkg.name,
                price: pkg.price,
                instance: i,
                dayOfPurchase: dayOfPurchase,
                adjEfficiency: adjEfficiency
            });
        }
    }

    // 깡레알 인스턴스 생성 (11만원, 5.5만원만 - 작은건 비효율)
    // index 5 = 110,000원, index 4 = 55,000원
    for (let i = 5; i >= 4; i--) {
        const direct = PRODUCTS.directReal[i];
        const adjEfficiency = (direct.real / direct.price) * timeMultiplier;

        allInstances.push({
            type: 'direct',
            id: `direct_${i}`,
            name: `깡레알 ${direct.price.toLocaleString()}원`,
            price: direct.price,
            real: direct.real,
            instance: 0,
            dayOfPurchase: 1,
            adjEfficiency: adjEfficiency,
            unlimited: true
        });
    }

    // 시간가치 보정 효율로 정렬 (높은 순)
    allInstances.sort((a, b) => b.adjEfficiency - a.adjEfficiency);

    // 구독별 구매 횟수 추적
    const subPurchased = {};
    const pkgPurchased = {};

    // 효율 좋은 순서대로 구매
    for (const item of allInstances) {
        if (remaining < item.price) continue;

        if (item.type === 'subscription') {
            // 인스턴스 번호 체크 (이전 인스턴스를 다 산 후에만 구매 가능)
            const purchased = subPurchased[item.id] || 0;
            if (item.instance !== purchased) continue;

            // 같은 시기에 일반+새싹 조합 불가
            // 같은 인스턴스 번호끼리 체크
            const normalPurchased = subPurchased['geumdongi'] || 0;
            const saessakPurchased = subPurchased['saessakGeum'] || 0;

            if (item.subType === 'normal' && saessakPurchased > item.instance) continue;
            if (item.subType === 'saessak' && normalPurchased > item.instance) continue;

            plan.push({ productId: item.id, count: 1, name: item.name, price: item.price });
            remaining -= item.price;
            subPurchased[item.id] = purchased + 1;

        } else if (item.type === 'package') {
            // 인스턴스 번호 체크
            const purchased = pkgPurchased[item.id] || 0;
            if (item.instance !== purchased) continue;

            plan.push({ productId: item.id, count: 1, name: item.name, price: item.price });
            remaining -= item.price;
            pkgPurchased[item.id] = purchased + 1;

        } else if (item.type === 'direct') {
            // 깡레알: 남은 예산으로 최대한 구매
            const count = Math.floor(remaining / item.price);
            if (count > 0) {
                plan.push({ productId: item.id, count: count, name: item.name, price: item.price });
                remaining -= count * item.price;
            }
        }
    }

    return plan;
}

// 총 비용 계산
function calculateTotalCost(plan) {
    return plan.reduce((sum, item) => sum + item.price * item.count, 0);
}

// ===== 임계값 기반 최적화 (이진탐색) =====
// 예산을 조절하며 최저효율상품이 임계값에 맞는 예산 찾기
function optimizeByThreshold(initialBotta, targetBotta, initialReal, threshold) {
    console.log('=== optimizeByThreshold 시작 ===');
    console.log('threshold:', threshold, '원/일');

    // 무과금 시뮬레이션
    const baseResult = simulate(initialBotta, targetBotta, initialReal, []);
    const baseDays = baseResult.days;
    console.log('무과금:', baseDays, '일');

    // 이진탐색 변수
    let budget = 110000;  // 초기 예산 11만원
    let multiplier = 2;   // 초기 배율
    let lastDirection = 0; // 0: 초기, 1: 증가, -1: 감소
    let bestResult = null;
    let bestBudget = 0;

    // 이진탐색 반복 (최대 30회)
    for (let iter = 0; iter < 30; iter++) {
        // 현재 예산으로 최적화
        const result = optimizeByBudget(initialBotta, targetBotta, initialReal, budget);

        if (!result.plan || result.plan.length === 0) {
            console.log(`반복 ${iter}: 예산 ${budget} → 플랜 없음`);
            // 예산 늘리기
            budget = Math.round(budget * multiplier / 1100) * 1100;
            continue;
        }

        // 최저효율 상품 찾기
        const efficiencies = calculateItemEfficiencies(initialBotta, targetBotta, initialReal, result);

        if (efficiencies.length === 0) {
            console.log(`반복 ${iter}: 효율 계산 실패`);
            break;
        }

        // 가장 효율 나쁜 상품 (기여도 대비 가격 높음)
        const worstItem = efficiencies.reduce((worst, item) =>
            item.efficiency > worst.efficiency ? item : worst
        );

        console.log(`반복 ${iter}: 예산=${budget}, worst=${worstItem.name}(${worstItem.efficiency.toFixed(1)}원/일), threshold=${threshold}`);

        // 방향 결정
        let newDirection;
        if (worstItem.efficiency < threshold) {
            // 효율이 너무 좋음 → 예산 늘려도 됨
            newDirection = 1;
        } else if (worstItem.efficiency > threshold) {
            // 효율이 나쁨 → 예산 줄여야 함
            newDirection = -1;
        } else {
            // 정확히 일치
            console.log('정확히 임계값 일치!');
            result.worstItemEfficiency = worstItem.efficiency;
            result.worstItemName = worstItem.name;
            result.baseDays = baseDays;
            result.savedDays = baseDays - result.days;
            return result;
        }

        // 현재 결과 저장 (임계값 이하인 경우)
        if (worstItem.efficiency <= threshold) {
            if (!bestResult || budget > bestBudget) {
                bestResult = result;
                bestBudget = budget;
                bestResult.worstItemEfficiency = worstItem.efficiency;
                bestResult.worstItemName = worstItem.name;
            }
        }

        // 방향 전환 시 배율 절반
        if (lastDirection !== 0 && newDirection !== lastDirection) {
            multiplier = Math.max(1.1, multiplier / 2);
            console.log(`방향 전환! 배율: ${multiplier.toFixed(2)}`);
        }
        lastDirection = newDirection;

        // 예산 조절
        const oldBudget = budget;
        if (newDirection > 0) {
            budget = Math.round(budget * multiplier / 1100) * 1100;
        } else {
            budget = Math.round(budget / multiplier / 1100) * 1100;
        }

        // 최소/최대 예산
        budget = Math.max(1100, Math.min(11000000, budget));

        // 수렴 체크 (예산 변화가 1%미만이거나 1,100원 미만)
        const budgetChange = Math.abs(budget - oldBudget);
        if (budgetChange <= 1100 || budgetChange / oldBudget < 0.01) {
            console.log(`수렴 완료! (변화: ${budgetChange}원)`);
            break;
        }
    }

    // 최적 결과 반환
    if (bestResult) {
        bestResult.baseDays = baseDays;
        bestResult.savedDays = baseDays - bestResult.days;
        return bestResult;
    }

    // 결과 없으면 무과금
    return {
        plan: [],
        days: baseDays,
        baseDays: baseDays,
        savedDays: 0,
        totalCost: 0,
        efficiency: 0
    };
}

// 각 상품 종류의 마지막 인스턴스 기여도 계산
// 12가지 상품 종류 각각의 마지막 구매만 제거하고 시뮬레이션
function calculateItemEfficiencies(initialBotta, targetBotta, initialReal, result) {
    const efficiencies = [];

    // 현재 플랜의 전체 시뮬레이션 결과
    const fullResult = simulate(initialBotta, targetBotta, initialReal, result.plan);

    // 12가지 상품 종류별로 마지막 인스턴스 찾기
    const productTypes = [
        'geumdongi', 'saessakGeum', 'weekendGeum',  // 구독
        'banjjak1', 'banjjak2', 'banjjak3',         // 패키지
        'direct_0', 'direct_1', 'direct_2', 'direct_3', 'direct_4', 'direct_5'  // 깡레알
    ];

    for (const productId of productTypes) {
        // 해당 상품이 플랜에 있는지 확인
        const items = result.plan.filter(p => p.productId === productId);
        if (items.length === 0) continue;

        // 마지막 인스턴스 = 가장 많이 산 것에서 1개 빼기
        const item = items[0]; // formatPlan으로 합쳐진 상태라 1개만 있음
        if (item.count <= 0) continue;

        // count를 1 줄인 플랜 생성
        const planWithOneLess = result.plan.map(p => {
            if (p.productId === productId) {
                return { ...p, count: p.count - 1 };
            }
            return p;
        }).filter(p => p.count > 0);

        const resultWithout = simulate(initialBotta, targetBotta, initialReal, planWithOneLess);

        // 기여도 계산 (소수점 일수 포함)
        let contribution = resultWithout.days - fullResult.days;

        // 일수 차이가 0이면 레알 차이로 소수점 일수 계산
        if (contribution === 0 && fullResult.realPerDay > 0) {
            // 잔여 레알 차이를 일수로 환산
            const realDiff = resultWithout.finalReal - fullResult.finalReal;
            // 레알이 줄어들면 더 빨리 끝나는 것 (음수 realDiff = 긍정적 기여)
            // 레알이 늘어나면 더 늦게 끝나는 것 (양수 realDiff = 부정적 기여)
            // 하지만 우리는 "제거했을 때" 일수가 늘어나는지 봄
            // realDiff > 0: 제거하면 레알이 늘어남 = 제거 전에 과금이 레알을 줬음
            contribution = -(realDiff / fullResult.realPerDay);
        }

        // 마지막 1개의 가격
        const singlePrice = item.price;
        const efficiency = contribution > 0 ? singlePrice / contribution : Infinity;

        efficiencies.push({
            productId: productId,
            name: item.name,
            count: 1,  // 마지막 1개만 계산
            totalPrice: singlePrice,
            contribution: contribution,
            efficiency: efficiency
        });
    }

    return efficiencies;
}

// ===== UI 연동 함수 =====
function initialize(initialBotta, targetBotta, initialReal) {
    simulator = { initialBotta, targetBotta, initialReal };
    const result = simulate(initialBotta, targetBotta, initialReal, []);
    return result;
}

function calculateByBudget(budget) {
    if (!simulator) return null;
    const result = optimizeByBudget(simulator.initialBotta, simulator.targetBotta, simulator.initialReal, budget);

    // 결과 형식 변환
    result.plan = formatPlan(result.plan);
    return result;
}

function calculateByThreshold(threshold) {
    if (!simulator) return null;
    const result = optimizeByThreshold(simulator.initialBotta, simulator.targetBotta, simulator.initialReal, threshold);

    result.plan = formatPlan(result.plan);
    return result;
}

// 플랜 형식 변환 (동일 상품 합치기)
function formatPlan(plan) {
    const merged = {};

    for (const item of plan) {
        if (!merged[item.productId]) {
            merged[item.productId] = { name: item.name, count: 0, price: item.price, totalPrice: 0 };
        }
        merged[item.productId].count += item.count;
        merged[item.productId].totalPrice += item.price * item.count;
    }

    return Object.values(merged).sort((a, b) => b.totalPrice - a.totalPrice);
}

// 디버그 시뮬레이션
function runDebugSimulation(plan) {
    if (!simulator) return null;

    // plan을 내부 형식으로 변환
    const internalPlan = [];
    for (const item of plan) {
        // 상품 ID 찾기
        for (const [id, sub] of Object.entries(PRODUCTS.subscriptions)) {
            if (sub.name === item.name) {
                internalPlan.push({ productId: id, count: item.count });
                break;
            }
        }
        for (const [id, pkg] of Object.entries(PRODUCTS.packages)) {
            if (pkg.name === item.name) {
                internalPlan.push({ productId: id, count: item.count });
                break;
            }
        }
        for (let i = 0; i < PRODUCTS.directReal.length; i++) {
            const d = PRODUCTS.directReal[i];
            if (item.name === `깡레알 ${d.price.toLocaleString()}원`) {
                internalPlan.push({ productId: `direct_${i}`, count: item.count });
                break;
            }
        }
    }

    simulate(simulator.initialBotta, simulator.targetBotta, simulator.initialReal, internalPlan, true);
    return { debugLog: debugLogs };
}

// 검증용
function verifyExponentialGrowth(initialBotta, days) {
    let botta = initialBotta;
    let real = 0;
    for (let d = 0; d < days; d++) {
        real += botta;
        while (real >= 365) {
            real -= 365;
            botta++;
        }
    }

    const theoretical = initialBotta * Math.exp(days / 365);
    return {
        simulated: botta,
        theoretical: Math.floor(theoretical),
        error: Math.abs(botta - theoretical) / theoretical * 100
    };
}
