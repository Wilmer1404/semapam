<?php

declare(strict_types=1);

namespace App\Core;

final class Response
{
    public static function json(array $payload, int $statusCode = 200): void
    {
        http_response_code($statusCode);
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function success(array $data = [], string $message = 'Operación realizada correctamente.', int $statusCode = 200): void
    {
        self::json([
            'total_rows' => self::resolveTotalRows($data),
            'status' => true,
            'data' => $data,
            'message' => $message,
        ], $statusCode);
    }

    public static function error(string $message = 'Ocurrió un error.', array $data = [], int $statusCode = 400): void
    {
        self::json([
            'total_rows' => self::resolveTotalRows($data),
            'status' => false,
            'data' => $data,
            'message' => $message,
        ], $statusCode);
    }

    private static function resolveTotalRows(array $data): int
    {
        if (array_is_list($data)) {
            return count($data);
        }
        return empty($data) ? 0 : 1;
    }
}
