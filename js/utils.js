/**
 * Calculates the Levenshtein distance between two strings.
 * Used for typo correction in search queries.
 *
 * @param {string} a - The first string.
 * @param {string} b - The second string.
 * @returns {number} The edit distance between the two strings.
 */
function getEditDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const m = [];
    for (let i = 0; i <= b.length; i++) {
        m[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        m[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) == a.charAt(j - 1)) {
                m[i][j] = m[i - 1][j - 1];
            } else {
                m[i][j] = Math.min(
                    m[i - 1][j - 1] + 1, // substitution
                    Math.min(
                        m[i][j - 1] + 1, // insertion
                        m[i - 1][j] + 1  // deletion
                    )
                );
            }
        }
    }
    return m[b.length][a.length];
}

// Export for Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getEditDistance };
}
