const { sendWebhook } = require('../utils/webhookSender');

class EventService {
    constructor() {
        this.io = null;
        this.pool = null;
    }

    initialize(io, pool) {
        this.io = io;
        this.pool = pool;
    }

    async emit(eventName, data, connection) {
        // Log event for debugging
        console.log(`[EventService] Event: ${eventName}`, JSON.stringify(data, null, 2));

        // Use provided connection or fallback to pool
        const db = connection || this.pool;

        if (!db) {
            console.error('[EventService] No database connection or pool available for event:', eventName);
            return;
        }

        try {
            switch (eventName) {
                case 'TASK_CREATED':
                    await this.handleTaskCreated(data, db);
                    break;
                case 'TASK_MOVED':
                    await this.handleTaskMoved(data, db);
                    break;
                case 'TASK_UPDATED':
                    await this.handleTaskUpdated(data, db);
                    break;
                case 'TASK_COMPLETED':
                    await this.handleTaskCompleted(data, db);
                    break;
                case 'COMMENT_ADDED':
                    await this.handleCommentAdded(data, db);
                    break;
                case 'CHECKLIST_UPDATED':
                    await this.handleChecklistUpdated(data, db);
                    break;
                case 'URGENT_COMMENT':
                    await this.handleUrgentComment(data, db);
                    break;
                default:
                    console.warn(`[EventService] Unhandled event: ${eventName}`);
            }

            // Hook: Automation Engine
            await this.checkAutomationRules(eventName, data, db);

        } catch (error) {
            console.error(`[EventService] Error handling event ${eventName}:`, error);
        }
    }

    // --- Specific Event Handlers ---

    async handleTaskCreated(data, connection) {
        const { projectId, taskId, title, listId, assignees, actorName } = data;

        // 1. Broadcast
        this.broadcastToProject(projectId, 'taskCreated', { taskId, title, listId });

        // 2. Notifications
        if (assignees && assignees.length > 0) {
            for (const userId of assignees) {
                const message = JSON.stringify({
                    code: 'notification.task_assigned',
                    params: {
                        actor: actorName || 'System',
                        task: title
                    }
                });
                await this.createNotification(connection, userId, 'assigned', message);
            }
        }

        // 3. Webhooks
        await this.triggerProjectWebhooks(connection, projectId, 'TASK_CREATED', {
            actorName: data.actorName || 'System',
            taskTitle: title
        });
    }

    async handleTaskMoved(data, connection) {
        const { projectId, taskId, listId, newPosition, userId, listTitle, oldListTitle, actorName, taskTitle } = data;

        // 1. Broadcast
        this.broadcastToProject(projectId, 'taskMoved', { taskId, listId, newPosition });

        // 2. Notifications (Optional: Notify assignees of move?)
        // Assuming we want to notify assignees that task moved
        // We need to fetch assignees first? For now skipping to keep simple unless requested.

        // Automation / Completion Check
        if (listTitle && ['done', 'completed', '완료'].includes(listTitle.toLowerCase())) {
            // ... completion logic ...
            await this.triggerProjectWebhooks(connection, projectId, 'TASK_COMPLETED', {
                actorName: actorName || 'User',
                taskTitle: taskTitle || 'Task'
            });
        }
    }

    async handleTaskUpdated(data, connection) {
        const { projectId, taskId, changes, assignees, actorName, taskTitle } = data;

        // 1. Broadcast
        this.broadcastToProject(projectId, 'taskUpdated', { taskId, changes });

        // 2. Notifications (New Assignees)
        if (assignees && assignees.new && assignees.new.length > 0) {
            for (const uId of assignees.new) {
                const message = JSON.stringify({
                    code: 'notification.task_assigned',
                    params: {
                        actor: actorName || 'System',
                        task: taskTitle
                    }
                });
                await this.createNotification(connection, uId, 'assigned', message);
            }
        }
    }

    async handleTaskCompleted(data, connection) {
        const { projectId, actorName, taskTitle } = data;
        await this.triggerProjectWebhooks(connection, projectId, 'TASK_COMPLETED', { actorName, taskTitle });
    }

    async handleCommentAdded(data, connection) {
        const { projectId, taskId, comment, assigneesToNotify, actorName, taskTitle } = data;

        // 1. Broadcast
        this.broadcastToProject(projectId, 'commentAdded', { taskId, comment });

        // 2. Notifications
        if (assigneesToNotify && assigneesToNotify.length > 0) {
            const snippet = comment.content.substring(0, 20) + (comment.content.length > 20 ? '...' : '');
            for (const userId of assigneesToNotify) {
                const message = JSON.stringify({
                    code: 'notification.comment_added',
                    params: {
                        actor: actorName || 'User',
                        task: taskTitle || `#${taskId}`,
                        snippet
                    }
                });
                await this.createNotification(connection, userId, 'comment', message);
            }
        }
    }

    async handleUrgentComment(data, connection) {
        const { projectId, actorName, taskTitle } = data;
        await this.triggerProjectWebhooks(connection, projectId, 'URGENT_COMMENT', { actorName, taskTitle });
    }

    async handleChecklistUpdated(data, connection) {
        const { projectId, taskId, checklist } = data;
        this.broadcastToProject(projectId, 'checklistUpdated', { taskId, checklist });
    }

    // --- Helpers ---

    broadcastToProject(projectId, event, data) {
        if (this.io) {
            this.io.to(`project_${projectId}`).emit(event, data);
        }
    }

    async createNotification(connection, userId, type, message) {
        if (!userId) return;
        try {
            await connection.execute(
                'INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)',
                [userId, type, message]
            );
        } catch (error) {
            console.error('[EventService] Failed to create notification:', error);
        }
    }

    async triggerProjectWebhooks(connection, projectId, eventType, data) {
        try {
            // 1. Fetch Active Webhooks
            const [hooks] = await connection.execute(
                'SELECT * FROM project_webhooks WHERE project_id = ? AND is_active = TRUE',
                [projectId]
            );
            if (hooks.length === 0) return;

            // 2. Construct Message
            let message = '';
            let title = '';
            const { actorName, taskTitle } = data;

            switch (eventType) {
                case 'TASK_CREATED':
                    title = '새로운 태스크 생성';
                    message = `${actorName}님이 [${taskTitle}] 태스크를 생성했습니다.`;
                    break;
                case 'TASK_COMPLETED':
                    title = '태스크 완료';
                    message = `${actorName}님이 [${taskTitle}]을(를) 완료했습니다.`;
                    break;
                case 'URGENT_COMMENT':
                    title = '긴급 태스크 댓글';
                    message = `${actorName}님이 긴급 태스크 [${taskTitle}]에 댓글을 남겼습니다.`;
                    break;
                default:
                    message = `Project Event: ${eventType}`;
            }

            // 3. Send Async
            hooks.forEach(hook => {
                sendWebhook(hook.webhook_url, hook.platform_name, {
                    title: title,
                    text: message,
                    message: message,
                    description: message,
                }).catch(err => console.error(`[EventService] Webhook failed for ${hook.id}:`, err.message));
            });

        } catch (error) {
            console.error('[EventService] Trigger Webhooks Error:', error);
        }
    }

    // --- Automation Engine ---

    async checkAutomationRules(eventName, data, connection) {
        const { projectId } = data;
        if (!projectId) return;

        try {
            // 1. Fetch Active Rules for this Project & Event
            const [rules] = await connection.execute(
                'SELECT * FROM automation_rules WHERE project_id = ? AND trigger_event = ? AND is_active = TRUE',
                [projectId, eventName]
            );

            if (rules.length === 0) return;

            console.log(`[Automation] Found ${rules.length} rules for ${eventName} in Project ${projectId}`);

            // 2. Evaluate & Execute
            for (const rule of rules) {
                if (this.evaluateCondition(rule.trigger_condition, data)) {
                    console.log(`[Automation] Rule matched: ID ${rule.id}. Executing ${rule.action_type}`);
                    await this.executeAction(rule.action_type, rule.action_data, data, connection);
                }
            }

        } catch (error) {
            console.error('[Automation] Error checking rules:', error);
        }
    }

    evaluateCondition(condition, data) {
        if (!condition) return true; // No condition = Always trigger

        // Simple Key-Value Match (Extendable)
        // e.g. { "listTitle": "Done" }
        // e.g. { "changes": "deadline" } -> checks if "deadline" is in data.changes array

        for (const [key, value] of Object.entries(condition)) {
            // Arrays (e.g. changes)
            if (Array.isArray(data[key])) {
                if (!data[key].includes(value)) return false;
            }
            // Normalize Strings
            else if (typeof value === 'string' && typeof data[key] === 'string') {
                if (data[key].toLowerCase() !== value.toLowerCase()) return false;
            }
            // Direct Match
            else if (data[key] != value) {
                return false;
            }
        }
        return true;
    }

    async executeAction(actionType, actionData, eventData, connection) {
        try {
            const { taskId, projectId } = eventData;

            switch (actionType) {
                case 'SET_DUE_DATE':
                    // actionData: { days: 3 } -> Set deadline to 3 days from now
                    if (actionData.days !== undefined) {
                        const date = new Date();
                        date.setDate(date.getDate() + parseInt(actionData.days));
                        const deadlineStr = date.toISOString().slice(0, 19).replace('T', ' ');

                        await connection.execute('UPDATE tasks SET deadline = ? WHERE id = ?', [deadlineStr, taskId]);

                        // Log Activity?
                        console.log(`[Automation] Set deadline for Task ${taskId} to ${deadlineStr}`);

                        // Notify Frontend? 
                        // Emitting TASK_UPDATED recursively might cause loops if not careful.
                        // But for now, we just update DB. 
                        // To update UI, we should ideally emit an update event.
                        // BUT: we are INSIDE emit loop. 
                        // If we emit TASK_UPDATED, we check rules again.
                        // TASK_UPDATED usually has "changes". If we set deadline, we emit changes=['deadline'].
                        // Condition checking avoids infinite loops IF condition checks things like "listTitle".
                        // Be careful. For now, let's update DB. Frontend might need refresh or we broadcast without recursion.
                        // Let's manually broadcast just the update to avoid rule recursion?
                        // Fetch latest task data to send to frontend
                        const [updatedTaskRows] = await connection.execute(
                            `SELECT t.*, DATE_FORMAT(t.deadline, '%Y-%m-%d') as deadline_str
                             FROM tasks t WHERE t.id = ?`,
                            [taskId]
                        );

                        if (updatedTaskRows.length > 0) {
                            const updatedTask = updatedTaskRows[0];
                            // Broadcast update
                            this.broadcastToProject(projectId, 'taskUpdated', {
                                taskId,
                                changes: ['deadline'],
                                updates: {
                                    deadline: updatedTask.deadline_str
                                }
                            });
                        }
                    }
                    break;
                case 'ADD_LABEL':
                    // actionData: { labelId: 5 }
                    // ... implementation ...
                    break;
                default:
                    console.warn(`[Automation] Unknown action: ${actionType}`);
            }
        } catch (error) {
            console.error('[Automation] Action Execution Error:', error);
        }
    }
}

module.exports = new EventService();
