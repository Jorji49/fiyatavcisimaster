(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.TypoChecker = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    const TypoChecker = {
        getEditDistance: function(a, b) {
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
        },

        normalizeForSearch: function(str) {
            // Replace İ and ı before toLowerCase to avoid combining marks issues
            return str.replace(/İ/g, 'i')
                .replace(/ı/g, 'i')
                .toLowerCase()
                .replace(/ö/g, 'o')
                .replace(/ü/g, 'u')
                .replace(/ş/g, 's')
                .replace(/ç/g, 'c')
                .replace(/ğ/g, 'g');
        },

        getSuggestions: function(q, dictionary) {
            const w = q.toLowerCase().split(' ');
            let suggestions = [], hasTypo = false, corrections = [];
            w.forEach(x => {
                if (x.length < 3 || !isNaN(x)) {
                    suggestions.push(x);
                    return;
                }
                const normalizedX = this.normalizeForSearch(x);
                if (dictionary.some(aw => this.normalizeForSearch(aw) === normalizedX)) {
                    suggestions.push(x);
                    return;
                }
                if (dictionary.includes(x)) {
                    suggestions.push(x);
                    return;
                }
                let bestMatch = x, minDist = 2, bestWord = null;
                dictionary.forEach(d => {
                    const normalizedD = this.normalizeForSearch(d);
                    const dist1 = this.getEditDistance(x, d);
                    const dist2 = this.getEditDistance(normalizedX, normalizedD);
                    const dist = Math.min(dist1, dist2);
                    const lenDiff = Math.abs(d.length - x.length);
                    if (dist < minDist && lenDiff <= 2) {
                        minDist = dist;
                        bestMatch = d;
                        bestWord = d;
                        hasTypo = true;
                    } else if (dist === minDist && d.startsWith(x.substring(0, 2))) {
                        bestMatch = d;
                        bestWord = d;
                        hasTypo = true;
                    }
                });
                if (bestWord) corrections.push({ from: x, to: bestWord });
                suggestions.push(bestMatch);
            });
            return {
                hasTypo,
                suggestedQuery: suggestions.join(' '),
                corrections
            };
        }
    };

    return TypoChecker;
}));
