/* Lightroom 会员解锁 - Quantumult X (圈X)
 *
 * 目标: https://lcs-mobile-cops.adobe.io/mobiles/access_profile/v3
 * 响应: {"asnp":{"payload":"<base64(JSON)>"}} -> 解码改字段 -> 重新编码
 * 仅供学习交流，请支持正版。
 */

// 自包含 base64（JavaScriptCore 无 Buffer/atob）
const _b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function _b64decode(s) {
  s = s.replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes = [];
  let buf = 0, bits = 0;
  for (let i = 0; i < s.length; i++) {
    const idx = _b64chars.indexOf(s[i]);
    if (idx === -1) continue;
    buf = (buf << 6) | idx;
    bits += 6;
    if (bits >= 8) { bits -= 8; bytes.push((buf >> bits) & 0xff); }
  }
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return str;
}

function _b64encode(s) {
  const bytes = [];
  for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 0xff);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
    out += _b64chars[b0 >> 2];
    out += _b64chars[((b0 & 3) << 4) | ((b1 === undefined ? 0 : b1) >> 4)];
    out += b1 === undefined ? '=' : _b64chars[((b1 & 15) << 2) | ((b2 === undefined ? 0 : b2) >> 6)];
    out += b2 === undefined ? '=' : _b64chars[b2 & 63];
  }
  return out;
}

let body;
try {
  body = JSON.parse($response.body);
} catch (e) {
  console.log('LR outer parse error: ' + e);
  $done({});
}

if (body && body.asnp && body.asnp.payload) {
  try {
    const inner = JSON.parse(_b64decode(body.asnp.payload));

    inner.profileStatus = 'PROFILE_AVAILABLE';
    inner.profileStatusReason = 0;
    inner.profileStatusReasonText = '';
    inner.appLicenseMode = 'NAMED_USER';

    const items = inner.appProfile && inner.appProfile.accessibleItems;
    if (Array.isArray(items)) {
      items.forEach(function (it) {
        if (it.source) {
          it.source.type = 'FULFILLED_ENTITLEMENT';
          it.source.status_reason = null;
        }
        const cc = it.fulfillable_items && it.fulfillable_items.cc_storage;
        if (cc && cc.charging_model) {
          cc.charging_model.cap = 1024; // 1TB（单位 GB）
          cc.charging_model.unit = 'GB';
          cc.charging_model.model = 'RECURRING';
          cc.charging_model.overage = 'NA';
        }
      });
    }

    // 缓存控制：Adobe 默认缓存授权约 180 天，会导致修改迟迟不生效。
    // 改为 24 小时内过期，App 会尽快重新请求授权，避免被旧缓存锁死。
    const now = Date.now();
    if (inner.controlProfile) {
      inner.controlProfile.cacheLifetime = 86400000; // 24h
      inner.controlProfile.validUptoTimestamp = now + 86400000;
      if (inner.controlProfile.cacheExpiryWarningControl) {
        inner.controlProfile.cacheExpiryWarningControl.warningStartTimestamp = now + 3600000;
      }
    }

    body.asnp.payload = _b64encode(JSON.stringify(inner));
    console.log('LR patched OK');
  } catch (e) {
    console.log('LR asnp decode error: ' + e);
  }
}

$done({ body: JSON.stringify(body) });
