<?php
define('TTV_VNPAY', 1);
require __DIR__ . DIRECTORY_SEPARATOR . 'lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  vnpay_json(array('error' => 'Chỉ nhận POST.'), 405);
}

$raw = json_decode(file_get_contents('php://input'), true);
if (!is_array($raw)) $raw = $_POST;
$txnRef = isset($raw['txnRef']) ? preg_replace('/[^a-zA-Z0-9]/', '', (string) $raw['txnRef']) : '';
$ticket = $txnRef ? vnpay_load_ticket($txnRef) : null;
if (!$ticket) {
  vnpay_json(array('error' => 'Không tìm thấy kết quả thanh toán.'), 404);
}
vnpay_json($ticket);
