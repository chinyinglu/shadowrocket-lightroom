/**
 * Adobe Lightroom 会员解锁脚本（Shadowrocket）- 调试增强版
 *
 * 原理：拦截 Lightroom 移动端的授权校验接口
 *   https://lrmobile-api.licensing.adobe.com/...
 * 把返回 JSON 中的授权字段改为"已订阅"状态，让 App 开放高级功能。
 *
 * 调试：所有关键节点都会打 console.log，
 *   Shadowrocket → 设置 → 日志 里搜索 "LR " 即可看到。
 *
 * 仅供学习交流，请支持正版。
 */

const url = $request.url;

// 1) 命中日志：任何进入本脚本的请求都会打印（注意：模块匹配范围之外的请求不会进来）
console.log('LR hit: ' + url);

// 只处理 Adobe 授权接口，其他请求直接放行
if (url.indexOf('lrmobile-api.licensing.adobe.com') === -1) {
  console.log('LR pass: not licensing host');
  $done({});
}

const raw = $response.body;

// 2) 空响应：有些请求没有 body，无需处理
if (!raw || raw.length === 0) {
  console.log('LR empty body, status=' + ($response.status || '?') + ', url=' + url);
  $done({});
}

try {
  const body = JSON.parse(raw);

  // 常见授权字段（不同版本字段名略有差异，存在的字段全部置 true 兜底）
  ['entitled', 'premium', 'is_premium', 'has_entitlement', 'is_entitled'].forEach(
    (k) => {
      if (k in body) body[k] = true;
    }
  );

  // 嵌套结构：subscription
  if (body.subscription && typeof body.subscription === 'object') {
    body.subscription.entitled = true;
    body.subscription.premium = true;
  }

  // 嵌套结构：entitlements 数组
  if (Array.isArray(body.entitlements)) {
    body.entitlements.forEach((e) => {
      if (e && typeof e === 'object') {
        e.entitled = true;
        e.premium = true;
      }
    });
  }

  // 3) 成功日志：打印原始响应，方便核对字段
  console.log('LR unlock OK, url=' + url + ', original body=' + raw);

  $done({ body: JSON.stringify(body) });
} catch (e) {
  // 4) 解析失败：body 不是 JSON（可能是加密/压缩/错误页）
  console.log('LR parse error: ' + e + ', url=' + url + ', body=' + raw);
  $done({});
}
