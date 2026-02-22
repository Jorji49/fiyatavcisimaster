const { test } = require('node:test');
const assert = require('node:assert');
const { getEditDistance } = require('../js/utils.js');

test('getEditDistance should return 0 for identical strings', () => {
    assert.strictEqual(getEditDistance('apple', 'apple'), 0);
    assert.strictEqual(getEditDistance('', ''), 0);
    assert.strictEqual(getEditDistance('iphone', 'iphone'), 0);
});

test('getEditDistance should handle empty strings', () => {
    assert.strictEqual(getEditDistance('', 'apple'), 5);
    assert.strictEqual(getEditDistance('apple', ''), 5);
});

test('getEditDistance should detect substitutions', () => {
    // 1 substitution: a -> b
    assert.strictEqual(getEditDistance('apple', 'bpple'), 1);
    // 2 substitutions: a -> b, e -> o
    assert.strictEqual(getEditDistance('apple', 'bpplo'), 2);
});

test('getEditDistance should detect insertions', () => {
    // 1 insertion: extra 's'
    assert.strictEqual(getEditDistance('apple', 'apples'), 1);
    // 2 insertions
    assert.strictEqual(getEditDistance('apple', 'iapples'), 2);
});

test('getEditDistance should detect deletions', () => {
    // 1 deletion: missing 'e'
    assert.strictEqual(getEditDistance('apple', 'appl'), 1);
    // 2 deletions
    assert.strictEqual(getEditDistance('apple', 'app'), 2);
});

test('getEditDistance should handle complex edits', () => {
    // kitten -> sitting: k->s (sub), e->i (sub), +g (ins) = 3
    assert.strictEqual(getEditDistance('kitten', 'sitting'), 3);
});

test('getEditDistance should handle Turkish characters', () => {
    // Check if it correctly identifies distance with Turkish chars
    // 'iphone' vs 'ıphone' (different i)
    assert.strictEqual(getEditDistance('iphone', 'ıphone'), 1);
    // 'çanta' vs 'canta'
    assert.strictEqual(getEditDistance('çanta', 'canta'), 1);
    // 'kazak' vs 'kazak'
    assert.strictEqual(getEditDistance('kazak', 'kazak'), 0);
});

test('getEditDistance should be case sensitive', () => {
    // The current implementation is case sensitive because it uses b.charAt(i-1) == a.charAt(j-1)
    assert.strictEqual(getEditDistance('Apple', 'apple'), 1);
});
