<?php

declare(strict_types=1);

use App\Config\App;
use App\Core\Request;
use App\Core\Router;

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../vendor/autoload.php';

App::bootstrap(__DIR__ . '/../.env');

$router = new Router();
require_once __DIR__ . '/../routes/api.php';

$request = Request::capture();
$router->dispatch($request);
