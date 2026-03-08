/**
 * Escapes characters that have special meaning in regular expressions.
 * This is useful when taking user input and using it in a RegExp or Mongoose $regex query.
 * 
 * @param string The string to escape
 * @returns The escaped string
 */
export function escapeRegExp(string: string): string {
    if (!string) return '';
    // Escapes characters like: . * + ? ^ $ { } ( ) [ ] \ |
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
