<?php
define('TTV_VNPAY', 1);
require __DIR__ . DIRECTORY_SEPARATOR . 'lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  vnpay_json(array('error' => 'Chỉ nhận POST.'), 405);
}

$raw = json_decode(file_get_contents('php://input'), true);
if (!is_array($raw)) $raw = $_POST;
$result = vnpay_verify($raw);
if (empty($result['valid'])) {
  $ref = isset($result['txnRef']) ? $result['txnRef'] : (isset($raw['vnp_TxnRef']) ? $raw['vnp_TxnRef'] : (isset($raw['txnRef']) ? $raw['txnRef'] : ''));
  $ticket = vnpay_load_ticket($ref);
  if ($ticket) $result = $ticket;
}
vnpay_json($result);
