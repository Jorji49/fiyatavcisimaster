const test = require('node:test');
const assert = require('node:assert');
const { normalizeForSearch, getEditDistance } = require('../js/search-utils.js');

test('normalizeForSearch - Turkish character normalization', (t) => {
    const cases = [
        { input: 'ııı', expected: 'iii' },
        { input: 'İİİ', expected: 'iii' },
        { input: 'III', expected: 'iii' }, // Case for dotless I
        { input: 'ööö', expected: 'ooo' },
        { input: 'ÖÖÖ', expected: 'ooo' },
        { input: 'üüü', expected: 'uuu' },
        { input: 'ÜÜÜ', expected: 'uuu' },
        { input: 'şşş', expected: 'sss' },
        { input: 'ŞŞŞ', expected: 'sss' },
        { input: 'ççç', expected: 'ccc' },
        { input: 'ÇÇÇ', expected: 'ccc' },
        { input: 'ğğğ', expected: 'ggg' },
        { input: 'ĞĞĞ', expected: 'ggg' },
        { input: 'PİJAMALI HASTA YAĞIZ ŞOFÖRE ÇABUCAK GÜVENDİ', expected: 'pijamali hasta yagiz sofore cabucak guvendi' },
        { input: 'pijamalı hasta yağız şoföre çabucak güvendi', expected: 'pijamali hasta yagiz sofore cabucak guvendi' }
    ];

    cases.forEach(({ input, expected }) => {
        assert.strictEqual(normalizeForSearch(input), expected, `Failed for input: ${input}`);
    });
});

test('normalizeForSearch - Mixed case and regular characters', () => {
    assert.strictEqual(normalizeForSearch('Hello World'), 'hello world');
    assert.strictEqual(normalizeForSearch('iPhone 15 Pro'), 'iphone 15 pro');
});

test('normalizeForSearch - Empty and null values', () => {
    assert.strictEqual(normalizeForSearch(''), '');
    assert.strictEqual(normalizeForSearch(null), '');
    assert.strictEqual(normalizeForSearch(undefined), '');
});

test('getEditDistance - Basic functionality', () => {
    assert.strictEqual(getEditDistance('kitten', 'sitting'), 3);
    assert.strictEqual(getEditDistance('book', 'back'), 2);
    assert.strictEqual(getEditDistance('apple', 'apple'), 0);
    assert.strictEqual(getEditDistance('', 'abc'), 3);
    assert.strictEqual(getEditDistance('abc', ''), 3);
});
