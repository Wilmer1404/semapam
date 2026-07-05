<?php

declare(strict_types=1);

namespace App\Config;

use PDO;
use PDOException;

final class Database
{
    private static ?PDO $connection = null;

    public static function connection(): PDO
    {
        if (self::$connection instanceof PDO) {
            return self::$connection;
        }

        $host = App::env('DB_HOST', 'mysql-server');
        $port = App::env('DB_PORT', '3306');
        $dbName = App::env('DB_DATABASE', 'dispensador_agua');
        $user = App::env('DB_USERNAME', 'root');
        $password = App::env('DB_PASSWORD', 'lx1b8h4d2k');

        $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $dbName);

        try {
            self::$connection = new PDO($dsn, $user, $password, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode([
                'total_rows' => 0,
                'status' => false,
                'data' => [],
                'message' => 'No se pudo conectar a la base de datos: ' . $e->getMessage(),
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        return self::$connection;
    }
}
