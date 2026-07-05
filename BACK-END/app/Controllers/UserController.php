<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Helpers\Validator;
use App\Models\UserModel;
use PDOException;

final class UserController
{
    private const VALID_ROLES   = ['ADMIN', 'OPERADOR', 'SUPERVISOR'];
    private const VALID_STATUSES = ['ACTIVE', 'BLOCKED', 'INACTIVE'];

    public function index(Request $request): void
    {
        $users = (new UserModel())->all();
        Response::success($users, 'Usuarios obtenidos correctamente.');
    }

    public function show(Request $request): void
    {
        $id = (int) $request->params['id'];
        $user = (new UserModel())->findById($id);
        if (!$user) {
            Response::error('Usuario no encontrado.', [], 404);
        }
        Response::success($user, 'Usuario obtenido correctamente.');
    }

    public function store(Request $request): void
    {
        $body = $request->body;
        $errors = Validator::required($body, ['username', 'password', 'full_name']);
        if (!empty($errors)) {
            Response::error('Datos incompletos.', $errors, 422);
        }

        if (isset($body['role']) && !in_array($body['role'], self::VALID_ROLES, true)) {
            Response::error('Rol inválido. Valores permitidos: ' . implode(', ', self::VALID_ROLES) . '.', [], 422);
        }
        if (isset($body['status']) && !in_array($body['status'], self::VALID_STATUSES, true)) {
            Response::error('Estado inválido. Valores permitidos: ' . implode(', ', self::VALID_STATUSES) . '.', [], 422);
        }

        try {
            $model = new UserModel();
            $id = $model->create($body);
            $user = $model->findById($id);
            Response::success($user, 'Usuario creado correctamente.', 201);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                Response::error('El nombre de usuario ya existe.', [], 409);
            }
            Response::error('Error al crear el usuario.', [], 500);
        }
    }

    public function update(Request $request): void
    {
        $id = (int) $request->params['id'];
        $body = $request->body;
        $model = new UserModel();

        if (!$model->findById($id)) {
            Response::error('Usuario no encontrado.', [], 404);
        }

        if (isset($body['role']) && !in_array($body['role'], self::VALID_ROLES, true)) {
            Response::error('Rol inválido. Valores permitidos: ' . implode(', ', self::VALID_ROLES) . '.', [], 422);
        }
        if (isset($body['status']) && !in_array($body['status'], self::VALID_STATUSES, true)) {
            Response::error('Estado inválido. Valores permitidos: ' . implode(', ', self::VALID_STATUSES) . '.', [], 422);
        }

        try {
            $model->update($id, $body);
            $user = $model->findById($id);
            Response::success($user, 'Usuario actualizado correctamente.');
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                Response::error('El nombre de usuario ya existe.', [], 409);
            }
            Response::error('Error al actualizar el usuario.', [], 500);
        }
    }

    public function destroy(Request $request): void
    {
        $id = (int) $request->params['id'];
        $model = new UserModel();

        if (!$model->findById($id)) {
            Response::error('Usuario no encontrado.', [], 404);
        }

        $model->delete($id);
        Response::success([], 'Usuario desactivado correctamente.');
    }
}
