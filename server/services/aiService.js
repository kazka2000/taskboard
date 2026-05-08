const axios = require('axios');

class AIService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
        this.pool = null; // DB Connection

        // --- 1. RAG CONTEXT LOAD (Virtual Knowledge Base) ---
        this.knowledgeBase = `
        [DOC: technical_overview_ko.md]
        - Stack: Node.js (Express), React (Vite), MySQL (Sequelize ORM).
        - Auth: JWT (Access/Refresh), BCrypt.
        
        [DOC: project_features.md]
        - Features: Kanban, Drag&Drop, Real-time(Socket.io).
        - Roles: Admin, Member.
        `;
    }

    initialize(pool) {
        this.pool = pool;
    }

    async saveMessage(taskId, role, content) {
        if (!this.pool) return;
        try {
            await this.pool.execute(
                'INSERT INTO task_ai_chats (task_id, role, content) VALUES (?, ?, ?)',
                [taskId, role, content]
            );
        } catch (error) {
            console.error('[AIService] Failed to save message:', error);
        }
    }

    async getChatHistory(taskId) {
        if (!this.pool) return [];
        try {
            const [rows] = await this.pool.execute(
                'SELECT role, content FROM task_ai_chats WHERE task_id = ? ORDER BY created_at ASC',
                [taskId]
            );
            return rows;
        } catch (error) {
            console.error('[AIService] Failed to fetch chat history:', error);
            return [];
        }
    }

    // Helper to execute actions (Checklist, Move Task)
    async handleAction(action, taskContext) {
        if (!this.pool) return { success: false, message: "Server DB not connected." };
        if (!taskContext || !taskContext.id) return { success: false, message: "No active task context." };

        console.log('[AIService] Executing Action:', action);

        try {
            if (action.type === 'CREATE_CHECKLIST') {
                const items = action.items || [];
                if (items.length === 0) return { success: false, message: "No items to add." };

                for (const item of items) {
                    await this.pool.execute(
                        'INSERT INTO task_checklists (task_id, content, is_completed) VALUES (?, ?, 0)',
                        [taskContext.id, item]
                    );
                }
                return { success: true, message: `Added ${items.length} items to checklist.` };
            }

            if (action.type === 'MOVE_TASK') {
                const targetStatus = action.targetStatus; // 'NEXT', 'Done', etc.

                if (!targetStatus) return { success: false, message: "Missing target status." };

                // Get project_id and current list_id from DB based on taskContext.id
                const [taskRows] = await this.pool.execute(
                    'SELECT project_id, list_id FROM tasks WHERE id = ?',
                    [taskContext.id]
                );

                if (taskRows.length === 0) return { success: false, message: "Task not found." };

                const projectId = taskRows[0].project_id;
                const currentListId = taskRows[0].list_id;

                let newListId = null;

                if (targetStatus === 'NEXT') {
                    // Fetch all lists for this project ordered by position
                    const [lists] = await this.pool.execute(
                        'SELECT id FROM project_lists WHERE project_id = ? ORDER BY position ASC',
                        [projectId]
                    );

                    // Find index of current list
                    const currentIndex = lists.findIndex(l => l.id === currentListId);

                    if (currentIndex === -1) {
                        return { success: false, message: "Current task list not found in project." };
                    }

                    if (currentIndex < lists.length - 1) {
                        newListId = lists[currentIndex + 1].id;
                    } else {
                        return { success: false, message: "Task is already in the last stage." };
                    }

                } else {
                    // Find by explicit name (e.g., 'Done')
                    const [rows] = await this.pool.execute(
                        'SELECT id FROM project_lists WHERE project_id = ? AND title LIKE ? LIMIT 1',
                        [projectId, `%${targetStatus}%`]
                    );

                    if (rows.length === 0) return { success: false, message: `List "${targetStatus}" not found.` };
                    newListId = rows[0].id;
                }

                if (newListId === currentListId) {
                    return { success: true, message: "Task is already in the target status." };
                }

                await this.pool.execute(
                    'UPDATE tasks SET list_id = ? WHERE id = ?',
                    [newListId, taskContext.id]
                );

                return { success: true, message: `Moved task to newly determined status list.` };
            }

            if (action.type === 'UPDATE_DEADLINE') {
                const date = action.date; // YYYY-MM-DD
                if (!date) return { success: false, message: "Missing deadline date." };

                await this.pool.execute(
                    'UPDATE tasks SET deadline = ? WHERE id = ?',
                    [date, taskContext.id]
                );

                // Calculate changes for EventService
                const changes = ['deadline'];
                const updates = { deadline: date };

                try {
                    const eventService = require('./eventService'); // Assuming eventService is in the same directory
                    const [proj] = await this.pool.execute('SELECT project_id, title FROM tasks WHERE id = ?', [taskContext.id]);
                    if (proj.length > 0) {
                        await eventService.emit('TASK_UPDATED', {
                            projectId: proj[0].project_id,
                            taskId: taskContext.id,
                            changes,
                            updates,
                            taskTitle: proj[0].title
                        });
                    }
                } catch (e) {
                    console.error("Failed to emit TASK_UPDATED from AI Action:", e);
                }

                return { success: true, message: `Task deadline updated to ${date}.` };
            }

            if (action.type === 'UPDATE_ASSIGNEES') {
                const usernames = action.users || [];
                if (usernames.length === 0) return { success: false, message: "No assignees provided." };

                // Get task's project ID
                const [taskRows] = await this.pool.execute(
                    'SELECT project_id FROM tasks WHERE id = ?',
                    [taskContext.id]
                );
                if (taskRows.length === 0) return { success: false, message: "Task not found." };
                const projectId = taskRows[0].project_id;

                // Find user IDs correctly scoped to the project
                // Note: pm.project_id might be missing or user might just be in the system.
                let placeholders = usernames.map(() => '?').join(',');
                const [userRows] = await this.pool.execute(
                    `SELECT id, username FROM users WHERE username IN (${placeholders})`,
                    [...usernames]
                );

                if (userRows.length === 0) return { success: false, message: "None of the provided users are valid system users." };

                // Clear existing assignees and insert new ones
                await this.pool.execute('DELETE FROM task_assignees WHERE task_id = ?', [taskContext.id]);
                for (const user of userRows) {
                    await this.pool.execute(
                        'INSERT INTO task_assignees (task_id, user_id) VALUES (?, ?)',
                        [taskContext.id, user.id]
                    );
                }

                try {
                    const eventService = require('./eventService');
                    const [proj] = await this.pool.execute('SELECT project_id, title FROM tasks WHERE id = ?', [taskContext.id]);
                    if (proj.length > 0) {
                        await eventService.emit('TASK_UPDATED', {
                            projectId: proj[0].project_id,
                            taskId: taskContext.id,
                            changes: ['assignees'],
                            updates: {},
                            assignees: { new: userRows.map(u => u.id) },
                            taskTitle: proj[0].title
                        });
                    }
                } catch (e) {
                    console.error("Failed to emit TASK_UPDATED (assignees) from AI Action:", e);
                }

                return { success: true, message: `Assigned task to: ${userRows.map(u => u.username).join(', ')}.` };
            }

            return { success: false, message: "Unknown action type." };

        } catch (error) {
            console.error('[AIService] Action failed:', error);
            return { success: false, message: "Action execution failed." };
        }
    }

    async * executeTaskStream({ title, description }) {
        console.log(`[AIService] Stream Start: ${title} `);

        // Dynamic Steps based on title keywords
        const isSecurity = /security|cve|취약점|auth/i.test(title + description);
        const isDesign = /ui|ux|design|color|css/i.test(title + description);

        let step1 = '요구사항 분석 중...';
        let step2 = '설계 및 전략 수립 중...';
        let step3 = '최종 솔루션 작성 중...';

        if (isSecurity) {
            step1 = 'CVE 취약점 데이터베이스 조회 중...';
            step2 = '공격 벡터 시뮬레이션 및 방어책 수립...';
            step3 = '보안 패치 코드 생성 중...';
        } else if (isDesign) {
            step1 = 'UX/UI 디자인 패턴 분석 중...';
            step2 = '색상 팔레트 및 접근성 진단...';
            step3 = 'CSS 스타일 코드 생성 중...';
        }

        yield { type: 'status', step: 1, message: step1 };
        await new Promise(resolve => setTimeout(resolve, 800));

        yield { type: 'status', step: 2, message: step2 };
        await new Promise(resolve => setTimeout(resolve, 1000));

        yield { type: 'status', step: 3, message: step3 };
        await new Promise(resolve => setTimeout(resolve, 800));

        let fullContent = '';
        if (this.apiKey) {
            try {
                fullContent = await this.callGemini({ title, description });
            } catch (error) {
                console.error('[AIService] API Error, using mock:', error);
                fullContent = await this.getMockResponse({ title, description });
            }
        } else {
            fullContent = await this.getMockResponse({ title, description });
        }

        const chunkSize = 5;
        for (let i = 0; i < fullContent.length; i += chunkSize) {
            yield { type: 'text', content: fullContent.slice(i, i + chunkSize) };
            await new Promise(r => setTimeout(r, 10));
        }

        yield { type: 'done', fullContent };
    }

    async executeTask({ title, description }) {
        if (this.apiKey) {
            try {
                return await this.callGemini({ title, description });
            } catch (error) {
                return this.getMockResponse({ title, description });
            }
        } else {
            return this.getMockResponse({ title, description });
        }
    }

    async callWithRetry(fn, retries = 3, delay = 1000, streamYield = null) {
        try {
            return await fn();
        } catch (error) {
            if (retries > 0 && (error.response?.status === 503 || error.response?.status === 429)) {
                let waitTime = delay;

                // Parse specific "Please retry in Xs." from Gemini 429 error message
                if (error.response?.status === 429 && error.response.data?.error?.message) {
                    const match = error.response.data.error.message.match(/retry in ([\d\.]+)s/);
                    if (match && match[1]) {
                        waitTime = (parseFloat(match[1]) * 1000) + 500; // Add 0.5s safety buffer
                    }
                }

                const waitSeconds = Math.ceil(waitTime / 1000);
                console.warn(`[AIService] API Error ${error.response.status}. Retrying in ${Math.round(waitTime)}ms... (${retries} retries left)`);

                if (streamYield && error.response?.status === 429) {
                    streamYield({ type: 'text', content: `\n\n⏳ **API 할당량 대기 중**: 구글 제미나이 무료 제공량 초과로 약 ${waitSeconds}초 대기 후 자동으로 재시도합니다...\n\n` });
                }

                await new Promise(res => setTimeout(res, waitTime));
                return this.callWithRetry(fn, retries - 1, delay * 2, streamYield);
            }
            throw error;
        }
    }

    async callGemini({ title, description }) {
        const descriptionText = description || "No description provided.";

        // --- DYNAMIC PERSONA PROMPT ---
        const prompt = `
INTERNAL_CONTEXT:
        ${this.knowledgeBase}

USER_TASK:
Title: "${title}"
Description: "${descriptionText}"

INSTRUCTIONS:
1. ** Identity **: You are a ** 20 - year Authority ** in the field of ** "${title}" **. 
           - If Title is "CVE Fix", you are a Global Top - tier Security Engineer.
           - If Title is "UI Redesign", you are a Senior UX / UI Designer.
        2. ** Direct Execution **:
- Start IMMEDIATELY with the solution.
           - NO intros like "Based on the internal docs..." or "The project uses Node.js...".
           - Provide actionable code, commands, or design specs directly.
        3. ** Evidence **:
- Use \`[doc: filename]\` tags ONLY if using facts from internal context.
           - Use \`[standard: name]\` for external standards (e.g., [standard: OWASP]).
        4. **Format**:
           - Use Markdown.
           - **Bold** key terms.
           - Korean Language (한국어).

        Generate the Expert Report now.
        `;

        return this.callWithRetry(async () => {
            const response = await axios.post(
                `${this.apiUrl}?key=${this.apiKey}`,
                { contents: [{ parts: [{ text: prompt }] }] },
                { headers: { 'Content-Type': 'application/json' } }
            );

            if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                return response.data.candidates[0].content.parts[0].text;
            }
            throw new Error('Invalid Gemini Response');
        });
    }

    getMockResponse({ title, description }) {
        const text = (title + ' ' + description).toLowerCase();

        return new Promise(resolve => {
            setTimeout(() => {
                let content = '';

                // --- DYNAMIC MOCK RESPONSES ---

                if (text.includes('cve') || text.includes('security') || text.includes('취약점')) {
                    content = `
### 🛡️ [Security] 긴급 보안 조치 리포트

**Vulnerability Analysis (CVE-202X-XXXX):**
해당 취약점은 권한 없는 사용자가 관리자 API에 접근할 수 있는 **Critical** 등급의 이슈입니다. 현재 **JWT 미들웨어**의 서명 검증 로직을 우회할 수 있습니다.

---

#### 1. 긴급 패치 코드 (Immediate Patch)
**File: \`server/middleware/auth.js\`**

\`\`\`javascript
const verifyToken = (req, res, next) => {
    // [Fix] 알고리즘 강제 지정으로 'None' 공격 차단
    if (!token) return res.status(401).send('Access Denied');
    
    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ['HS256'] // **강제 지정 필수**
        });
        req.user = verified;
        next();
    } catch (err) {
        res.status(400).send('Invalid Token');
    }
};
\`\`\`

#### 2. 방화벽 설정 (Firewall)
\`\`\`bash
# 의심 IP 대역 긴급 차단
iptables -A INPUT -s 192.168.0.100 -j DROP
\`\`\`
                    `;
                }
                else if (text.includes('ui') || text.includes('design') || text.includes('color') || text.includes('css')) {
                    content = `
### 🎨 [Design] UI/UX 개선 제안서

**Design Audit:**
요청하신 **UI 색상 변경**에 대해, 현재의 무채색 톤에서 **브랜드 컬러(Primary Blue)**를 강조하는 방향으로 개선안을 제시합니다. **접근성(a11y)** 기준 명도 대비 4.5:1을 준수해야 합니다.

---

#### 1. CSS 변수 재정의 (Variables)
**File: \`src/index.css\`**

\`\`\`css
:root {
    /* **New Brand Palette** */
    --primary-color: #0052cc; /* Deep Blue for Trust */
    --primary-hover: #0747a6;
    --text-on-primary: #ffffff;
    
    /* Accessibility High Contrast */
    --text-primary: #172b4d; 
    --bg-surface: #ffffff;
}
\`\`\`
                    `;
                }
                else if (text.includes('db') || text.includes('query') || text.includes('sql')) {
                    content = `
### 💾 [Database] 쿼리 최적화 보고서

**Performance Issue:**
요청하신 쿼리는 **Full Table Scan**이 발생하고 있습니다. 인덱스 추가가 시급합니다.

---

#### 1. 인덱스 생성 (Migration)
\`\`\`sql
CREATE INDEX idx_tasks_project_id_status ON tasks (project_id, status);
\`\`\`
                    `;
                }
                else {
                    content = `
### 📋 [General] 전문가 분석 리포트

**Analysis:**
요청하신 **"${title}"** 업무에 대해 20년 차 전문가 관점에서 분석한 결과입니다. 현재 프로젝트 구조 **\`[technical_overview_ko.md]\`**를 기반으로 최적의 솔루션을 제안합니다.

---

#### 1. 실행 가이드 (Action Plan)
- **Step 1**: 요구사항의 모호성을 제거하기 위해 기획서를 구체화하십시오.
- **Step 2**: 기존 모듈과의 결합도를 낮추는 방향으로 설계를 진행하십시오.
                    `;
                }

                resolve(content);
            }, 800);
        });
    }

    async * chatStream({ messages, taskContext, projectContext, streamContext = { aborted: false } }) {
        const effectiveTitle = taskContext?.title || projectContext?.title || 'General';
        console.log(`[AIService] Chat Stream Start. Context: ${effectiveTitle}. API Key Present: ${!!this.apiKey}`);

        let fullAiResponse = '';

        // 1. Save User Message to DB
        if (taskContext?.id) {
            const lastUserMsg = messages[messages.length - 1];
            if (lastUserMsg && lastUserMsg.role === 'user') {
                await this.saveMessage(taskContext.id, 'user', lastUserMsg.content);
            }
        }

        let projectListsInfo = 'N/A';
        let projectMembersInfo = 'N/A';
        let projectLabelsInfo = 'N/A';
        let metadataInfo = '';

        if (projectContext?.id && this.pool) {
            try {
                // Fetch Lists
                const [lists] = await this.pool.execute(
                    'SELECT title FROM project_lists WHERE project_id = ? ORDER BY position ASC',
                    [projectContext.id]
                );
                if (lists.length > 0) {
                    projectListsInfo = lists.map(l => `"${l.title}"`).join(', ');
                }

                // Fetch Members (Changed to all users as per user request context)
                const [members] = await this.pool.execute(
                    'SELECT id, username, name FROM users'
                );
                if (members.length > 0) {
                    projectMembersInfo = members.map(m => `"${m.username}" (${m.name})`).join(', ');
                }

            } catch (e) {
                console.error("Error fetching project context items (lists/members):", e);
            }
        }

        if (taskContext?.id && this.pool) {
            try {
                // Fetch Task Relational Metadata Concurrently
                const [
                    [checklists],
                    [comments],
                    [attachments]
                ] = await Promise.all([
                    this.pool.execute('SELECT content, is_completed FROM task_checklists WHERE task_id = ?', [taskContext.id]),
                    this.pool.execute('SELECT content, created_at FROM task_comments WHERE task_id = ? ORDER BY created_at ASC', [taskContext.id]),
                    this.pool.execute('SELECT file_name FROM task_attachments WHERE task_id = ?', [taskContext.id])
                ]);

                metadataInfo += `\n        **Checklists:**\n`;
                if (checklists.length > 0) {
                    metadataInfo += checklists.map(c => `        - [${c.is_completed ? 'x' : ' '}] ${c.content}`).join('\n');
                } else {
                    metadataInfo += `        (No checklists)`
                }

                metadataInfo += `\n\n        **Comments (Chronological):**\n`;
                if (comments.length > 0) {
                    metadataInfo += comments.map(c => `        - "${c.content}" (at ${new Date(c.created_at).toLocaleString()})`).join('\n');
                } else {
                    metadataInfo += `        (No comments)`
                }

                metadataInfo += `\n\n        **Attachments:**\n`;
                if (attachments.length > 0) {
                    metadataInfo += attachments.map(a => `        - [FILE]: ${a.file_name}`).join('\n');
                } else {
                    metadataInfo += `        (No attachments)`
                }

            } catch (e) {
                console.error("Error fetching task metadata for AI context:", e);
                metadataInfo = "(Error loading metadata)";
            }
        }

        // Construct Chat Prompt
        const systemPrompt = `
        **ROLE**:
        You are a **Senior Technical Partner** for the "TaskBoard" project tool.
        You are an expert in Software Engineering, Security (CVE analysis), and Project Management.

        **CONTEXT**:
        - **Current Date**: ${new Date().toLocaleDateString('ko-KR')} (Today's Date)
        - **Project**: ${projectContext?.title || 'Unknown Project'}
        - **Available Project Lists (Stages)**: ${projectListsInfo}
        - **Available Project Members (Users)**: ${projectMembersInfo}
        - **Active Task**: ${taskContext ? `"${taskContext.title}" (ID: ${taskContext.id})` : 'None (Global Dashboard)'}
        - **Task Details**: "${taskContext?.description || 'N/A'}"
        
        **TASK METADATA (CURRENT STATE)**:
        ${metadataInfo}

        **INTERNAL KNOWLEDGE**:
        ${this.knowledgeBase}

        **INSTRUCTIONS**:
        1. **Objective**: Provide concrete, actionable technical advice. Avoid generic fluff.
        2. **Security Tasks**: If the user asks about CVEs, providing specific remediation steps (code patches, config changes).
        3. **Tone**: Professional, precise, and helpful. 
        4. **Language Restrictions (CRITICAL)**: You MUST respond entirely in the Korean language. Do NOT use English unless it is for a technical programming term, property, or code snippet. Everything else must be translated to Korean.
        5. **Format**: Use Markdown (Code blocks, bold text).
        6. **Actions (CRITICAL)**: If the user requests to CREATE a checklist, MOVE a task, or UPDATE task attributes (deadline, assignees), you MUST append a JSON action block at the END of your response. 
           - To create a checklist: \`[ACTION: {"type": "CREATE_CHECKLIST", "items": ["Item 1", "Item 2"]}]\`
           - To move a task to a specific stage (e.g., "Review"): \`[ACTION: {"type": "MOVE_TASK", "targetStatus": "Review"}]\`
           - To update the deadline: \`[ACTION: {"type": "UPDATE_DEADLINE", "date": "YYYY-MM-DD"}]\`
           - To update assignees (use ONLY valid names from 'Available Project Members'): \`[ACTION: {"type": "UPDATE_ASSIGNEES", "users": ["username1"]}]\`
        7. **Constraints**: 
           - When moving a task, target only the exact list names provided, or "NEXT", or "Done".
           - When updating assignees, NEVER make up names. ONLY use 'username's provided in the 'Available...' lists above. You can match the real name to the username.
        8. **Action Confirmation**: If you output a JSON action block, DO NOT write any conversational text acknowledging the action (e.g. do NOT write "마감일을 변경했습니다"). The system will automatically show a success message.

        **CONVERSATION HISTORY**:
        ${messages.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n')}
        [SYSTEM]: (CRITICAL REMINDER: You MUST answer entirely in Korean language. Do not output English sentences. Any JSON Action block MUST be placed at the very end of your response.)
        
        **YOUR RESPONSE**:
        `;

        if (this.apiKey) {
            try {
                // Yield early "Thinking" message to improve perceived latency
                yield { type: 'text', content: '🤔 질문을 분석하고 답변을 생성하는 중입니다...\n\n' };

                // Gemini API Call with native retry loop to support generator yielding
                let response = null;
                let retries = 3;
                let delay = 1000;

                while (retries > 0) {
                    try {
                        response = await axios.post(
                            `${this.apiUrl}?key=${this.apiKey}`,
                            {
                                contents: [{ parts: [{ text: systemPrompt }] }],
                                generationConfig: {
                                    temperature: 0.7,
                                    maxOutputTokens: 8192,
                                }
                            },
                            { headers: { 'Content-Type': 'application/json' } }
                        );
                        break; // Success
                    } catch (error) {
                        if (retries > 1 && (error.response?.status === 503 || error.response?.status === 429)) {
                            let waitTime = delay;
                            if (error.response?.status === 429 && error.response.data?.error?.message) {
                                const match = error.response.data.error.message.match(/retry in ([\d\.]+)s/);
                                if (match && match[1]) {
                                    waitTime = (parseFloat(match[1]) * 1000) + 500;
                                }
                            }
                            const waitSeconds = Math.ceil(waitTime / 1000);

                            if (error.response?.status === 429) {
                                const waitMsg = `\n\n⏳ **API 할당량 초과**: 구글 제미나이 무료 제공량(분당 15회) 초과로 서버가 대기 상태에 진입했습니다. 약 ${waitSeconds}초 후 자동으로 재시도합니다...\n\n`;
                                fullAiResponse += waitMsg;
                                yield { type: 'text', content: waitMsg };
                            }

                            console.warn(`[AIService] API Error ${error.response.status}. Retrying in ${Math.round(waitTime)}ms... (${retries - 1} retries left)`);
                            await new Promise(res => setTimeout(res, waitTime));
                            retries--;
                            delay *= 2;
                        } else {
                            throw error; // Out of retries or non-retriable error
                        }
                    }
                }

                if (!response) {
                    throw new Error('Failed to get a valid response from Gemini after retries.');
                }


                const candidate = response.data?.candidates?.[0];
                const text = candidate?.content?.parts?.[0]?.text;

                if (!text) {
                    throw new Error('Empty response from Gemini');
                }

                // Extract conversational text and JSON action block
                const actionMatch = text.match(/\[ACTION:\s*(\{[\s\S]*?\})\s*\]/);
                let conversationalText = text;

                if (actionMatch) {
                    conversationalText = text.replace(actionMatch[0], '').trim();
                }

                // Stream conversational text first
                if (conversationalText) {
                    fullAiResponse += conversationalText;
                    const chunkSize = 20;
                    for (let i = 0; i < conversationalText.length; i += chunkSize) {
                        if (streamContext.aborted) {
                            const abortMsg = `\n\n*(사용자에 의해 중단된 답변입니다)*`;
                            fullAiResponse += abortMsg;
                            yield { type: 'text', content: abortMsg };
                            break;
                        }
                        yield { type: 'text', content: conversationalText.slice(i, i + chunkSize) };
                        await new Promise(r => setTimeout(r, 10)); // Faster stream
                    }
                }

                // Execute action if present (only if not aborted)
                if (actionMatch && !streamContext.aborted) {
                    try {
                        const actionData = JSON.parse(actionMatch[1]);
                        const result = await this.handleAction(actionData, taskContext);

                        // Localized string translation for action result
                        let localizedMessage = result.message;
                        if (localizedMessage.includes("Added") && localizedMessage.includes("items to checklist")) {
                            const count = localizedMessage.match(/\d+/)[0];
                            localizedMessage = `체크리스트에 ${count}개의 항목을 추가했습니다.`;
                        } else if (localizedMessage.includes("Moved task to newly determined status list")) {
                            localizedMessage = `태스크 상태를 요청하신 단계로 이동했습니다.`;
                        } else if (localizedMessage.includes("Task is already in the target status")) {
                            localizedMessage = `태스크가 이미 해당 상태에 있습니다.`;
                        } else if (localizedMessage.includes("Task deadline updated to")) {
                            const date = localizedMessage.split("to ")[1].replace(".", "");
                            localizedMessage = `마감일을 ${date}로 변경했습니다.`;
                        } else if (localizedMessage.includes("Assigned task to:")) {
                            const users = localizedMessage.split("to: ")[1].replace(".", "");
                            localizedMessage = `담당자를 변경했습니다: ${users}`;
                        } else if (localizedMessage.includes("Applied labels:")) {
                            const labels = localizedMessage.split("labels: ")[1].replace(".", "");
                            localizedMessage = `라벨을 적용했습니다: ${labels}`;
                        }

                        const actionMsg = `\n\n✅ **동작 완료**: ${localizedMessage}\n`;
                        fullAiResponse += actionMsg;
                        yield { type: 'text', content: actionMsg };

                    } catch (e) {
                        console.error('Failed to parse/execute action:', e);
                        const errorMsg = `\n\n⚠️ **동작 실패**: ${e.message}\n`;
                        fullAiResponse += errorMsg;
                        yield { type: 'text', content: errorMsg };
                    }
                }

            } catch (error) {
                console.error('[AIService] API Error:', error.response?.data || error.message);

                const isRateLimit = error.response?.status === 429 || error.message.includes('429');

                if (isRateLimit) {
                    const errorResponse = `⚠️ **AI 연결 지연**: AI API의 무료 제공량(분당 15회)을 초과했습니다. 약 1분 후 다시 시도해주세요.\n`;
                    fullAiResponse += errorResponse;
                    yield { type: 'text', content: errorResponse };
                } else {
                    const errorResponse = `⚠️ **AI 연결 실패**: ${error.message}\n(API Key 상태를 확인해주세요. 현재 Mock 모드로 전환합니다.)\n\n`;
                    fullAiResponse += errorResponse;
                    yield { type: 'text', content: errorResponse };

                    // Fallback to Mock
                    for await (const chunk of this.generateMockStream(messages, taskContext, streamContext)) {
                        fullAiResponse += chunk.content;
                        yield chunk;
                        if (streamContext.aborted) break;
                    }
                }
            }
        } else {
            // Mock Chat Response
            console.warn('[AIService] No API Key found. Using Mock.');
            for await (const chunk of this.generateMockStream(messages, taskContext, streamContext)) {
                fullAiResponse += chunk.content;
                yield chunk;
                if (streamContext.aborted) break;
            }
        }

        // Save AI Response to DB (Mock or Real)
        if (taskContext?.id && fullAiResponse) {
            await this.saveMessage(taskContext.id, 'ai', fullAiResponse);
        }

        yield { type: 'done' };
    }

    async * generateMockStream(messages, taskContext, streamContext = { aborted: false }) {
        const lastMsg = messages[messages.length - 1].content.toLowerCase();
        let reply = '';

        if (lastMsg.includes('cve') || lastMsg.includes('취약점') || lastMsg.includes('security')) {
            reply = `
**[Mock Mode] CVE 취약점 분석 리포트**

요청하신 취약점(CVE-2018-6294 ~ 6303)은 주로 **오픈소스 라이브러리**의 구버전 사용으로 발생합니다.

**조치 가이드:**
1. \`package.json\`에서 의존성 버전을 점검하십시오.
2. 다음 명령어로 패키지를 업데이트하세요:
   \`\`\`bash
   npm audit fix
   \`\`\`
3. 만약 문제가 지속된다면, WAF 설정을 검토해야 합니다.

(※ 실제 AI 답변을 보려면 \`GEMINI_API_KEY\` 환경변수를 설정하세요.)
            `;
        } else if (taskContext) {
            reply = `**[Mock Mode]** "${taskContext.title}" 태스크에 대해 궁금하신가요? 
현재 AI API 키가 설정되지 않아 상세 분석이 어렵습니다. 
API 키를 연동하면 코드 레벨의 조언을 드릴 수 있습니다.`;
        } else {
            reply = `**[Mock Mode]** 안녕하세요! 무엇을 도와드릴까요? (API Key를 설정하면 더 똑똑해집니다.)`;
        }

        const chunkSize = 10;
        for (let i = 0; i < reply.length; i += chunkSize) {
            if (streamContext.aborted) {
                const abortMsg = `\n\n*(사용자에 의해 중단된 답변입니다)*`;
                yield { type: 'text', content: abortMsg };
                break;
            }
            yield { type: 'text', content: reply.slice(i, i + chunkSize) };
            await new Promise(r => setTimeout(r, 30));
        }
    }
}

module.exports = new AIService();
