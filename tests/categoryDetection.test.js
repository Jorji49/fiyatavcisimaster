const { test, describe } = require('node:test');
const assert = require('node:assert');
const { detectCategory } = require('../js/categoryDetection.js');

describe('Category Detection Logic', () => {
    test('should detect VR_GAMING category', () => {
        assert.strictEqual(detectCategory('oculus quest'), 'VR_GAMING');
        assert.strictEqual(detectCategory('playstation vr 2'), 'VR_GAMING');
    });

    test('should detect CONSOLE category', () => {
        assert.strictEqual(detectCategory('ps5 pro'), 'CONSOLE');
        assert.strictEqual(detectCategory('nintendo switch'), 'CONSOLE');
        assert.strictEqual(detectCategory('xbox series x'), 'CONSOLE');
    });

    test('should detect HARDWARE category', () => {
        assert.strictEqual(detectCategory('rtx 5090'), 'HARDWARE');
        assert.strictEqual(detectCategory('ryzen 9800x3d'), 'HARDWARE');
        assert.strictEqual(detectCategory('intel i9'), 'HARDWARE');
    });

    test('should detect PHONE category', () => {
        assert.strictEqual(detectCategory('iphone 16'), 'PHONE');
        assert.strictEqual(detectCategory('samsung galaxy s24'), 'PHONE');
    });

    test('should detect COMPUTER category', () => {
        assert.strictEqual(detectCategory('macbook air'), 'COMPUTER');
        assert.strictEqual(detectCategory('gaming laptop'), 'COMPUTER');
        assert.strictEqual(detectCategory('ipad pro'), 'COMPUTER');
    });

    test('should detect AUDIO category', () => {
        assert.strictEqual(detectCategory('airpods pro'), 'AUDIO');
        assert.strictEqual(detectCategory('sony wh-1000xm5'), 'AUDIO');
        assert.strictEqual(detectCategory('bluetooth kulaklık'), 'AUDIO');
    });

    test('should detect SMARTWATCH category', () => {
        assert.strictEqual(detectCategory('apple watch series 10'), 'SMARTWATCH');
        assert.strictEqual(detectCategory('huawei watch gt5'), 'SMARTWATCH');
    });

    test('should detect CAMERA category', () => {
        assert.strictEqual(detectCategory('canon eos'), 'CAMERA');
        assert.strictEqual(detectCategory('dji osmo'), 'CAMERA');
    });

    test('should detect HOME_ELECTRONICS category', () => {
        assert.strictEqual(detectCategory('robot süpürge'), 'HOME_ELECTRONICS');
        assert.strictEqual(detectCategory('airfryer'), 'HOME_ELECTRONICS');
        assert.strictEqual(detectCategory('kahve makinesi'), 'HOME_ELECTRONICS');
    });

    test('should detect COSMETIC category', () => {
        assert.strictEqual(detectCategory('parfüm'), 'COSMETIC');
        assert.strictEqual(detectCategory('nemlendirici'), 'COSMETIC');
    });

    test('should detect BOOK category', () => {
        assert.strictEqual(detectCategory('roman'), 'BOOK');
        assert.strictEqual(detectCategory('kitap'), 'BOOK');
    });

    test('should detect FASHION category', () => {
        assert.strictEqual(detectCategory('elbise'), 'FASHION');
        assert.strictEqual(detectCategory('ayakkabı'), 'FASHION');
        assert.strictEqual(detectCategory('mont'), 'FASHION');
    });

    test('should detect TOY category', () => {
        assert.strictEqual(detectCategory('lego'), 'TOY');
        assert.strictEqual(detectCategory('oyuncak araba'), 'TOY');
    });

    test('should detect PET_BABY category', () => {
        assert.strictEqual(detectCategory('kedi maması'), 'PET_BABY');
        assert.strictEqual(detectCategory('bebek bezi'), 'PET_BABY');
    });

    test('should detect SPORTS category', () => {
        assert.strictEqual(detectCategory('pilates matı'), 'SPORTS');
        assert.strictEqual(detectCategory('protein tozu'), 'SPORTS');
    });

    test('should detect HOME category', () => {
        assert.strictEqual(detectCategory('matkap'), 'HOME');
        assert.strictEqual(detectCategory('tornavida'), 'HOME');
    });

    test('should return GENERAL for unknown category', () => {
        assert.strictEqual(detectCategory('bilinmeyen ürün'), 'GENERAL');
    });

    test('should be case insensitive', () => {
        assert.strictEqual(detectCategory('IPHONE'), 'PHONE');
        assert.strictEqual(detectCategory('Rtx 5090'), 'HARDWARE');
    });
});
