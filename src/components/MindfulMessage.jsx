import React from 'react';
import { useProject } from '../context/ProjectContext';
import { useLanguage } from '../context/LanguageContext';
import styles from './MindfulMessage.module.css';
import { CloudRain, Sun, Moon, Cloud, CloudSnow } from 'lucide-react';

export function MindfulMessage() {
    const { mindfulContext } = useProject();
    const { t } = useLanguage();

    if (!mindfulContext) return null;

    const { weather, mode } = mindfulContext;
    const messageKey = `mindful.${mode}_${weather}`;
    // Fallback if combination missing
    const message = t(messageKey) === messageKey ? t(`mindful.${mode}_Clear`) : t(messageKey);

    const getThemeClass = () => {
        switch (weather) {
            case 'Rain':
            case 'Snow': return styles.themeRain;
            case 'Clouds': return styles.themeClouds;
            default: return styles.themeClear;
        }
    };

    const getIcon = () => {
        switch (weather) {
            case 'Rain': return <CloudRain size={20} className={styles.animRain} />;
            case 'Snow': return <CloudSnow size={20} className={styles.animRain} />;
            case 'Clouds': return <Cloud size={20} className={styles.animClouds} />;
            default: return mode === 'night'
                ? <Moon size={20} className={styles.animSpin} /> // Subtle Moon move
                : <Sun size={20} className={styles.animSpin} />;
        }
    };

    return (
        <div className={`${styles.container} ${getThemeClass()}`}>
            <div className={styles.iconWrapper}>
                {getIcon()}
            </div>
            <span className={styles.text}>{message}</span>
        </div>
    );
}
