<?php
// Specify the folder path
$folderPath = 'Matches';

// Initialize an array to hold the JSON data
$jsonData = [];

// Get a list of JSON files in the folder
$files = glob($folderPath . '/*.json');

// Loop through the files and read their content
foreach ($files as $file) {
    $jsonContent = file_get_contents($file);
    $jsonData[] = json_decode($jsonContent, true);
}

// Convert the array to a single JSON string
$finalJson = json_encode($jsonData);

// Set the content type to JSON
header('Content-Type: application/json');

// Output the JSON data
echo $finalJson;
?>