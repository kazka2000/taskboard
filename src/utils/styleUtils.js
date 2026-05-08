
/**
 * Calculates whether black or white text should be used on a given background color
 * for best readability (WCAG constrast).
 * 
 * @param {string} hexColor - The background color in HEX format (e.g., #ffffff, #000)
 * @return {string} - 'black' or 'white'
 */
export const getContrastColor = (hexColor) => {
    if (!hexColor) return 'black';

    // Normalize hex code
    let hex = hexColor.replace('#', '');

    // Expand shorthand (e.g., "03F") to full form (e.g., "0033FF")
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }

    if (hex.length !== 6) return 'black';

    // Convert to RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Calculate YIQ ratio
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

    // Returns black for bright backgrounds, white for dark
    return (yiq >= 128) ? 'black' : 'white';
};
