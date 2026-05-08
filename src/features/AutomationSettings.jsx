import React, { useState, useEffect } from 'react';
import { Trash, Plus, Zap, ArrowRight, Check } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import styles from './AutomationSettings.module.css';

export function AutomationSettings({ project }) {
    const { automationRules, fetchRules, addRule, deleteRule, t } = useProject();
    const [loading, setLoading] = useState(false);

    // Form State
    const [triggerEvent, setTriggerEvent] = useState('TASK_MOVED');
    const [triggerListTitle, setTriggerListTitle] = useState('');

    const [actionType, setActionType] = useState('SET_DUE_DATE');
    const [actionDays, setActionDays] = useState('3');
    const [actionListTitle, setActionListTitle] = useState('');
    const [actionLabelName, setActionLabelName] = useState('');

    useEffect(() => {
        if (project) {
            fetchRules(project.id);
        }
    }, [project]);

    const handleCreateRule = async () => {
        if (!triggerListTitle) {
            alert('목록 이름을 입력해주세요.');
            return;
        }

        setLoading(true);

        const ruleData = {
            trigger_event: triggerEvent,
            trigger_condition: { listTitle: triggerListTitle },
            action_type: actionType,
            action_data: {}
        };

        if (actionType === 'SET_DUE_DATE') {
            ruleData.action_data = { days: parseInt(actionDays) };
        } else if (actionType === 'MOVE_TO_LIST') {
            if (!actionListTitle) { alert('이동할 목록 이름을 입력해주세요.'); setLoading(false); return; }
            ruleData.action_data = { listTitle: actionListTitle };
        } else if (actionType === 'ADD_LABEL') {
            if (!actionLabelName) { alert('라벨 이름을 입력해주세요.'); setLoading(false); return; }
            ruleData.action_data = { labelName: actionLabelName };
        }

        const success = await addRule(project.id, ruleData);
        if (success) {
            // Reset form
            setTriggerListTitle('');
            setActionListTitle('');
            setActionLabelName('');
        }
        setLoading(false);
    };

    // Helper to render rule description
    const renderRuleDescription = (rule) => {
        let condition = '';
        if (rule.trigger_condition?.listTitle) condition = `"${rule.trigger_condition.listTitle}" 목록으로`;

        let action = '';
        if (rule.action_type === 'SET_DUE_DATE') action = `마감일을 ${rule.action_data.days}일 후로 설정`;
        if (rule.action_type === 'MOVE_TO_LIST') action = `"${rule.action_data.listTitle}" 목록으로 이동`;
        if (rule.action_type === 'ADD_LABEL') action = `"${rule.action_data.labelName}" 라벨 추가`;

        return (
            <div className={styles.ruleText}>
                <span className={styles.trigger}>태스크가 {condition} 이동되면</span>
                <ArrowRight size={14} className={styles.arrow} />
                <span className={styles.action}>{action}</span>
            </div>
        );
    };

    return (
        <div className={styles.container}>
            <h3><Zap size={18} /> {t('automation') || '자동화 규칙 (Automation)'}</h3>
            <p className={styles.subtitle}>간단한 규칙으로 업무 흐름을 자동화하세요.</p>

            <div className={styles.ruleBuilder}>
                <div className={styles.builderRow}>
                    <span className={styles.label}>조건 (When)</span>
                    <select
                        value={triggerEvent}
                        onChange={e => setTriggerEvent(e.target.value)}
                        className={styles.select}
                    >
                        <option value="TASK_MOVED">목록으로 이동될 때</option>
                    </select>
                    <input
                        type="text"
                        placeholder="목록 이름 (예: 완료)"
                        value={triggerListTitle}
                        onChange={e => setTriggerListTitle(e.target.value)}
                        className={styles.input}
                    />
                </div>

                <div className={styles.builderRow}>
                    <span className={styles.label}>실행 (Then)</span>
                    <select
                        value={actionType}
                        onChange={e => setActionType(e.target.value)}
                        className={styles.select}
                    >
                        <option value="SET_DUE_DATE">마감일 설정</option>
                        <option value="MOVE_TO_LIST">목록 이동</option>
                        <option value="ADD_LABEL">라벨 추가</option>
                    </select>

                    {actionType === 'SET_DUE_DATE' && (
                        <div className={styles.paramGroup}>
                            <input
                                type="number"
                                value={actionDays}
                                onChange={e => setActionDays(e.target.value)}
                                className={styles.inputSmall}
                            />
                            <span>일 후</span>
                        </div>
                    )}

                    {actionType === 'MOVE_TO_LIST' && (
                        <input
                            type="text"
                            placeholder="이동할 목록 이름"
                            value={actionListTitle}
                            onChange={e => setActionListTitle(e.target.value)}
                            className={styles.input}
                        />
                    )}

                    {actionType === 'ADD_LABEL' && (
                        <input
                            type="text"
                            placeholder="라벨 이름 (예: 긴급)"
                            value={actionLabelName}
                            onChange={e => setActionLabelName(e.target.value)}
                            className={styles.input}
                        />
                    )}
                </div>

                <div className={styles.actionRow}>
                    <button className={styles.addBtn} onClick={handleCreateRule} disabled={loading}>
                        <Plus size={16} /> {loading ? '저장 중...' : '규칙 생성'}
                    </button>
                </div>
            </div>

            <div className={styles.ruleList}>
                <h4>활성화된 규칙 (Active Rules)</h4>
                {automationRules.length === 0 ? (
                    <p className={styles.empty}>설정된 규칙이 없습니다.</p>
                ) : (
                    automationRules.map(rule => (
                        <div key={rule.id} className={styles.ruleItem}>
                            {renderRuleDescription(rule)}
                            <button
                                className={styles.deleteBtn}
                                onClick={() => deleteRule(rule.id, project.id)}
                            >
                                <Trash size={14} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
