const aiService = require('./services/aiService');

async function verifyAI() {
    console.log("=== STARTING AI BRAIN VERIFICATION ===\n");

    // Scenario 1: CVE Security Task
    console.log("TEST 1: [CVE 취약점 조치 요청]");
    const res1 = await aiService.executeTask({
        title: "CVE-202X-XXXX 긴급 조치",
        description: "권한 우회 취약점이 발견되었습니다."
    });
    console.log("--- RESULT 1 ---");
    console.log(res1.substring(0, 300) + "...\n"); // Log first 300 chars

    if (res1.includes("Java Architecture") || res1.includes("Node.js")) {
        console.error("❌ FAILED: Found prohibited keywords in CVE task.");
    } else if (res1.includes("긴급 패치 코드") || res1.includes("Security")) {
        console.log("✅ PASSED: Correct Security Persona.");
    } else {
        console.warn("⚠️ CHECK: Result unclear.");
    }

    // Scenario 2: UI Design Task
    console.log("\nTEST 2: [UI 버튼 색상 변경]");
    const res2 = await aiService.executeTask({
        title: "메인 버튼 색상 변경 Design",
        description: "브랜드 컬러에 맞춰 파란색으로 변경."
    });
    console.log("--- RESULT 2 ---");
    console.log(res2.substring(0, 300) + "...\n");

    if (res2.includes("CVE") || res2.includes("Java")) {
        console.error("❌ FAILED: Found wrong context in UI task.");
    } else if (res2.includes("Design Audit") || res2.includes("CSS")) {
        console.log("✅ PASSED: Correct Designer Persona.");
    } else {
        console.warn("⚠️ CHECK: Result unclear.");
    }

    console.log("\n=== VERIFICATION COMPLETE ===");
}

verifyAI();
