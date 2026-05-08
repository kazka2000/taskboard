export function getContrastColor(hexColor) {
    if (!hexColor) return '#000000';

    // Convert generic names to hex if needed, or handle rgb
    // For now assuming Hex
    let hex = hexColor.replace('#', '');
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }

    if (hex.length !== 6) return '#000000';

    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // YIQ formula
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

    return (yiq >= 128) ? '#0f172a' : '#ffffff'; // Dark Slate or White
}
