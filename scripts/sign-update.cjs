const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  MAX_UPDATE_BYTES,
  UPDATE_APP_ID,
  UPDATE_SCHEMA_VERSION,
  canonicalUpdatePayload,
  hashFileSha256,
  validateManifestShape
} = require('../server/updateSecurity.cjs');

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

function fail(message) {
  console.error(`[sign-update] ${message}`);
  process.exit(1);
}

const installerArg = readArg('--installer');
const privateKeyArg = readArg('--private-key') || process.env.SCHOOLJUDGE_UPDATE_PRIVATE_KEY || '';
if (!installerArg) fail('Thiếu --installer <path-to-exe>.');
if (!privateKeyArg) fail('Thiếu --private-key hoặc SCHOOLJUDGE_UPDATE_PRIVATE_KEY.');

const installerPath = path.resolve(installerArg);
const privateKeyPath = path.resolve(privateKeyArg);
if (!fs.existsSync(installerPath) || !fs.statSync(installerPath).isFile()) fail('Installer không tồn tại.');
if (!fs.existsSync(privateKeyPath) || !fs.statSync(privateKeyPath).isFile()) fail('Private key không tồn tại.');

const repoRoot = path.resolve(__dirname, '..');
if (privateKeyPath === repoRoot || privateKeyPath.startsWith(`${repoRoot}${path.sep}`)) {
  fail('Private key phải nằm ngoài repository.');
}

const fileName = path.basename(installerPath);
const explicitVersion = readArg('--version');
const fileVersion = fileName.match(/(\d+\.\d+\.\d+)/)?.[1] || '';
const version = explicitVersion || fileVersion;
if (!version) fail('Không tìm thấy version x.y.z trong tên file; dùng --version.');

const stat = fs.statSync(installerPath);
if (stat.size <= 0 || stat.size > MAX_UPDATE_BYTES) fail('Dung lượng installer không hợp lệ.');
const manifest = {
  schemaVersion: UPDATE_SCHEMA_VERSION,
  appId: UPDATE_APP_ID,
  version,
  fileName,
  size: stat.size,
  sha256: hashFileSha256(installerPath),
  publishedAt: new Date().toISOString()
};
const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
manifest.signature = crypto.sign(null, Buffer.from(canonicalUpdatePayload(manifest), 'utf8'), privateKey).toString('base64');
validateManifestShape(manifest);

const outputPath = path.resolve(readArg('--output') || path.join(path.dirname(installerPath), 'update-manifest.json'));
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', mode: 0o644 });
console.log(`[sign-update] Manifest đã tạo: ${outputPath}`);
