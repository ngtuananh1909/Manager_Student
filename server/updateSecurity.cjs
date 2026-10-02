const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const UPDATE_APP_ID = 'com.chaucaojudge.lan';
const UPDATE_SCHEMA_VERSION = 1;
const MAX_UPDATE_BYTES = 500 * 1024 * 1024;

class UpdateSecurityError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'UpdateSecurityError';
    this.code = code;
  }
}

class VerifiedUpdateState {
  constructor() {
    this.pending = null;
  }

  markVerified(installerPath, manifest) {
    if (!installerPath || !manifest) fail('UPDATE_NOT_VERIFIED', 'Bản cập nhật chưa được xác minh.');
    this.pending = { installerPath, manifest };
  }

  clear() {
    this.pending = null;
  }

  consume() {
    if (!this.pending) fail('UPDATE_NOT_VERIFIED', 'Chưa có bản cập nhật đã xác minh để cài đặt.');
    const verified = this.pending;
    this.pending = null;
    return verified;
  }
}

function fail(code, message) {
  throw new UpdateSecurityError(code, message);
}

function parseVersion(value) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(String(value || ''));
  if (!match) fail('INVALID_UPDATE_VERSION', 'Phiên bản cập nhật phải có dạng x.y.z.');
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] > b[index]) return 1;
    if (a[index] < b[index]) return -1;
  }
  return 0;
}

function validateManifestShape(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    fail('INVALID_UPDATE_MANIFEST', 'Manifest cập nhật không hợp lệ.');
  }
  if (manifest.schemaVersion !== UPDATE_SCHEMA_VERSION) {
    fail('INVALID_UPDATE_SCHEMA', 'Phiên bản schema cập nhật không được hỗ trợ.');
  }
  if (manifest.appId !== UPDATE_APP_ID) {
    fail('INVALID_UPDATE_APP', 'Manifest không thuộc ứng dụng ChauCaoJudge.');
  }
  parseVersion(manifest.version);
  if (
    typeof manifest.fileName !== 'string' ||
    path.basename(manifest.fileName) !== manifest.fileName ||
    !/^[a-zA-Z0-9._ -]+\.exe$/i.test(manifest.fileName)
  ) {
    fail('INVALID_UPDATE_FILENAME', 'Tên file cập nhật không hợp lệ.');
  }
  if (!Number.isSafeInteger(manifest.size) || manifest.size <= 0 || manifest.size > MAX_UPDATE_BYTES) {
    fail('INVALID_UPDATE_SIZE', 'Dung lượng file cập nhật không hợp lệ.');
  }
  if (!/^[a-f0-9]{64}$/.test(String(manifest.sha256 || ''))) {
    fail('INVALID_UPDATE_HASH', 'SHA-256 trong manifest không hợp lệ.');
  }
  if (typeof manifest.publishedAt !== 'string' || !Number.isFinite(Date.parse(manifest.publishedAt))) {
    fail('INVALID_UPDATE_DATE', 'Thời điểm phát hành không hợp lệ.');
  }
  if (typeof manifest.signature !== 'string' || !/^[a-zA-Z0-9+/]+={0,2}$/.test(manifest.signature)) {
    fail('INVALID_UPDATE_SIGNATURE', 'Chữ ký manifest không hợp lệ.');
  }
  return true;
}

function canonicalUpdatePayload(manifest) {
  return [
    'SCHOOLJUDGE_UPDATE_V1',
    String(manifest.schemaVersion),
    String(manifest.appId),
    String(manifest.version),
    String(manifest.fileName),
    String(manifest.size),
    String(manifest.sha256),
    String(manifest.publishedAt)
  ].join('\n');
}

function verifyUpdateManifest(manifest, publicKey) {
  validateManifestShape(manifest);
  if (!publicKey) fail('UPDATE_KEY_UNAVAILABLE', 'Khóa xác minh cập nhật chưa được cấu hình.');
  let verified = false;
  try {
    verified = crypto.verify(
      null,
      Buffer.from(canonicalUpdatePayload(manifest), 'utf8'),
      publicKey,
      Buffer.from(manifest.signature, 'base64')
    );
  } catch {
    fail('INVALID_UPDATE_SIGNATURE', 'Không thể xác minh chữ ký manifest.');
  }
  if (!verified) fail('INVALID_UPDATE_SIGNATURE', 'Chữ ký manifest không hợp lệ.');
  return true;
}

function hashFileSha256(filePath) {
  const hash = crypto.createHash('sha256');
  const descriptor = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest('hex');
}

function verifyUpdateArtifact({ manifest, publicKey, installerPath, currentVersion }) {
  verifyUpdateManifest(manifest, publicKey);
  if (compareVersions(manifest.version, currentVersion) <= 0) {
    fail('UPDATE_NOT_NEWER', 'Bản cập nhật không mới hơn phiên bản hiện tại.');
  }
  if (!installerPath || path.basename(installerPath) !== manifest.fileName || !fs.existsSync(installerPath)) {
    fail('UPDATE_FILE_MISMATCH', 'File cập nhật không khớp manifest.');
  }
  const stat = fs.statSync(installerPath);
  if (!stat.isFile() || stat.size !== manifest.size) {
    fail('UPDATE_SIZE_MISMATCH', 'Dung lượng file cập nhật không khớp manifest.');
  }
  const digest = hashFileSha256(installerPath);
  const expected = Buffer.from(manifest.sha256, 'hex');
  const actual = Buffer.from(digest, 'hex');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    fail('UPDATE_HASH_MISMATCH', 'SHA-256 của file cập nhật không khớp manifest.');
  }
  return true;
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 127;
}

function validateLanServerUrl(value) {
  let url;
  try {
    url = new URL(String(value || ''));
  } catch {
    fail('INVALID_UPDATE_SERVER', 'Địa chỉ máy chủ cập nhật không hợp lệ.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    fail('INVALID_UPDATE_SERVER', 'Giao thức máy chủ cập nhật phải là HTTP hoặc HTTPS.');
  }
  return url.origin;
}

function isTrustedRendererUrl(value, { packaged, packagedEntryUrl } = {}) {
  let url;
  try {
    url = new URL(String(value || ''));
  } catch {
    return false;
  }
  if (packaged) {
    if (url.protocol !== 'file:' || !packagedEntryUrl) return false;
    try {
      return url.href === new URL(packagedEntryUrl).href;
    } catch {
      return false;
    }
  }
  return url.origin === 'http://localhost:5173' || url.origin === 'http://127.0.0.1:5173';
}

module.exports = {
  MAX_UPDATE_BYTES,
  UPDATE_APP_ID,
  UPDATE_SCHEMA_VERSION,
  UpdateSecurityError,
  VerifiedUpdateState,
  canonicalUpdatePayload,
  compareVersions,
  hashFileSha256,
  isTrustedRendererUrl,
  validateLanServerUrl,
  validateManifestShape,
  verifyUpdateArtifact,
  verifyUpdateManifest
};
