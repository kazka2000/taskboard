const axios = require('axios');

async function verifyChat() {
    console.log('Testing AI Chat Endpoint...');

    const payload = {
        messages: [
            { role: 'user', content: '이 태스크를 Review 스텝으로 이동해줘.' }
        ],
        taskContext: {
            id: 1,
            title: 'Security Audit',
            description: 'Check for CVEs.'
        },
        projectContext: {
            id: 1,
            title: 'TaskBoard Project'
        }
    };

    try {
        const response = await axios.post('http://localhost:3000/api/ai/chat', payload, {
            responseType: 'stream'
        });

        console.log('Connected to Chat Stream. Receiving data...');

        response.data.on('data', (chunk) => {
            const dataStr = chunk.toString();
            // Simple parsing for verification
            console.log('Received Chunk:', dataStr.substring(0, 100) + '...');
            if (dataStr.includes('"type":"done"')) {
                console.log('Stream Done Signal Received.');
            }
        });

        response.data.on('end', () => {
            console.log('Stream Ended Successfully.');
        });

    } catch (error) {
        console.error('Chat Verification Failed:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

verifyChat();
