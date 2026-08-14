/**
 * Adobe Lightroom 会员解锁脚本（Shadowrocket 小火箭）
 *
 * 目标接口: https://lcs-mobile-cops.adobe.io/mobiles/access_profile/v3
 * 原理: 响应是 {"asnp":{"payload":"<base64(JSON)>"}}
 *      解码 payload -> 把授权字段改成已订阅 -> 重新编码
 *
 * 仅供学习交流，请支持正版。
 */

// 自包含 base64（Shadowrocket 的 JS 运行时没有 Buffer / atob）
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
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buf >> bits) & 0xff);
    }
  }
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return str;
}

function _b64encode(s) {
  const bytes = [];
  for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 0xff); // 内容为 ASCII
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += _b64chars[b0 >> 2];
    out += _b64chars[((b0 & 3) << 4) | ((b1 === undefined ? 0 : b1) >> 4)];
    out += b1 === undefined ? '=' : _b64chars[((b1 & 15) << 2) | ((b2 === undefined ? 0 : b2) >> 6)];
    out += b2 === undefined ? '=' : _b64chars[b2 & 63];
  }
  return out;
}

const url = $request.url;

// 只处理授权接口，其他请求放行
if (url.indexOf('lcs-mobile-cops.adobe.io') === -1) {
  $done({});
}

let body;
try {
  body = JSON.parse($response.body);
} catch (e) {
  console.log('LR outer parse error: ' + e + ', body=' + $response.body);
  $done({});
}

if (body && body.asnp && body.asnp.payload) {
  try {
    const inner = JSON.parse(_b64decode(body.asnp.payload));

    // 核心授权字段
    inner.profileStatus = 'PROFILE_AVAILABLE';
    inner.profileStatusReason = 0;
    inner.profileStatusReasonText = '';
    inner.appLicenseMode = 'NAMED_USER';

    // 权益项
    const items = inner.appProfile && inner.appProfile.accessibleItems;
    if (Array.isArray(items)) {
      items.forEach(function (it) {
        if (it.source) {
          it.source.type = 'FULFILLED_ENTITLEMENT';
          it.source.status_reason = null;
        }
        const cc = it.fulfillable_items && it.fulfillable_items.cc_storage;
        if (cc && cc.charging_model) {
          cc.charging_model.cap = 1099511627776; // 1TB
          cc.charging_model.unit = 'GB';
          cc.charging_model.model = 'RECURRING';
          cc.charging_model.overage = 'NA';
        }
      });
    }

    body.asnp.payload = _b64encode(JSON.stringify(inner));
    console.log('LR patched OK');
  } catch (e) {
    console.log('LR asnp decode error: ' + e);
  }
}

$done({ body: JSON.stringify(body) });
