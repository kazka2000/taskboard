const mysql = require('mysql2/promise');
const aiService = require('./services/aiService');
const config = require('./config');

const pool = mysql.createPool(config.db);

async function testAIContext() {
    console.log("Testing AI Context Injection...");

    aiService.initialize(pool);

    const payload = {
        messages: [
            // Asking a specific question about the task's metadata to see if it can read the injected DB context
            { role: 'user', content: '지금 이 태스크에 어떤 체크리스트 항목들이 등록되어있고, 완료 상태는 어때?' }
        ],
        taskContext: {
            id: 1,
            title: 'Verify Context Injection',
            description: 'Can AI read the database metadata?'
        },
        projectContext: {
            id: 1,
            title: 'Test Project'
        }
    };

    try {
        const stream = aiService.chatStream(payload);

        console.log("Connected to Chat Stream. Receiving data...");
        for await (const chunk of stream) {
            process.stdout.write(chunk.content);
        }
        console.log("\n\nStream Ended Successfully.");
    } catch (error) {
        console.error("Test Failed:", error);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

testAIContext();
