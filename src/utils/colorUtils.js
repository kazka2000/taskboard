export function isColorLight(color) {
    if (!color || typeof color !== 'string') return true; // Safe fallback

    let r, g, b;

    // Check for hex
    if (color.startsWith('#')) {
        const hex = color.replace('#', '');
        if (hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16);
            g = parseInt(hex[1] + hex[1], 16);
            b = parseInt(hex[2] + hex[2], 16);
        } else if (hex.length === 6) {
            r = parseInt(hex.substring(0, 2), 16);
            g = parseInt(hex.substring(2, 4), 16);
            b = parseInt(hex.substring(4, 6), 16);
        } else {
            return true; // Fallback
        }
    } else if (color.startsWith('rgb')) {
        // Simple parse for rgb(r, g, b)
        const parts = color.match(/\d+/g);
        if (parts && parts.length >= 3) {
            r = parseInt(parts[0]);
            g = parseInt(parts[1]);
            b = parseInt(parts[2]);
        } else {
            return true;
        }
    } else {
        return true; // Named colors or others, assume light for safety or map them.
        // For this app, we mainly use Hex from picker.
    }

    // YIQ equation
    if (isNaN(r) || isNaN(g) || isNaN(b)) return true; // Safe fallback
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return yiq >= 128;
}
