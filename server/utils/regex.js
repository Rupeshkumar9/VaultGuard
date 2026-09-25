/**
 * Escapes characters with special meaning in regular expressions.
 * @param {string} value
 * @returns {string}
 */
export const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
