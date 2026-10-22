<?php
define('TTV_VNPAY', 1);
require __DIR__ . DIRECTORY_SEPARATOR . 'lib.php';

$result = vnpay_verify($_GET);
if (!empty($result['valid'])) vnpay_save_ticket($result);
vnpay_log('return', array('valid' => $result['valid'], 'success' => $result['success'], 'txnRef' => $result['txnRef'], 'code' => $result['code']));
$q = $result['txnRef'] !== '' ? ('?vnpay=' . rawurlencode($result['txnRef'])) : '';
$app = vnpay_app_base() . '/index.html#/wallet' . $q;
$payload = array(
  'params' => $_GET,
  'result' => $result,
);
?><!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>VNPAY — đang trở về ví</title>
</head>
<body>
  <p>Đang trở về ví TingTingVac…</p>
  <script>
    (function () {
      var payload = <?php echo json_encode($payload); ?>;
      var raw = JSON.stringify(payload);
      try { sessionStorage.setItem('ttv_vnpay_return', raw); } catch (e) {}
      try { localStorage.setItem('ttv_vnpay_return', raw); } catch (e) {}
      location.replace(<?php echo json_encode($app); ?>);
    })();
  </script>
</body>
</html>
