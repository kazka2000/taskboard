import React, { useState, useEffect, useRef } from 'react';
import { useAI } from '../context/AIContext';
import styles from './TaskAIChat.module.css';
import { Send, Bot, User, CheckCircle } from 'lucide-react';
import axios from 'axios'; // Import axios

export function TaskAIChat({ compact = false }) {
    const { messages, sendMessage, stopGeneration, isThinking, activeTask, clearHistory, setMessages } = useAI();
    const [input, setInput] = useState('');
    const messagesAreaRef = useRef(null);

    useEffect(() => {
        if (activeTask) {
            // Load Chat History
            axios.get(`http://localhost:3000/api/tasks/${activeTask.id}/ai-chat`)
                .then(res => {
                    if (res.data.success) {
                        setMessages(res.data.history.map(msg => ({
                            role: msg.role,
                            content: msg.content
                        })));
                    }
                })
                .catch(err => console.error("Failed to load chat history:", err));
        } else {
            setMessages([]);
        }
    }, [activeTask, setMessages]); // Added setMessages to dependency array

    const scrollToBottom = () => {
        if (messagesAreaRef.current) {
            const scrollHeight = messagesAreaRef.current.scrollHeight;
            messagesAreaRef.current.scrollTo({
                top: scrollHeight,
                behavior: "smooth"
            });
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isThinking]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const text = input;
        setInput('');
        await sendMessage(text);
    };

    return (
        <div className={`${styles.chatContainer} ${compact ? styles.compact : ''}`}>
            {!compact && (
                <div className={styles.header}>
                    <div className={styles.title}>
                        <Bot size={18} className={styles.botIcon} />
                        <span>AI Partner</span>
                    </div>
                    <button onClick={clearHistory} className={styles.clearBtn} title="대화 초기화">
                        Clear
                    </button>
                </div>
            )}

            <div className={styles.messagesArea} ref={messagesAreaRef}>
                {messages.length === 0 && (
                    <div className={styles.emptyState}>
                        <Bot size={32} />
                        <p>
                            {activeTask
                                ? `"${activeTask.title}"에 대해 무엇이든 물어보세요.`
                                : "안녕하세요! 오늘 어떤 업무를 도와드릴까요?"}
                        </p>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`${styles.messageRow} ${msg.role === 'user' ? styles.userRow : styles.aiRow}`}>
                        <div className={styles.bubble}>
                            {msg.role === 'ai' && <Bot size={14} className={styles.msgIcon} />}
                            <div className={styles.content}>
                                {msg.content.split('\n').map((line, i) => (
                                    <p key={i}>{line}</p> // Simple text rendering for now, can upgrade to Markdown later
                                ))}
                            </div>
                        </div>
                    </div>
                ))}

                {isThinking && (
                    <div className={`${styles.messageRow} ${styles.aiRow}`}>
                        <div className={`${styles.bubble} ${styles.thinking}`}>
                            <span>...</span>
                        </div>
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className={styles.inputArea}>
                <div className={styles.inputWrapper}>
                    {activeTask && activeTask.description && (
                        <button
                            type="button"
                            className={styles.loadDescBtn}
                            onClick={() => setInput(prev => (prev ? prev + '\n' : '') + `다음 내용을 바탕으로 답변해줘:\n\n${activeTask.description}`)}
                            title="태스크 설명 불러오기"
                        >
                            📋 설명 가져오기
                        </button>
                    )}
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={activeTask ? "이 태스크에 대해 질문하기..." : "무엇을 도와드릴까요?"}
                        className={styles.input}
                    />
                </div>
                {isThinking ? (
                    <button type="button" onClick={stopGeneration} className={`${styles.sendBtn} ${styles.stopBtn}`} title="답변 중단">
                        <span style={{ fontSize: '10px' }}>■</span>
                    </button>
                ) : (
                    <button type="submit" disabled={!input.trim()} className={styles.sendBtn} title="전송">
                        <Send size={16} />
                    </button>
                )}
            </form>
        </div>
    );
}
