<?php
/**
 * VNPay sandbox — KHÔNG đưa file này ra trình duyệt (bị chặn bởi .htaccess).
 * Đổi sang production: sửa tmn_code, hash_secret, pay_url, rồi khai báo IPN public.
 * Có thể ghi đè bằng pay/vnpay/config.local.php (không commit).
 */
$VNPAY = array(
  'tmn_code' => 'MIHXRET6',
  'hash_secret' => 'MOQRCSFMVOOXQQSZMRMWASGSJNLNVCBA',
  'pay_url' => 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  'locale' => 'vn',
  'order_type' => 'billpayment',
  'expire_min' => 30,
);

$local = __DIR__ . DIRECTORY_SEPARATOR . 'config.local.php';
if (is_file($local)) {
  $override = include $local;
  if (is_array($override)) $VNPAY = array_merge($VNPAY, $override);
}
