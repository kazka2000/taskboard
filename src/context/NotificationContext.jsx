import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useProject } from './ProjectContext';
import { useToast } from './ToastContext';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
    const { currentUser, socket, t } = useProject(); // We'll assume socket is exposed here
    const { showToast } = useToast();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = async () => {
        if (!currentUser) return;
        try {
            const response = await axios.get(`http://localhost:3000/api/notifications?userId=${currentUser.id}`);
            if (response.data.success) {
                setNotifications(response.data.notifications);
                setUnreadCount(response.data.notifications.filter(n => !n.is_read).length);
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    };

    const markAsRead = async (id) => {
        try {
            // Optimistic update
            setNotifications(prev => prev.map(n =>
                n.id === id ? { ...n, is_read: 1 } : n
            ));
            setUnreadCount(prev => Math.max(0, prev - 1));

            await axios.put(`http://localhost:3000/api/notifications/${id}/read`);
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
            fetchNotifications(); // Revert
        }
    };

    // Initial fetch
    useEffect(() => {
        if (currentUser) {
            fetchNotifications();
        } else {
            setNotifications([]);
            setUnreadCount(0);
        }
    }, [currentUser]);

    // Listen for real-time notifications
    useEffect(() => {
        if (!socket || !currentUser) return;

        const handleNotification = () => {
            // Simple refresh for now. 
            // In future, we can append to state directly if we trust the payload.
            fetchNotifications();
            showToast(t('notification.new_notification') || 'New Notification', 'info');
        };

        // Listen to events that generate notifications
        // 'assigned', 'comment' events are sent to specific users via DB but broadcast to project via socket.
        // Wait, eventService broadcasts 'taskCreated', 'taskUpdated'.
        // It does NOT broadcast "notification" event to socket unless we add it.
        // Current eventService:
        // socket.to(project_X).emit(...)

        // But we want PERSONAL notifications.
        // If I am in Project A, and someone comments, I get 'commentAdded' socket event.
        // We can use that to trigger fetchNotifications().

        socket.on('taskCreated', fetchNotifications);
        socket.on('taskUpdated', fetchNotifications);
        socket.on('taskMoved', fetchNotifications);
        socket.on('commentAdded', fetchNotifications);
        // Add more as needed

        return () => {
            socket.off('taskCreated', fetchNotifications);
            socket.off('taskUpdated', fetchNotifications);
            socket.off('taskMoved', fetchNotifications);
            socket.off('commentAdded', fetchNotifications);
        };
    }, [socket, currentUser]);

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            fetchNotifications,
            markAsRead
        }}>
            {children}
        </NotificationContext.Provider>
    );
}

export const useNotification = () => useContext(NotificationContext);
