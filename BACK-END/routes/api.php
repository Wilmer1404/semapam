<?php

declare(strict_types=1);

use App\Controllers\AbastecimientoController;
use App\Controllers\ArqueoController;
use App\Controllers\AuthController;
use App\Controllers\CatalogController;
use App\Controllers\ProductController;
use App\Controllers\TicketController;
use App\Controllers\UserController;
use App\Controllers\ZoneController;
use App\Middleware\AuthMiddleware;

$router->post('/login', [AuthController::class, 'login']);
$router->get('/me', [AuthController::class, 'me'], [AuthMiddleware::class]);

// Catálogos (solo lectura para la app móvil)
$router->get('/catalogs/products', [CatalogController::class, 'products'], [AuthMiddleware::class]);
$router->get('/catalogs/zones', [CatalogController::class, 'zones'], [AuthMiddleware::class]);
$router->get('/sync/catalogs', [CatalogController::class, 'sync'], [AuthMiddleware::class]);

// Productos (CRUD maestro)
$router->get('/products', [ProductController::class, 'index'], [AuthMiddleware::class]);
$router->get('/products/{id}', [ProductController::class, 'show'], [AuthMiddleware::class]);
$router->post('/products', [ProductController::class, 'store'], [AuthMiddleware::class]);
$router->put('/products/{id}', [ProductController::class, 'update'], [AuthMiddleware::class]);
$router->delete('/products/{id}', [ProductController::class, 'destroy'], [AuthMiddleware::class]);

// Zonas (CRUD maestro)
$router->get('/zones', [ZoneController::class, 'index'], [AuthMiddleware::class]);
$router->get('/zones/{id}', [ZoneController::class, 'show'], [AuthMiddleware::class]);
$router->post('/zones', [ZoneController::class, 'store'], [AuthMiddleware::class]);
$router->put('/zones/{id}', [ZoneController::class, 'update'], [AuthMiddleware::class]);
$router->delete('/zones/{id}', [ZoneController::class, 'destroy'], [AuthMiddleware::class]);

// Usuarios (CRUD maestro)
$router->get('/users', [UserController::class, 'index'], [AuthMiddleware::class]);
$router->get('/users/{id}', [UserController::class, 'show'], [AuthMiddleware::class]);
$router->post('/users', [UserController::class, 'store'], [AuthMiddleware::class]);
$router->put('/users/{id}', [UserController::class, 'update'], [AuthMiddleware::class]);
$router->delete('/users/{id}', [UserController::class, 'destroy'], [AuthMiddleware::class]);

// Abastecimientos
$router->get('/abastecimientos', [AbastecimientoController::class, 'index'], [AuthMiddleware::class]);
$router->get('/abastecimientos/{id}', [AbastecimientoController::class, 'show'], [AuthMiddleware::class]);
$router->post('/abastecimientos', [AbastecimientoController::class, 'store'], [AuthMiddleware::class]);
$router->post('/sync/abastecimientos', [AbastecimientoController::class, 'sync'], [AuthMiddleware::class]);

// Tickets
$router->get('/tickets', [TicketController::class, 'index'], [AuthMiddleware::class]);
$router->get('/tickets/{id}', [TicketController::class, 'show'], [AuthMiddleware::class]);
$router->post('/tickets/{id}/reprint', [TicketController::class, 'reprint'], [AuthMiddleware::class]);

// Arqueo
$router->get('/arqueo/daily', [ArqueoController::class, 'daily'], [AuthMiddleware::class]);

