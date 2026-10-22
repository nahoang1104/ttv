<?php
if (!defined('TTV_VNPAY')) {
  http_response_code(403);
  exit;
}

date_default_timezone_set('Asia/Ho_Chi_Minh');

function vnpay_cfg() {
  static $cfg = null;
  if ($cfg === null) {
    require __DIR__ . DIRECTORY_SEPARATOR . 'config.php';
    $cfg = $VNPAY;
  }
  return $cfg;
}

function vnpay_json($data, $code = 200) {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode($data);
  exit;
}

function vnpay_app_base() {
  $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (isset($_SERVER['SERVER_PORT']) && (string) $_SERVER['SERVER_PORT'] === '443');
  $scheme = $https ? 'https' : 'http';
  $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost';
  $script = str_replace('\\', '/', isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '');
  $root = dirname(dirname(dirname($script)));
  $root = rtrim($root, '/');
  if ($root === '\\' || $root === '.') $root = '';
  return $scheme . '://' . $host . $root;
}

function vnpay_client_ip() {
  $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '127.0.0.1';
  if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
    $parts = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
    $ip = trim($parts[0]);
  }
  if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) $ip = '127.0.0.1';
  return $ip;
}

function vnpay_hash_data($params, $opts = array()) {
  $skipType = !empty($opts['skip_type']);
  $skipEmpty = !empty($opts['skip_empty']);
  $data = array();
  foreach ($params as $k => $v) {
    if ($k === 'vnp_SecureHash') continue;
    if ($skipType && $k === 'vnp_SecureHashType') continue;
    if ($v === null) continue;
    if ($skipEmpty && $v === '') continue;
    if (strpos($k, 'vnp_') !== 0) continue;
    $data[$k] = (string) $v;
  }
  ksort($data);
  $hash = '';
  $i = 0;
  foreach ($data as $k => $v) {
    if ($i) $hash .= '&';
    $hash .= urlencode($k) . '=' . urlencode($v);
    $i = 1;
  }
  $cfg = vnpay_cfg();
  return array(
    'data' => $data,
    'hash' => $hash,
    'secure' => hash_hmac('sha512', $hash, $cfg['hash_secret']),
  );
}

function vnpay_vn_now() {
  return new DateTime('now', new DateTimeZone('Asia/Ho_Chi_Minh'));
}

function vnpay_build_url($txnRef, $amount, $orderInfo) {
  $cfg = vnpay_cfg();
  $base = vnpay_app_base();
  $now = vnpay_vn_now();
  $params = array(
    'vnp_Amount' => (string) ((int) $amount * 100),
    'vnp_Command' => 'pay',
    'vnp_CreateDate' => $now->format('YmdHis'),
    'vnp_CurrCode' => 'VND',
    'vnp_IpAddr' => vnpay_client_ip(),
    'vnp_Locale' => $cfg['locale'],
    'vnp_OrderInfo' => $orderInfo,
    'vnp_OrderType' => $cfg['order_type'],
    'vnp_ReturnUrl' => $base . '/pay/vnpay/return.php',
    'vnp_TmnCode' => $cfg['tmn_code'],
    'vnp_TxnRef' => (string) $txnRef,
    'vnp_Version' => '2.1.0',
  );
  $hashed = vnpay_hash_data($params, array('skip_empty' => true));
  $query = '';
  foreach ($hashed['data'] as $k => $v) {
    $query .= urlencode($k) . '=' . urlencode($v) . '&';
  }
  $url = $cfg['pay_url'] . '?' . $query . 'vnp_SecureHash=' . $hashed['secure'];
  vnpay_log('create', array('txnRef' => $txnRef, 'amount' => (int) $amount, 'ip' => $params['vnp_IpAddr']));
  return $url;
}

function vnpay_verify($params) {
  $params = $params ?: array();
  $got = isset($params['vnp_SecureHash']) ? strtolower((string) $params['vnp_SecureHash']) : '';
  $ok = false;
  if ($got !== '') {
    $tries = array(
      array(),
      array('skip_type' => true),
      array('skip_empty' => true),
      array('skip_type' => true, 'skip_empty' => true),
    );
    foreach ($tries as $opt) {
      $hashed = vnpay_hash_data($params, $opt);
      if (hash_equals(strtolower($hashed['secure']), $got)) {
        $ok = true;
        break;
      }
    }
  }
  $code = isset($params['vnp_ResponseCode']) ? (string) $params['vnp_ResponseCode'] : '';
  $amount = isset($params['vnp_Amount']) ? (int) $params['vnp_Amount'] : 0;
  return array(
    'valid' => $ok,
    'success' => $ok && $code === '00',
    'code' => $code,
    'txnRef' => isset($params['vnp_TxnRef']) ? (string) $params['vnp_TxnRef'] : '',
    'amount' => (int) floor($amount / 100),
    'bank' => isset($params['vnp_BankCode']) ? (string) $params['vnp_BankCode'] : '',
    'txnNo' => isset($params['vnp_TransactionNo']) ? (string) $params['vnp_TransactionNo'] : '',
  );
}

function vnpay_log($name, $payload) {
  $dir = __DIR__ . DIRECTORY_SEPARATOR . 'logs';
  if (!is_dir($dir)) @mkdir($dir, 0775, true);
  $line = date('c') . ' ' . json_encode($payload, JSON_UNESCAPED_UNICODE) . PHP_EOL;
  @file_put_contents($dir . DIRECTORY_SEPARATOR . $name . '.log', $line, FILE_APPEND);
}

function vnpay_ticket_dir() {
  $dir = __DIR__ . DIRECTORY_SEPARATOR . 'tickets';
  if (!is_dir($dir)) @mkdir($dir, 0775, true);
  return $dir;
}

function vnpay_ticket_path($txnRef) {
  $id = preg_replace('/[^a-zA-Z0-9]/', '', (string) $txnRef);
  if ($id === '') return '';
  return vnpay_ticket_dir() . DIRECTORY_SEPARATOR . $id . '.json';
}

function vnpay_save_ticket($result) {
  $path = vnpay_ticket_path(isset($result['txnRef']) ? $result['txnRef'] : '');
  if ($path === '') return false;
  $result['saved_at'] = date('c');
  return (bool) @file_put_contents($path, json_encode($result));
}

function vnpay_load_ticket($txnRef) {
  $path = vnpay_ticket_path($txnRef);
  if ($path === '' || !is_file($path)) return null;
  $raw = json_decode((string) file_get_contents($path), true);
  return is_array($raw) ? $raw : null;
}
