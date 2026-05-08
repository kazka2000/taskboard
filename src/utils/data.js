export const initialData = {
    columns: [
        {
            id: 'col-1',
            title: 'To Do',
            tasks: [
                { id: 'task-1', title: 'Research competitors', tag: 'Strategy' },
                { id: 'task-2', title: 'Draft project proposal', tag: 'Writing' },
            ],
        },
        {
            id: 'col-2',
            title: 'In Progress',
            tasks: [
                { id: 'task-3', title: 'Set up repo', tag: 'Dev' },
            ],
        },
        {
            id: 'col-review',
            title: 'Review',
            tasks: [],
        },
        {
            id: 'col-3',
            title: 'Done',
            tasks: [
                { id: 'task-4', title: 'Buy domain', tag: 'Admin' },
            ],
        },
    ],
};
