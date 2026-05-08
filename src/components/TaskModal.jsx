import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useProject } from '../context/ProjectContext';
import { LabelSelector } from './LabelSelector';
import { TaskAIStatus } from './TaskAIStatus';
import { TaskAILog } from './TaskAILog';
import styles from './TaskModal.module.css';
import { useToast } from '../context/ToastContext';

import { useAI } from '../context/AIContext';
import { TaskAIChat } from './TaskAIChat';

// ... imports

export function TaskModal({ isOpen, onClose, task, columnId, project }) {
    const {
        users, addTask, updateTask, currentUser,
        fetchChecklists, addChecklistItem, updateChecklistItem, deleteChecklistItem,
        fetchAttachments, uploadAttachment, deleteAttachment,
        saveCustomFieldValue, updateTaskLabels,
        t
    } = useProject();
    const { setContext, openSidebar } = useAI(); // AI Hook

    // ... existing state

    // Sync AI Context on Open
    useEffect(() => {
        if (isOpen && task) {
            setContext(task, project);
            // Optionally auto-open sidebar if desired, but maybe intrusive.
            // openSidebar(); 
        } else if (!isOpen) {
            setContext(null, null);
        }
    }, [isOpen, task, project, setContext]);

    // ... rest of code
    const { showToast } = useToast();

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');

    const [deadline, setDeadline] = useState('');
    const [assignees, setAssignees] = useState([]);

    // Custom Fields State
    const [customFieldValues, setCustomFieldValues] = useState({});

    // Labels State
    const [selectedLabels, setSelectedLabels] = useState([]);

    // Attachments State
    const [attachments, setAttachments] = useState([]);
    const [isUploading, setIsUploading] = useState(false);

    // Comments State
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [loadingComments, setLoadingComments] = useState(false);

    // Checklist State
    const [checklists, setChecklists] = useState([]);
    const [newChecklistItem, setNewChecklistItem] = useState('');

    const commentsEndRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            if (task) {
                // Initialize with prop data first (for speed)
                setTitle(task.title);
                setDescription(task.description || '');
                setDeadline(task.deadline ? task.deadline.split('T')[0] : '');

                const assigneeIds = task.assignees ? task.assignees.map(a => a.id || a) : [];
                setAssignees(assigneeIds);

                if (task.customFieldValues) {
                    const initialValues = {};
                    task.customFieldValues.forEach(v => {
                        initialValues[v.field_definition_id] = v.value;
                    });
                    setCustomFieldValues(initialValues);
                } else {
                    setCustomFieldValues({});
                }

                setSelectedLabels((task.labels || []).map(l => l.id));

                // FETCH FRESH DATA (Authoritative)
                const fetchFreshTask = async () => {
                    try {
                        const res = await axios.get(`http://localhost:3000/api/tasks/${task.id}`);
                        if (res.data.success) {
                            const fresh = res.data.task;

                            // Update state with fresh data
                            setTitle(prev => prev === task.title ? fresh.title : prev); // Only update if not modified by user? No, we just opened it.
                            // Actually, just overwrite to be safe, user hasn't typed yet since it just opened.
                            setTitle(fresh.title);
                            setDescription(fresh.description || '');
                            setDeadline(fresh.deadline ? fresh.deadline.split('T')[0] : '');

                            setAssignees(fresh.assignees ? fresh.assignees.map(a => a.id || a) : []);
                            setSelectedLabels((fresh.labels || []).map(l => l.id));

                            if (fresh.customFieldValues) {
                                const vals = {};
                                fresh.customFieldValues.forEach(v => {
                                    vals[v.field_definition_id] = v.value;
                                });
                                setCustomFieldValues(vals);
                            }
                        }
                    } catch (e) {
                        console.error("Failed to fetch fresh task data", e);
                    }
                };
                fetchFreshTask();

                // Fetch Comments & Checklists & Attachments
                fetchComments(task.id);
                loadChecklists(task.id);
                loadAttachments(task.id);
            } else {
                // New Task
                setTitle('');
                setDescription('');

                setDeadline('');
                setAssignees([]);
                setCustomFieldValues({});
                setSelectedLabels([]);
                setComments([]);
                setChecklists([]);
                setNewChecklistItem('');
                setAttachments([]);
            }
        }
    }, [isOpen, task]);

    const loadChecklists = async (taskId) => {
        const items = await fetchChecklists(taskId);
        setChecklists(items);
    };

    const loadAttachments = async (taskId) => {
        const items = await fetchAttachments(taskId);
        setAttachments(items);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !task) return;

        setIsUploading(true);
        const newAttachment = await uploadAttachment(task.id, file);
        if (newAttachment) {
            setAttachments(prev => [newAttachment, ...prev]);
            showToast(t('common.success') || 'File uploaded', 'success');
        } else {
            showToast(t('common.error') || 'Failed to upload file', 'error');
        }
        setIsUploading(false);
        e.target.value = null; // Reset input
    };

    const handleDeleteAttachment = async (attachmentId) => {
        if (!confirm(t('common.confirm_delete') || 'Delete this attachment?')) return;
        const success = await deleteAttachment(attachmentId);
        if (success) {
            setAttachments(prev => prev.filter(a => a.id !== attachmentId));
            showToast(t('common.success') || 'Attachment deleted', 'success');
        } else {
            showToast(t('common.error') || 'Failed to delete attachment', 'error');
        }
    };

    const handleAddChecklist = async () => {
        if (!newChecklistItem.trim() || !task) return;
        const newItem = await addChecklistItem(task.id, newChecklistItem);
        if (newItem) {
            setChecklists([...checklists, newItem]);
            setNewChecklistItem('');
        }
    };

    const handleToggleChecklist = async (itemId, isCompleted) => {
        // Optimistic update
        setChecklists(prev => prev.map(item =>
            item.id === itemId ? { ...item, is_completed: isCompleted ? 1 : 0 } : item
        ));

        await updateChecklistItem(itemId, { isCompleted });
        // Could reload from server to be safe, but optimistic is fine for checkboxes
    };

    const handleDeleteChecklist = async (itemId) => {
        if (confirm('Delete this item?')) {
            const success = await deleteChecklistItem(itemId);
            if (success) {
                setChecklists(prev => prev.filter(item => item.id !== itemId));
            }
        }
    };

    const fetchComments = async (taskId) => {
        setLoadingComments(true);
        try {
            // Add timestamp to prevent caching (304 Not Modified)
            const response = await axios.get(`http://localhost:3000/api/tasks/${taskId}/comments?t=${Date.now()}`);
            if (response.data.success) {
                setComments(response.data.comments);
            }
        } catch (error) {
            console.error('Failed to fetch comments:', error);
        } finally {
            setLoadingComments(false);
        }
    };

    const handleCreateComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim() || !task) return;

        try {
            const response = await axios.post(`http://localhost:3000/api/tasks/${task.id}/comments`, {
                userId: currentUser.id,
                content: newComment,
                type: 'comment'
            });

            if (response.data.success) {
                setComments([...comments, response.data.comment]);
                setNewComment('');
                // Scroll to bottom
                setTimeout(() => {
                    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 100);
            }
        } catch (error) {
            console.error('Failed to post comment:', error);
            showToast(t('common.error') || 'Failed to post comment', 'error');
        }
    };

    const toggleAssignee = (userId) => {
        setAssignees(prev => {
            if (prev.includes(userId)) {
                return prev.filter(id => id !== userId);
            } else {
                return [...prev, userId];
            }
        });
    };

    const handleCustomFieldChange = (fieldId, value) => {
        setCustomFieldValues(prev => ({ ...prev, [fieldId]: value }));
        // Auto-save logic if task exists? Or save on submit?
        // User requested "Real-time save" or "Save on input"? 
        // Request: "입력 시 실시간으로 저장되도록 ProjectContext와 연동해줘." (Real-time save)
        // Let's use debounce or just save immediately? For text, debounce is better.
        // For now, let's just save immediately for simplicity or if task exists.
        if (task) {
            // Debounce or just fire? Let's use a small timeout to avoid spamming if typing fast.
            // Or better, save on Blur for text/number. 
            // But requirement says "Real-time".
            // Let's rely on onBlur for inputs in render if possible, or use a debounce here.
            // Given limitations, let's save here but ideally we should debounce.
            // Implementing simple debounce is tricky inside render unless using useEffect/useCallback.
            // Let's just call save.
            saveCustomFieldValue(task.id, fieldId, value);
        }
    };

    // Ideally we should use onBlur/onChange logic properly.
    // Let's modify render inputs to use onBlur for Text/Number to be efficient,
    // but keep onChange for local state update.

    const [isAiExecuting, setIsAiExecuting] = useState(false);
    const [aiStep, setAiStep] = useState(0);
    const [aiLogs, setAiLogs] = useState([]);

    const handleExecuteAI = async () => {
        if (!task) return;
        setIsAiExecuting(true);
        setAiStep(1);
        setAiLogs([]);

        let timeoutId;
        const finishAIExecution = (finalText) => {
            if (timeoutId) clearTimeout(timeoutId);
            setIsAiExecuting(false);
            setAiStep(4);
            console.log('AI Stream Ended - Triggering Final Save');

            // Safe Mode: No optimistic update. Wait for server.
            if (!finalText) {
                console.error('Final Text is empty!');
                showToast(t('ai.error_empty'), 'error');
            } else {
                console.log('Final Text received, length:', finalText.length);
                showToast(t('ai.complete'), 'success');
                // Fetch comments and checklists to get the real data from DB
                setTimeout(() => {
                    fetchComments(task.id);
                    loadChecklists(task.id);
                }, 500);
            }
        };

        // Safety Timeout (30s)
        timeoutId = setTimeout(() => {
            console.warn('[Frontend] AI Timeout - Forcing completion');
            finishAIExecution();
        }, 30000);

        try {
            console.log('[Frontend] Starting AI Stream...');
            const response = await fetch(`http://localhost:3000/api/tasks/${task.id}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.substring(6));

                            if (data.type === 'status') {
                                setAiStep(data.step);
                            } else if (data.type === 'text') {
                                accumulatedText += data.content;
                                setAiLogs(prev => {
                                    const last = prev[prev.length - 1];
                                    if (last && last.startsWith('Output:')) {
                                        return [...prev.slice(0, -1), 'Output: ' + accumulatedText];
                                    }
                                    return [...prev, 'Output: ' + data.content];
                                });
                            } else if (data.type === 'complete') {
                                finishAIExecution(data.result);
                                return; // Stop processing
                            } else if (data.error) {
                                throw new Error(data.error);
                            }
                        } catch (e) {
                            // ignore incomplete json
                        }
                    }
                }
            }
            // Fallback if loop ends without explicit complete event (shouldn't happen with correct server)
            // But if it does, ensure we finish.
            // Check if we already finished in the loop (return above covers it).
            // If we are here, it means stream ended but 'complete' type wasn't received?
            // Let's call finish just in case, using what we have.
            finishAIExecution(accumulatedText);

        } catch (error) {
            console.error('[Frontend] AI Stream failed:', error);
            showToast(t('common.error'), 'error');
            setIsAiExecuting(false);
            if (timeoutId) clearTimeout(timeoutId);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (task) {
            updateTask(task.id, {
                title,
                description,
                deadline,
                assignees
            });

            // Update Labels
            updateTaskLabels(task.id, selectedLabels);

        } else {
            // Updated signature: removed tag
            addTask(project.id, columnId, title, deadline, description, assignees, customFieldValues, selectedLabels);
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className={styles.modalOverlay} onMouseDown={onClose}>
            <div className={styles.modal} onMouseDown={e => e.stopPropagation()}>
                <h2>{task ? t('task.edit') : t('task.add')}</h2>
                <form onSubmit={handleSubmit}>
                    {/* ... form fields ... */}
                    {/* skipping for brevity, handled by existing code around it */}

                    {/* ... */}

                    {/* Main Content & Sidebar Layout */}
                    <div className={styles.modalBodyColumns}>
                        <div className={styles.mainColumn}>
                            <div className={styles.formGroup}>
                                <label>{t('task.title')}</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder={t('task.placeholder_title')}
                                    autoFocus={!task}
                                    required
                                    className={styles.titleInput}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>{t('task.description')}</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder={t('task.placeholder_desc')}
                                    rows={8}
                                    className={styles.descriptionInput}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>{t('task.labels')}</label>
                                <LabelSelector
                                    projectId={project?.id}
                                    selectedLabelIds={selectedLabels}
                                    onChange={setSelectedLabels}
                                />
                            </div>
                        </div>

                        <div className={styles.sidebarColumn}>
                            <div className={styles.sidebarSection}>
                                <label>{t('task.assignees')}</label>
                                <div className={styles.assigneeGrid}>
                                    {users.map(u => (
                                        <div
                                            key={u.id}
                                            className={`${styles.assigneeCard} ${assignees.includes(u.id) ? styles.selected : ''}`}
                                            onClick={() => toggleAssignee(u.id)}
                                            title={u.name}
                                        >
                                            <img src={u.avatar} alt={u.name} />
                                            <span className={styles.assigneeName}>{u.name}</span>
                                            {assignees.includes(u.id) && <div className={styles.selectedCheck}>✓</div>}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.sidebarSection}>
                                <label>{t('task.deadline')}</label>
                                <input
                                    type="date"
                                    value={deadline}
                                    onChange={(e) => setDeadline(e.target.value)}
                                    className={styles.dateInput}
                                />
                            </div>

                            {/* Custom Fields in Sidebar */}
                            {project && project.customFields && project.customFields.length > 0 && (
                                <div className={styles.sidebarSection}>
                                    <label>Additional Fields</label> {/* Should localize */}
                                    <div className={styles.customFieldsStack}>
                                        {project.customFields.map(field => (
                                            <div key={field.id} className={styles.customFieldItem}>
                                                <span className={styles.customFieldLabel}>{field.name}</span>
                                                {field.type === 'text' && (
                                                    <input
                                                        type="text"
                                                        value={customFieldValues[field.id] || ''}
                                                        onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                                                    />
                                                )}
                                                {field.type === 'number' && (
                                                    <input
                                                        type="number"
                                                        value={customFieldValues[field.id] || ''}
                                                        onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                                                    />
                                                )}
                                                {field.type === 'date' && (
                                                    <input
                                                        type="date"
                                                        value={customFieldValues[field.id] || ''}
                                                        onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                                                    />
                                                )}
                                                {field.type === 'dropdown' && (
                                                    <select
                                                        value={customFieldValues[field.id] || ''}
                                                        onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                                                    >
                                                        <option value="">-</option>
                                                        {field.options && field.options.map(opt => (
                                                            <option key={opt} value={opt}>{opt}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ... (retaining existing code structure implicitly via context, but focused replace here) ... */}
                    {/* Actually, I need to place the button in modalActions. 
                        Let's target the modalActions block specifically or use a larger block around it?
                        The View showed lines 400-410.
                    */}

                    <div className={styles.modalActions}>
                        <div className={styles.aiActionWrapper}>
                            {task && (
                                <button
                                    type="button"
                                    className={`${styles.aiBtn} ${isAiExecuting ? styles.aiLoading : ''}`}
                                    onClick={handleExecuteAI}
                                    disabled={isAiExecuting}
                                >
                                    {isAiExecuting ? (
                                        <>
                                            <span className={styles.spinner}></span>
                                            AI Ghostworker Active...
                                        </>
                                    ) : `✨ ${t('ai.btn_execute')}`}
                                </button>
                            )}

                            {/* AI Progress UI - Show if executing or if we have logs/progress */}
                            {(isAiExecuting || aiStep > 0) && (
                                <div className={styles.aiProgressOverlay}>
                                    <TaskAIStatus currentStep={aiStep} />
                                    {/* Show logs if there are any */}
                                    {aiLogs.length > 0 && <TaskAILog logs={aiLogs} />}
                                </div>
                            )}
                        </div>

                        <div className={styles.standardActions}>
                            <button type="button" onClick={onClose} className={styles.cancelBtn}>{t('common.cancel')}</button>
                            <button type="submit" className={styles.primaryBtn}>
                                {task ? t('common.save') : t('common.create')}
                            </button>
                        </div>
                    </div>
                </form>

                {/* Comments Section - Only for existing tasks */}
                {
                    task && (
                        <>
                            {/* Checklist Section */}
                            <div className={styles.checklistSection}>
                                <div className={styles.checklistHeader}>
                                    <h3>{t('task.checklists')}</h3>
                                    {checklists.length > 0 && (
                                        <span className={styles.progressText}>
                                            {Math.round((checklists.filter(i => i.is_completed).length / checklists.length) * 100)}%
                                        </span>
                                    )}
                                </div>

                                {/* Progress Bar */}
                                {checklists.length > 0 && (
                                    <div className={styles.progressBarContainer}>
                                        <div
                                            className={styles.progressBarFill}
                                            style={{ width: `${(checklists.filter(i => i.is_completed).length / checklists.length) * 100}%` }}
                                        />
                                    </div>
                                )}

                                <div className={styles.checklistItems}>
                                    {checklists.map(item => (
                                        <div key={item.id} className={styles.checklistItem}>
                                            <input
                                                type="checkbox"
                                                className={styles.checkbox}
                                                checked={item.is_completed}
                                                onChange={() => handleToggleChecklist(item.id, !item.is_completed)}
                                            />
                                            <div className={`${styles.checklistItemContent} ${item.is_completed ? styles.completed : ''}`}>
                                                {item.content}
                                            </div>
                                            <button
                                                type="button"
                                                className={styles.deleteBtn}
                                                onClick={() => handleDeleteChecklist(item.id)}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="3 6 5 6 21 6"></polyline>
                                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className={styles.checklistInputArea}>
                                    <input
                                        type="text"
                                        className={styles.checklistInput}
                                        placeholder={t('task.new_checklist_item')}
                                        value={newChecklistItem}
                                        onChange={(e) => setNewChecklistItem(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddChecklist();
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className={styles.addBtn}
                                        onClick={handleAddChecklist}
                                        disabled={!newChecklistItem.trim()}
                                    >
                                        {t('common.create')}
                                    </button>
                                </div>
                            </div>

                            {/* Attachments Section */}
                            <div className={styles.attachmentsSection}>
                                <h3>{t('task.attachments')}</h3>
                                <div className={styles.attachmentDropzone}>
                                    <input
                                        type="file"
                                        id="fileUpload"
                                        className={styles.fileInput}
                                        onChange={handleFileUpload}
                                        disabled={isUploading}
                                    />
                                    <label htmlFor="fileUpload" className={styles.fileLabel}>
                                        {isUploading ? t('task.uploading') : t('task.upload_placeholder')}
                                    </label>
                                </div>

                                <div className={styles.attachmentList}>
                                    {attachments.map(file => (
                                        <div key={file.id} className={styles.attachmentItem}>
                                            <div className={styles.attachmentPreview}>
                                                {file.file_type && file.file_type.startsWith('image/') ? (
                                                    <img src={`http://localhost:3000${file.file_path}`} alt={file.file_name} />
                                                ) : (
                                                    <div className={styles.fileIcon}>📄</div>
                                                )}
                                            </div>
                                            <div className={styles.attachmentInfo}>
                                                <a
                                                    href={`http://localhost:3000${file.file_path}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={styles.fileName}
                                                >
                                                    {file.file_name}
                                                </a>
                                                <span className={styles.fileSize}>
                                                    {(file.file_size / 1024).toFixed(1)} KB
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                className={styles.deleteAttachmentBtn}
                                                onClick={() => handleDeleteAttachment(file.id)}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.commentsSection}>
                                <h3>{t('task.comments')}</h3>
                                <div className={styles.commentsList}>
                                    {comments.map(comment => (
                                        <div key={comment.id} className={comment.type === 'activity' ? styles.activityLog : (comment.type === 'ai_result' ? styles.aiResult : styles.commentItem)}>
                                            {comment.type === 'activity' ? (
                                                <>
                                                    <span className={styles.activityIcon}>ℹ️</span>
                                                    <span>
                                                        <strong>{comment.user_name}</strong> {comment.content}
                                                        <span className={styles.timestamp}> • {new Date(comment.created_at).toLocaleString()}</span>
                                                    </span>
                                                </>
                                            ) : comment.type === 'ai_result' ? (
                                                <>
                                                    <div className={styles.aiHeader}>
                                                        <span className={styles.aiIcon}>✨</span>
                                                        <strong>AI Ghostworker</strong>
                                                        <span className={styles.timestamp}> • {new Date(comment.created_at).toLocaleString()}</span>
                                                    </div>
                                                    <div className={styles.aiContent}>
                                                        {/* Simple Markdown Rendering or whitespace preservation */}
                                                        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{comment.content}</pre>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <img src={comment.avatar} alt={comment.user_name} className={styles.commentAvatar} />
                                                    <div className={styles.commentContent}>
                                                        <div className={styles.commentHeader}>
                                                            <span className={styles.userName}>{comment.user_name}</span>
                                                            <span className={styles.timestamp}>{new Date(comment.created_at).toLocaleString()}</span>
                                                        </div>
                                                        <div className={styles.commentText}>{comment.content}</div>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                    <div ref={commentsEndRef} />
                                </div>

                                <form onSubmit={handleCreateComment} className={styles.commentInputArea}>
                                    <textarea
                                        className={styles.commentInput}
                                        value={newComment}
                                        onChange={e => setNewComment(e.target.value)}
                                        placeholder={t('task.write_comment')}
                                    />
                                    <button
                                        type="submit"
                                        className={styles.sendBtn}
                                        disabled={!newComment.trim()}
                                    >
                                        {t('task.add_comment')}
                                    </button>
                                </form>
                            </div>

                            {/* AI Partner Section */}
                            <div className={styles.aiSection}>
                                <h3>AI Partner</h3>
                                <div className={styles.aiChatWrapper}>
                                    <TaskAIChat compact={true} />
                                </div>
                            </div>
                        </>
                    )
                }
            </div >
        </div >
    );
}
