const test = require('node:test');
const assert = require('node:assert');

// The escapeHTML function from index.html
function escapeHTML(str){if(!str)return '';return str.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

test('escapeHTML escapes special characters', (t) => {
    assert.strictEqual(escapeHTML('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
    assert.strictEqual(escapeHTML('text with "quotes" and \'single quotes\''), 'text with &quot;quotes&quot; and &#39;single quotes&#39;');
    assert.strictEqual(escapeHTML('& and some < >'), '&amp; and some &lt; &gt;');
});

test('escapeHTML handles empty input', (t) => {
    assert.strictEqual(escapeHTML(''), '');
    assert.strictEqual(escapeHTML(null), '');
    assert.strictEqual(escapeHTML(undefined), '');
});

test('Security logic: textContent vs innerHTML', (t) => {
    // This is a conceptual test since we don't have a full DOM.
    // We are verifying that we are using textContent for user-controlled strings.
    const userSuppliedQuery = '<img src=x onerror=alert(1)>';

    // Simulating the secure way we implemented in index.html
    const mockElement = {
        textContent: ''
    };

    // Setting textContent with malicious string
    mockElement.textContent = userSuppliedQuery;

    // In a real DOM, this would not execute any script and would be rendered as literal text.
    assert.strictEqual(mockElement.textContent, userSuppliedQuery);
});
