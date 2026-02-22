const test = require('node:test');
const assert = require('node:assert');
const TypoChecker = require('../js/typo-checker.js');

const mockDictionary = [
    'iphone', 'samsung', 'macbook', 'kulaklık', 'bilgisayar', 'ayakkabı', 'parfüm', 'kitap'
];

test('TypoChecker.normalizeForSearch', (t) => {
    assert.strictEqual(TypoChecker.normalizeForSearch('İPHONE'), 'iphone');
    assert.strictEqual(TypoChecker.normalizeForSearch('Ilık'), 'ilik');
    assert.strictEqual(TypoChecker.normalizeForSearch('çilek'), 'cilek');
    assert.strictEqual(TypoChecker.normalizeForSearch('şeker'), 'seker');
    assert.strictEqual(TypoChecker.normalizeForSearch('ılık'), 'ilik');
});

test('TypoChecker.getEditDistance', (t) => {
    assert.strictEqual(TypoChecker.getEditDistance('iphone', 'iphone'), 0);
    assert.strictEqual(TypoChecker.getEditDistance('iphone', 'iphone1'), 1);
    assert.strictEqual(TypoChecker.getEditDistance('iphone', 'iphnoe'), 2);
    assert.strictEqual(TypoChecker.getEditDistance('kitten', 'sitting'), 3);
});

test('TypoChecker.getSuggestions - No typo', (t) => {
    const result = TypoChecker.getSuggestions('iphone', mockDictionary);
    assert.strictEqual(result.hasTypo, false);
    assert.strictEqual(result.suggestedQuery, 'iphone');
    assert.strictEqual(result.corrections.length, 0);
});

test('TypoChecker.getSuggestions - Simple typo', (t) => {
    const result = TypoChecker.getSuggestions('iphnoe', mockDictionary);
    assert.strictEqual(result.hasTypo, true);
    assert.strictEqual(result.suggestedQuery, 'iphone');
    assert.deepStrictEqual(result.corrections, [{ from: 'iphnoe', to: 'iphone' }]);
});

test('TypoChecker.getSuggestions - Turkish character normalization', (t) => {
    // 'ıphone' should match 'iphone' because of normalization
    const result = TypoChecker.getSuggestions('ıphone', mockDictionary);
    assert.strictEqual(result.hasTypo, false);
    assert.strictEqual(result.suggestedQuery, 'ıphone');
});

test('TypoChecker.getSuggestions - Short words ignored', (t) => {
    const result = TypoChecker.getSuggestions('ip', mockDictionary);
    assert.strictEqual(result.hasTypo, false);
    assert.strictEqual(result.suggestedQuery, 'ip');
});

test('TypoChecker.getSuggestions - Numbers ignored', (t) => {
    const result = TypoChecker.getSuggestions('12345', mockDictionary);
    assert.strictEqual(result.hasTypo, false);
    assert.strictEqual(result.suggestedQuery, '12345');
});

test('TypoChecker.getSuggestions - Mixed words', (t) => {
    const result = TypoChecker.getSuggestions('iphnoe samsng test', mockDictionary);
    assert.strictEqual(result.hasTypo, true);
    assert.strictEqual(result.suggestedQuery, 'iphone samsung test');
    assert.strictEqual(result.corrections.length, 2);
    assert.strictEqual(result.corrections[0].from, 'iphnoe');
    assert.strictEqual(result.corrections[0].to, 'iphone');
    assert.strictEqual(result.corrections[1].from, 'samsng');
    assert.strictEqual(result.corrections[1].to, 'samsung');
});

test('TypoChecker.getSuggestions - Best match with startswith priority', (t) => {
    const dict = ['apple', 'apply'];
    const result = TypoChecker.getSuggestions('appl', dict);
    assert.strictEqual(result.hasTypo, true);
    // Both 'apple' and 'apply' have dist 1. 'apple' comes first in dict or starts with 'app'?
    // The logic says if dist is same, check if d.startsWith(x.substring(0,2))
    // Both start with 'ap'. So it picks the first one encountered if minDist is same.
    assert.ok(['apple', 'apply'].includes(result.suggestedQuery));
});
