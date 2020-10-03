<?php
session_start();

//クリックジャッキング対策
header('X-FRAME-OPTIONS: SAMEORIGIN');

// トークン生成
if (!isset($_SESSION['token'])) {
    $_SESSION['token'] = sha1(random_bytes(30));
}

// HTML特殊文字をエスケープする関数
function escape($str) {
    return htmlspecialchars($str,ENT_QUOTES,'UTF-8');
}
?>
