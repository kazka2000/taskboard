import React, { useMemo, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useProject } from '../context/ProjectContext';
import styles from './CalendarView.module.css'; // specific styles for overrides

export function CalendarView({ tasks, onTaskClick, onTaskMove }) {
    const calendarRef = useRef(null);
    const { t, currentUser } = useProject();

    // Map tasks to events
    const events = useMemo(() => {
        return tasks.map(task => {
            // Determine colors
            // Default color or label color?
            // If multiple labels, pick first? Or use a standard task color?
            // Let's use the first label's color if available, or a default.
            let backgroundColor = '#3788d8'; // Default blue
            let borderColor = '#3788d8';
            let textColor = '#ffffff';

            if (task.labels && task.labels.length > 0) {
                backgroundColor = task.labels[0].color;
                borderColor = task.labels[0].color;
            }

            // Start/End logic
            // To allow "moving" the task on the calendar, we treat the event primarily as a "Deadline" event.
            // If we use created_at as start and deadline as end, moving the event only shifts the "block",
            // but since created_at is immutable in this view, it results in the event 'stretching' from the fixed start.
            // Therefore, we map 'start' to the deadline (or created_at if no deadline).
            // This renders tasks as single-day events (or default duration) at their due date.

            let datePoint = task.deadline ? new Date(task.deadline) : (task.startDate ? new Date(task.startDate) : new Date(task.created_at));

            // FullCalendar Start
            let start = datePoint;
            // End is null for single-day/point events
            let end = null;

            return {
                id: String(task.id),
                title: task.title,
                start: start,
                end: end,
                allDay: true,
                backgroundColor,
                borderColor,
                textColor,
                extendedProps: {
                    description: task.description,
                    listId: task.listId,
                    assignees: task.assignees,
                    project_id: task.project_id
                },
                classNames: ['task-event']
            };
        });
    }, [tasks]);

    const handleEventDrop = (info) => {
        const { event } = info;

        // When dropped, event.start is the new date.
        // We update the deadline to this new date.

        const newStart = event.start;
        let newDeadlineStr = null;

        if (newStart) {
            // Adjust for timezone offset if necessary, but toISOString().split('T')[0] 
            // gives UTC date. If local time is significantly different, this might be off by 1 day.
            // FullCalendar events are usually local dates if not specified otherwise?
            // Let's use a safer local date formatting.
            const year = newStart.getFullYear();
            const month = String(newStart.getMonth() + 1).padStart(2, '0');
            const day = String(newStart.getDate()).padStart(2, '0');
            newDeadlineStr = `${year}-${month}-${day}`;
        }

        if (onTaskMove && newDeadlineStr) {
            onTaskMove(event.id, newDeadlineStr);
        }
    };

    const handleEventClick = (info) => {
        const task = tasks.find(t => String(t.id) === String(info.event.id));
        if (task && onTaskClick) {
            onTaskClick(task);
        }
    };

    return (
        <div className={styles.calendarWrapper}>
            <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay'
                }}
                events={events}
                editable={true}
                droppable={true}
                eventDrop={handleEventDrop}
                eventClick={handleEventClick}
                height="auto"
            />
        </div>
    );
}
