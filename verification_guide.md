# Automation Engine Verification Guide

To verify the Automation Engine, you can insert test rules into the database and interact with the UI.

## 1. Test Rule: Auto-Set Deadline for "In Progress"
**Scenario**: When a task is moved to the "In Progress" list, automatically set the deadline to 3 days from now.

### SQL to Insert Rule
Replace `1` with your actual Project ID.
```sql
INSERT INTO automation_rules 
(project_id, trigger_event, trigger_condition, action_type, action_data, is_active) 
VALUES 
(1, 'TASK_MOVED', '{"listTitle": "In Progress"}', 'SET_DUE_DATE', '{"days": 3}', TRUE);
```

### Verification Steps
1. Go to Project 1.
2. Drag a task to the "In Progress" list.
3. Check if the task deadline appears (refresh if needed, though it should update instantly).
4. Check the Activity Log (Task Detail Modal) for the system message.

---

## 2. Test Rule: Auto-Label "Urgent" tasks
**Scenario**: When a task is created with the word "Urgent" in the title (not implemented in trigger condition yet, only exact match supported in current logic code? No, `startsWith` not implemented).
*Correction*: My implementation supports key-value match. `{"title": "Urgent Bug"}` only matches exact title. 
Let's test `MOVE_TO_LIST` instead.

## 2. Test Rule: Auto-Move to "Review" when "Done" (Chain test?)
**Scenario**: When a task is moved to "Done", move it to "Review" (Silly rule, but tests chaining protection).

### SQL
```sql
INSERT INTO automation_rules 
(project_id, trigger_event, trigger_condition, action_type, action_data, is_active) 
VALUES 
(1, 'TASK_MOVED', '{"listTitle": "Done"}', 'MOVE_TO_LIST', '{"listTitle": "Review"}', TRUE);
```

### Verification
1. Drag task to "Done".
2. It should jump to "Review".
3. Verify that THIS move ("Review") does not trigger further rules (Recursion Protection).

---

## 3. UI Verification
1. Open Project Settings (Gear icon / Menu).
2. Click the **Automation** tab.
3. Use the builder to create a rule:
   - "When Task is moved to list **Pending**" -> "Then **add label** **Urgent**".
4. Move a task to the "Pending" list.
5. Verify the task gets the "Urgent" label (refresh page to see label if socket update is partial).
