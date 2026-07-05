<?php

declare(strict_types=1);

namespace App\Config;

final class App
{
    private static array $env = [];

    public static function bootstrap(string $envPath): void
    {
        if (file_exists($envPath)) {
            $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
            foreach ($lines as $line) {
                if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) {
                    continue;
                }
                [$key, $value] = explode('=', $line, 2);
                $key = trim($key);
                $value = trim($value);
                self::$env[$key] = $value;
                $_ENV[$key] = $value;
            }
        }

        date_default_timezone_set(self::env('APP_TIMEZONE', 'America/Lima'));
    }

    public static function env(string $key, mixed $default = null): mixed
    {
        return $_ENV[$key] ?? self::$env[$key] ?? $default;
    }
}
