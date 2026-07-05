<?php

declare(strict_types=1);

namespace App\Services;

use App\Config\App;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;

final class JwtService
{
    public static function encode(array $payload): string
    {
        $issuedAt = time();
        $ttlHours = (int) App::env('JWT_TTL_HOURS', 12);
        $secret = (string) App::env('JWT_SECRET', 'change_this_jwt_secret');

        $tokenPayload = [
            'iat' => $issuedAt,
            'exp' => $issuedAt + ($ttlHours * 3600),
            'data' => $payload,
        ];

        return JWT::encode($tokenPayload, $secret, 'HS256');
    }

    public static function decode(string $token): object
    {
        $secret = (string) App::env('JWT_SECRET', 'change_this_jwt_secret');
        return JWT::decode($token, new Key($secret, 'HS256'));
    }
}
