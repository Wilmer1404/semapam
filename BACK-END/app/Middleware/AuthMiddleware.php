<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Request;
use App\Core\Response;
use App\Services\JwtService;
use Closure;
use Throwable;

final class AuthMiddleware
{
    public function handle(Request $request, Closure $next): void
    {
        $authorization = $request->header('Authorization', '');
        if (!$authorization || !preg_match('/^Bearer\s+(.+)$/i', trim($authorization), $matches)) {
            Response::error('Token no proporcionado.', [], 401);
        }

        $token = trim((string) $matches[1]);
        $token = trim($token, "\"'");
        if ($token === '') {
            Response::error('Token no proporcionado.', [], 401);
        }

        try {
            $decoded = JwtService::decode($token);
            $next($request->withUser((array) $decoded->data));
        } catch (Throwable $e) {
            Response::error('Token inválido o expirado.', [], 401);
        }
    }
}
