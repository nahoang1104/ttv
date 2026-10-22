<?php
define('TTV_VNPAY', 1);
require __DIR__ . DIRECTORY_SEPARATOR . 'lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  vnpay_json(array('error' => 'Chỉ nhận POST.'), 405);
}

$raw = json_decode(file_get_contents('php://input'), true);
if (!is_array($raw)) $raw = $_POST;
$txnRef = isset($raw['txnRef']) ? preg_replace('/[^a-zA-Z0-9]/', '', (string) $raw['txnRef']) : '';
$amount = isset($raw['amount']) ? (int) $raw['amount'] : 0;
$info = 'NapTTV-' . $txnRef;
if ($txnRef === '' || strlen($txnRef) < 8) {
  vnpay_json(array('error' => 'Mã giao dịch không hợp lệ.'), 400);
}
if ($amount < 10000 || $amount > 50000000) {
  vnpay_json(array('error' => 'Số tiền nạp từ 10.000đ đến 50.000.000đ.'), 400);
}

$url = vnpay_build_url($txnRef, $amount, $info);
vnpay_json(array('url' => $url, 'txnRef' => $txnRef, 'amount' => $amount));
