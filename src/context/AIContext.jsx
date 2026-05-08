import React, { createContext, useContext, useState, useCallback } from 'react';

const AIContext = createContext();

export function useAI() {
    return useContext(AIContext);
}

export function AIProvider({ children }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [isThinking, setIsThinking] = useState(false);
    const [activeTask, setActiveTask] = useState(null); // The task currently being viewed/discussed
    const [activeProject, setActiveProject] = useState(null);
    const abortControllerRef = React.useRef(null);

    const toggleSidebar = () => setIsSidebarOpen(prev => !prev);

    const openSidebar = () => setIsSidebarOpen(true);
    const closeSidebar = () => setIsSidebarOpen(false);

    const setContext = (task, project) => {
        if (task && activeTask && task.id !== activeTask.id) {
            setMessages([]); // Clear history when switching tasks
        }
        setActiveTask(task);
        if (project) setActiveProject(project);
    };

    const clearHistory = () => {
        setMessages([]);
    };

    const stopGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    };

    const sendMessage = useCallback(async (text) => {
        if (!text.trim()) return;

        // 1. Add User Message
        const userMsg = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setIsThinking(true);

        // 2. Prepare Payload
        const payload = {
            messages: [...messages, userMsg], // Send history
            taskContext: activeTask ? {
                id: activeTask.id,
                title: activeTask.title,
                description: activeTask.description
            } : null,
            projectContext: activeProject ? {
                id: activeProject.id,
                title: activeProject.title
            } : null
        };

        // Abort previous request if any
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        try {
            // 3. Call API with SSE
            const response = await fetch('http://localhost:3000/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: abortControllerRef.current.signal
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            // Add placeholder for AI response
            setMessages(prev => [...prev, { role: 'ai', content: '' }]);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.replace('data: ', '');
                        try {
                            const data = JSON.parse(dataStr);
                            if (data.type === 'text') {
                                setMessages(prev => {
                                    const newMsgs = [...prev];
                                    if (newMsgs.length > 0) {
                                        const lastMsgIndex = newMsgs.length - 1;
                                        const lastMsg = { ...newMsgs[lastMsgIndex] };
                                        if (lastMsg.role === 'ai') {
                                            lastMsg.content += data.content;
                                            newMsgs[lastMsgIndex] = lastMsg;
                                        }
                                    }
                                    return newMsgs;
                                });
                            }
                        } catch (e) {
                            // ignore parse error for partial chunks
                        }
                    }
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('AI Generation aborted by user.');
            } else {
                console.error("AI Chat Failed", error);
                setMessages(prev => [...prev, { role: 'system', content: "Error: Could not connect to AI." }]);
            }
        } finally {
            setIsThinking(false);
            abortControllerRef.current = null;
        }
    }, [messages, activeTask, activeProject]);

    const value = {
        isSidebarOpen,
        toggleSidebar,
        openSidebar,
        closeSidebar,
        messages,
        sendMessage,
        stopGeneration,
        isThinking,
        activeTask,
        setContext,
        clearHistory,
        setMessages
    };

    return (
        <AIContext.Provider value={value}>
            {children}
        </AIContext.Provider>
    );
}
