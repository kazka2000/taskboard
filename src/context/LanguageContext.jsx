import React, { createContext, useContext, useState, useEffect } from 'react';
import ko from '../locales/ko.json';
import en from '../locales/en.json';

const LanguageContext = createContext();

export const translations = { ko, en };

export function LanguageProvider({ children }) {
    // Default to Korean or saved preference
    const [language, setLanguage] = useState(() => {
        return localStorage.getItem('taskboard_lang') || 'ko';
    });

    useEffect(() => {
        localStorage.setItem('taskboard_lang', language);
        // Optional: Update HTML lang attribute
        document.documentElement.lang = language;
    }, [language]);

    // t function with nested key support (e.g. 'common.save') and interpolation
    const t = (key, params = {}) => {
        const keys = key.split('.');
        let value = translations[language];

        for (const k of keys) {
            value = value?.[k];
            if (value === undefined) break;
        }

        if (value === undefined) {
            console.warn(`Missing translation for key: ${key}`);
            return key; // Fallback to key
        }

        // Interpolation: {{key}}
        return value.replace(/\{\{(\w+)\}\}/g, (_, k) => {
            return params[k] !== undefined ? params[k] : `{{${k}}}`;
        });
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
