/**
 * Adobe Lightroom 会员解锁脚本（Shadowrocket）
 *
 * 原理：拦截 Lightroom 移动端的授权校验接口
 *   https://lrmobile-api.licensing.adobe.com/v1/lightroom
 * 把返回 JSON 中的授权字段改为"已订阅"状态，让 App 开放高级功能。
 *
 * 仅供学习交流，请支持正版。
 */

const url = $request.url;

// 只处理 Adobe 授权接口，其他请求直接放行
if (url.indexOf('lrmobile-api.licensing.adobe.com') === -1) {
  $done({});
}

try {
  const body = JSON.parse($response.body);

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

  // 打印原始响应，方便排错（Shadowrocket → 设置 → 日志可查看）
  console.log('LR unlock OK, original body: ' + $response.body);

  $done({ body: JSON.stringify(body) });
} catch (e) {
  console.log('LR unlock error: ' + e);
  $done({});
}
