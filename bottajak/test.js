// 보따작 시뮬레이터 검증 테스트
// Node.js로 실행: node test.js

// app.js에서 필요한 부분만 복사
const PRODUCTS = {
    subscriptions: {
        geumdongi: { name: '금동이', price: 3300, totalReal: 450, instant: 15, daily: 15, days: 29, type: 'normal' },
        saessakGeum: { name: '새싹금동이', price: 5500, totalReal: 775, instant: 50, daily: 25, days: 29, type: 'saessak' },
        weekendGeum: { name: '주말금동이', price: 7500, totalReal: 752, weekendOnly: true, perWeekend: 94, weekends: 8, type: 'weekend' }
    },
    packages: {
        banjjak1: { name: '반짝꾸러미1', price: 11000, real: 420 },
        banjjak2: { name: '반짝꾸러미2', price: 55000, real: 2250 },
        banjjak3: { name: '반짝꾸러미3', price: 110000, real: 4800 }
    },
    directReal: [
        { price: 1100, real: 25 },
        { price: 3300, real: 75 },
        { price: 5500, real: 130 },
        { price: 11000, real: 280 },
        { price: 55000, real: 1500 },
        { price: 110000, real: 3180 }
    ]
};

// 간단한 시뮬레이션 함수
function simulate(initialBotta, targetBotta, initialReal = 0) {
    let botta = initialBotta;
    let real = initialReal;
    let day = 0;

    while (botta < targetBotta) {
        day++;
        real += botta;
        while (real >= 365) {
            real -= 365;
            botta++;
            if (botta >= targetBotta) break;
        }
        if (day > 5000) break;
    }

    return { days: day, finalBotta: botta, finalReal: real };
}

// 검증 테스트
console.log('=== 보따작 시뮬레이터 검증 테스트 ===\n');

// 테스트 1: 1마리 → 2마리 = 365일
console.log('테스트 1: 1마리 → 2마리');
const test1 = simulate(1, 2, 0);
console.log(`  결과: ${test1.days}일 (예상: 365일)`);
console.log(`  통과: ${test1.days === 365 ? '✅' : '❌'}\n`);

// 테스트 2: 10마리 → 11마리 ≈ 36-37일
console.log('테스트 2: 10마리 → 11마리');
const test2 = simulate(10, 11, 0);
console.log(`  결과: ${test2.days}일 (예상: 약 36-37일)`);
console.log(`  통과: ${test2.days >= 36 && test2.days <= 37 ? '✅' : '❌'}\n`);

// 테스트 3: 지수함수 근사 확인 (1년 후 약 2.72배)
console.log('테스트 3: 지수함수 근사 (10마리, 365일 후)');
let botta = 10;
let real = 0;
for (let d = 0; d < 365; d++) {
    real += botta;
    while (real >= 365) {
        real -= 365;
        botta++;
    }
}
const theoretical = 10 * Math.E;
const error = Math.abs(botta - theoretical) / theoretical * 100;
console.log(`  시뮬레이션: ${botta}마리`);
console.log(`  이론값(10×e): ${theoretical.toFixed(2)}마리`);
console.log(`  오차: ${error.toFixed(2)}%`);
console.log(`  통과: ${error < 5 ? '✅' : '❌'}\n`);

// 테스트 4: 다양한 초기값 검증
console.log('테스트 4: 다양한 초기값');
const testCases = [
    { init: 1, target: 10 },
    { init: 10, target: 100 },
    { init: 100, target: 200 },
];
for (const tc of testCases) {
    const result = simulate(tc.init, tc.target, 0);
    // 이론적으로 t = 365 * ln(target/init)
    const theoreticalDays = 365 * Math.log(tc.target / tc.init);
    const dayError = Math.abs(result.days - theoreticalDays) / theoreticalDays * 100;
    console.log(`  ${tc.init}→${tc.target}: ${result.days}일 (이론: ${theoreticalDays.toFixed(0)}일, 오차: ${dayError.toFixed(1)}%)`);
}

console.log('\n=== 테스트 완료 ===');
