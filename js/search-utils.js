(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        const exports = factory();
        root.getEditDistance = exports.getEditDistance;
        root.normalizeForSearch = exports.normalizeForSearch;
    }
}(typeof self !== 'undefined' ? self : this, function () {
    function getEditDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        const m = [];
        for (let i = 0; i <= b.length; i++) m[i] = [i];
        for (let j = 0; j <= a.length; j++) m[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) == a.charAt(j - 1)) m[i][j] = m[i - 1][j - 1];
                else m[i][j] = Math.min(m[i - 1][j - 1] + 1, Math.min(m[i][j - 1] + 1, m[i - 1][j] + 1))
            }
        }
        return m[b.length][a.length]
    }

    /**
     * Normalizes a string for search by:
     * 1. Replacing Turkish characters with their non-accented counterparts.
     * 2. Handling 'I', 'ı', 'İ' consistently across different locales.
     * 3. Converting to lowercase.
     */
    function normalizeForSearch(str) {
        if (!str) return '';
        return str
            .replace(/[ıİI]/g, 'i')
            .replace(/[öÖ]/g, 'o')
            .replace(/[üÜ]/g, 'u')
            .replace(/[şŞ]/g, 's')
            .replace(/[çÇ]/g, 'c')
            .replace(/[ğĞ]/g, 'g')
            .toLowerCase();
    }

    return {
        getEditDistance: getEditDistance,
        normalizeForSearch: normalizeForSearch
    };
}));
