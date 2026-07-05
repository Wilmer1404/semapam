<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Helpers\Validator;
use App\Models\UserModel;
use App\Services\JwtService;
use App\Services\LoggerService;
use Throwable;

final class AuthController
{
    public function login(Request $request): void
    {
        try {
            $errors = Validator::required($request->body, ['username', 'password']);
            if ($errors) {
                Response::error('Datos incompletos.', $errors, 422);
            }

            $username = trim((string) $request->input('username'));
            $password = (string) $request->input('password');

            $userModel = new UserModel();
            $user = $userModel->findByUsername($username);

            if (!$user || !password_verify($password, (string) $user['password_hash'])) {
                try {
                    LoggerService::error('Intento de login inválido', ['username' => $username]);
                } catch (Throwable) {
                    // No interrumpir la respuesta si falla el log.
                }
                Response::error('Usuario o contraseña incorrectos.', [], 401);
            }

            if (($user['status'] ?? 'INACTIVE') !== 'ACTIVE') {
                Response::error('El usuario está inactivo.', [], 403);
            }

            $payload = [
                'id' => (int) $user['id'],
                'username' => $user['username'],
                'nombre' => $user['full_name'],
                'role' => $user['role'],
                'correlativo' => (int) ($user['correlativo'] ?? 1),
            ];

            Response::success([
                'token' => JwtService::encode($payload),
                'user' => $payload,
            ], 'Login correcto.');
        } catch (Throwable $e) {
            try {
                LoggerService::error('Error interno en login', ['error' => $e->getMessage()]);
            } catch (Throwable) {
                // Ignorar fallo de logging para devolver error controlado.
            }
            Response::error('Error interno al procesar el login.', [], 500);
        }
    }

    public function me(Request $request): void
    {
        $authUser = (array) ($request->user ?? []);
        $userId = (int) ($authUser['id'] ?? 0);
        if ($userId <= 0) {
            Response::error('Token inválido o sin usuario.', [], 401);
        }

        $user = (new UserModel())->findSessionById($userId);
        if (!$user) {
            Response::error('Usuario no encontrado.', [], 404);
        }

        Response::success([
            'id' => (int) $user['id'],
            'username' => (string) $user['username'],
            'nombre' => (string) $user['full_name'],
            'role' => (string) $user['role'],
            'correlativo' => (int) ($user['correlativo'] ?? 1),
        ], 'Sesión válida.');
    }
}
