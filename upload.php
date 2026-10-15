<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$allowedKind = array('avatar', 'order-images', 'order-videos', 'banners');
$allowedExt = array('jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp', 'mp4', 'webm', 'mov', 'm4v', 'bin');
$maxBytes = 80 * 1024 * 1024;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(array('error' => 'Chỉ nhận POST.'));
  exit;
}

$kind = isset($_POST['kind']) ? (string) $_POST['kind'] : '';
if (!in_array($kind, $allowedKind, true)) {
  http_response_code(400);
  echo json_encode(array('error' => 'Loại file không hợp lệ.'));
  exit;
}

$owner = isset($_POST['ownerId']) ? (string) $_POST['ownerId'] : 'anonymous';
$owner = preg_replace('/[^a-zA-Z0-9_-]/', '_', $owner);
$owner = substr($owner, 0, 64);
if ($owner === '') $owner = 'anonymous';

if (empty($_FILES['file']) || !is_array($_FILES['file'])) {
  http_response_code(400);
  echo json_encode(array('error' => 'Chưa nhận được file.'));
  exit;
}

$err = (int) $_FILES['file']['error'];
if ($err !== UPLOAD_ERR_OK) {
  http_response_code(400);
  echo json_encode(array('error' => 'Tải file thất bại (mã ' . $err . ').'));
  exit;
}

$size = (int) $_FILES['file']['size'];
if ($size <= 0 || $size > $maxBytes) {
  http_response_code(400);
  echo json_encode(array('error' => 'File trống hoặc vượt quá 80MB.'));
  exit;
}

$orig = (string) $_FILES['file']['name'];
$ext = strtolower(pathinfo($orig, PATHINFO_EXTENSION));
if (!in_array($ext, $allowedExt, true)) {
  $mime = (string) $_FILES['file']['type'];
  if (strpos($mime, 'image/') === 0) $ext = 'jpg';
  else if (strpos($mime, 'video/') === 0) $ext = 'mp4';
  else {
    http_response_code(400);
    echo json_encode(array('error' => 'Định dạng file không được phép.'));
    exit;
  }
}

$dir = __DIR__ . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . $owner . DIRECTORY_SEPARATOR . $kind;
if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
  http_response_code(500);
  echo json_encode(array('error' => 'Không tạo được thư mục uploads.'));
  exit;
}

$filename = bin2hex(random_bytes(16)) . '.' . $ext;
$dest = $dir . DIRECTORY_SEPARATOR . $filename;
if (!move_uploaded_file($_FILES['file']['tmp_name'], $dest)) {
  http_response_code(500);
  echo json_encode(array('error' => 'Không ghi được file vào uploads/.'));
  exit;
}

$path = 'uploads/' . $owner . '/' . $kind . '/' . $filename;
echo json_encode(array(
  'path' => $path,
  'name' => $filename,
  'type' => (string) $_FILES['file']['type'],
  'size' => $size,
  'kind' => $kind
));
