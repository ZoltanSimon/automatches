<?php
require_once "wp-load.php";
global $wpdb;
$region = $_GET['region'];
$position = $_GET['position'];
$player = $_GET['players'];
$players = explode(",", $player);
$email = $_GET['email'];
$newsletter = $_GET['newsletter'];
$table = "rdt_vote";
foreach ($players as $value) {
    $data = array('region' => $region, 'position' => $position, 'player' => $value, 'email' => $email, 'newsletter' => $newsletter);
    $wpdb->insert($table,$data);
}
?>