const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  UpdateSecurityError,
  VerifiedUpdateState,
  canonicalUpdatePayload,
  compareVersions,
  isTrustedRendererUrl,
  validateLanServerUrl,
  verifyUpdateArtifact,
  verifyUpdateManifest
} = require('../server/updateSecurity.cjs');

function signedFixture() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const bytes = Buffer.from('signed installer bytes');
  const manifest = {
    schemaVersion: 1,
    appId: 'com.chaucaojudge.lan',
    version: '1.3.0',
    fileName: 'ChauCaoJudge_Setup_1.3.0.exe',
    size: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    publishedAt: '2026-10-02T00:00:00.000Z'
  };
  manifest.signature = crypto.sign(null, Buffer.from(canonicalUpdatePayload(manifest)), privateKey).toString('base64');
  return {
    bytes,
    manifest,
    publicKey: publicKey.export({ type: 'spki', format: 'pem' })
  };
}

function expectCode(callback, code) {
  assert.throws(callback, error => error instanceof UpdateSecurityError && error.code === code);
}

test('signed manifest and exact installer bytes verify successfully', () => {
  const fixture = signedFixture();
  assert.equal(verifyUpdateManifest(fixture.manifest, fixture.publicKey), true);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schooljudge-update-test-'));
  const installerPath = path.join(dir, fixture.manifest.fileName);
  fs.writeFileSync(installerPath, fixture.bytes);
  try {
    assert.equal(verifyUpdateArtifact({
      manifest: fixture.manifest,
      publicKey: fixture.publicKey,
      installerPath,
      currentVersion: '1.2.0'
    }), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('tampered manifests, artifacts and downgrade attempts fail closed', () => {
  const fixture = signedFixture();
  expectCode(() => verifyUpdateManifest({ ...fixture.manifest, sha256: '0'.repeat(64) }, fixture.publicKey), 'INVALID_UPDATE_SIGNATURE');
  expectCode(() => verifyUpdateManifest({ ...fixture.manifest, appId: 'evil.app' }, fixture.publicKey), 'INVALID_UPDATE_APP');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'schooljudge-update-test-'));
  const installerPath = path.join(dir, fixture.manifest.fileName);
  fs.writeFileSync(installerPath, Buffer.from('tampered installer'));
  try {
    expectCode(() => verifyUpdateArtifact({
      manifest: fixture.manifest,
      publicKey: fixture.publicKey,
      installerPath,
      currentVersion: '1.2.0'
    }), 'UPDATE_SIZE_MISMATCH');
    expectCode(() => verifyUpdateArtifact({
      manifest: fixture.manifest,
      publicKey: fixture.publicKey,
      installerPath,
      currentVersion: '1.3.0'
    }), 'UPDATE_NOT_NEWER');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('update URLs accept HTTP and HTTPS hosts and normalize origins', () => {
  assert.equal(validateLanServerUrl('http://127.0.0.1:4000'), 'http://127.0.0.1:4000');
  assert.equal(validateLanServerUrl('http://192.168.10.20:4000/'), 'http://192.168.10.20:4000');
  assert.equal(validateLanServerUrl('http://10.2.3.4:4000'), 'http://10.2.3.4:4000');
  assert.equal(validateLanServerUrl('http://172.16.0.9:4000'), 'http://172.16.0.9:4000');
  assert.equal(validateLanServerUrl('https://192.168.1.2:4000'), 'https://192.168.1.2:4000');
  assert.equal(validateLanServerUrl('http://192.168.1.2:5000'), 'http://192.168.1.2:5000');
  assert.equal(validateLanServerUrl('http://192.168.1.2:4000/path'), 'http://192.168.1.2:4000');

  for (const value of [
    'ftp://192.168.1.2:4000',
    'javascript:alert(1)',
    'not-a-url'
  ]) {
    expectCode(() => validateLanServerUrl(value), 'INVALID_UPDATE_SERVER');
  }
});

test('renderer sender allowlist accepts only the local app or Vite development origin', () => {
  const packagedEntryUrl = 'file:///C:/Program%20Files/ChauCaoJudge/dist/index.html';
  assert.equal(isTrustedRendererUrl(packagedEntryUrl, { packaged: true, packagedEntryUrl }), true);
  assert.equal(isTrustedRendererUrl('file:///C:/Users/Public/attacker.html', { packaged: true, packagedEntryUrl }), false);
  assert.equal(isTrustedRendererUrl('http://localhost:5173/', { packaged: false }), true);
  assert.equal(isTrustedRendererUrl('http://127.0.0.1:5173/', { packaged: false }), true);
  assert.equal(isTrustedRendererUrl('https://attacker.example/', { packaged: true }), false);
  assert.equal(isTrustedRendererUrl('http://192.168.1.2:5173/', { packaged: false }), false);
});

test('version comparison accepts strict three-part semantic versions only', () => {
  assert.equal(compareVersions('1.3.0', '1.2.9'), 1);
  assert.equal(compareVersions('1.2.0', '1.2.0'), 0);
  assert.equal(compareVersions('1.1.9', '1.2.0'), -1);
  expectCode(() => compareVersions('1.2', '1.2.0'), 'INVALID_UPDATE_VERSION');
});

test('installer state never accepts a renderer-provided path and is single-use', () => {
  const state = new VerifiedUpdateState();
  expectCode(() => state.consume(), 'UPDATE_NOT_VERIFIED');

  state.markVerified('/trusted/internal/ChauCaoJudge_Setup_1.3.0.exe', { version: '1.3.0' });
  assert.deepEqual(state.consume(), {
    installerPath: '/trusted/internal/ChauCaoJudge_Setup_1.3.0.exe',
    manifest: { version: '1.3.0' }
  });
  expectCode(() => state.consume(), 'UPDATE_NOT_VERIFIED');
});
