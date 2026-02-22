function normalizeForSearch(str){return str.replace(/[İ]/g,'i').replace(/[ı]/g,'i').toLowerCase().replace(/[öÖ]/g,'o').replace(/[üÜ]/g,'u').replace(/[şŞ]/g,'s').replace(/[çÇ]/g,'c').replace(/[ğĞ]/g,'g')}

const testCases = [
    { input: "İSTANBUL", expected: "istanbul" },
    { input: "Ispanak", expected: "ispanak" },
    { input: "Iğdır", expected: "igdir" }
];

testCases.forEach(tc => {
    const result = normalizeForSearch(tc.input);
    console.log(`Input: ${tc.input}, Result: ${result}, Expected: ${tc.expected}, Match: ${result === tc.expected}`);
    if (result !== tc.expected) process.exit(1);
});
