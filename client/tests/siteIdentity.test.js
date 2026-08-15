import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSiteIdentity, sitesMatch } from '../src/utils/siteIdentity.js';

test('matches exact hosts and related subdomains on the same registrable domain', () => {
  assert.equal(sitesMatch('https://example.com', 'https://example.com/login'), true);
  assert.equal(sitesMatch('https://accounts.example.com', 'https://app.example.com'), true);
});

test('does not cross protocols or ports', () => {
  assert.equal(sitesMatch('https://example.com', 'http://example.com'), false);
  assert.equal(sitesMatch('https://example.com:8443', 'https://example.com'), false);
});

test('treats private hosting suffix tenants as unrelated sites', () => {
  assert.equal(sitesMatch('https://alice.vercel.app', 'https://bob.vercel.app'), false);
  assert.equal(sitesMatch('https://alice.github.io', 'https://bob.github.io'), false);
  assert.equal(sitesMatch('https://one.pages.dev', 'https://two.pages.dev'), false);
});

test('matches IP addresses and localhost exactly only', () => {
  assert.equal(sitesMatch('http://127.0.0.1:3000', 'http://127.0.0.1:3000/login'), true);
  assert.equal(sitesMatch('http://127.0.0.1:3000', 'http://127.0.0.1:4000'), false);
  assert.equal(sitesMatch('http://localhost:3000', 'http://sub.localhost:3000'), false);
});

test('rejects unsupported schemes', () => {
  assert.equal(parseSiteIdentity('javascript:alert(1)'), null);
  assert.equal(parseSiteIdentity('chrome://settings'), null);
});
