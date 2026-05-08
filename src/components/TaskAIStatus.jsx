import React from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import styles from './TaskModal.module.css';

export function TaskAIStatus({ currentStep }) {
    // Steps: 1. Context Analysis, 2. Solution Inference, 3. Final Report
    const steps = [
        { id: 1, label: '컨텍스트 분석' },
        { id: 2, label: '해결 방안 추론' },
        { id: 3, label: '최종 보고서 작성' }
    ];

    return (
        <div className={styles.aiStatusContainer}>
            {steps.map((step, index) => {
                const isActive = currentStep === step.id;
                const isCompleted = currentStep > step.id;

                return (
                    <div key={step.id} className={`${styles.aiStep} ${isActive ? styles.active : ''} ${isCompleted ? styles.completed : ''}`}>
                        <div className={styles.stepIcon}>
                            {isCompleted ? (
                                <CheckCircle2 size={18} className={styles.iconCompleted} />
                            ) : isActive ? (
                                <Loader2 size={18} className={styles.iconActive} />
                            ) : (
                                <Circle size={18} className={styles.iconPending} />
                            )}
                        </div>
                        <span className={styles.stepLabel}>{step.label}</span>
                        {index < steps.length - 1 && (
                            <div className={`${styles.stepLine} ${isCompleted ? styles.lineCompleted : ''}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
