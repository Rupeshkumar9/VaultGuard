import test from 'node:test';
import assert from 'node:assert/strict';
import { getVaultViewportStyle } from '../src/utils/viewport.js';

test('keeps extension popup dimensions', () => {
  assert.deepEqual(
    getVaultViewportStyle({ isExtension: true, isNative: false, isAutofillMode: false }),
    { width: '380px', height: '600px' },
  );
});

test('gives normal Android the full dynamic viewport', () => {
  assert.deepEqual(
    getVaultViewportStyle({ isExtension: false, isNative: true, isAutofillMode: false }),
    { width: '100%', height: '100dvh' },
  );
});

test('keeps AutofillActivity full-size', () => {
  assert.deepEqual(
    getVaultViewportStyle({ isExtension: false, isNative: true, isAutofillMode: true }),
    { width: '100%', height: '100%' },
  );
});
