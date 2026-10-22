<?php
/**
 * IPN (server → server). Trên localhost VNPay không gọi được — ví cập nhật qua return.php.
 * Khi deploy public, khai báo URL này cho VNPay: https://<domain>/TTV/pay/vnpay/ipn.php
 */
define('TTV_VNPAY', 1);
require __DIR__ . DIRECTORY_SEPARATOR . 'lib.php';

header('Content-Type: application/json; charset=utf-8');
$result = vnpay_verify($_GET);
if (!empty($result['valid'])) vnpay_save_ticket($result);
vnpay_log('ipn', array('valid' => $result['valid'], 'success' => $result['success'], 'txnRef' => $result['txnRef'], 'code' => $result['code']));

if (!$result['valid']) {
  echo json_encode(array('RspCode' => '97', 'Message' => 'Invalid signature'));
  exit;
}
echo json_encode(array('RspCode' => '00', 'Message' => 'Confirm Success'));
