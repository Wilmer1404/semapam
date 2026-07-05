<?php

declare(strict_types=1);

namespace App\Services;

final class LoggerService
{
    public static function info(string $message, array $context = []): void
    {
        self::write('INFO', $message, $context);
    }

    public static function error(string $message, array $context = []): void
    {
        self::write('ERROR', $message, $context);
    }

    private static function write(string $level, string $message, array $context): void
    {
        $line = sprintf(
            "[%s] %s: %s %s%s",
            date('Y-m-d H:i:s'),
            $level,
            $message,
            json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            PHP_EOL,
        );

        $path = dirname(__DIR__, 2) . '/storage/logs/app.log';
        file_put_contents($path, $line, FILE_APPEND);
    }
}
