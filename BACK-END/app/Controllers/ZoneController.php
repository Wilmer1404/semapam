<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Helpers\Validator;
use App\Models\ZoneModel;
use PDOException;

final class ZoneController
{
    public function index(Request $request): void
    {
        $zones = (new ZoneModel())->all();
        Response::success($zones, 'Zonas obtenidas correctamente.');
    }

    public function show(Request $request): void
    {
        $id = (int) $request->params['id'];
        $zone = (new ZoneModel())->findById($id);
        if (!$zone) {
            Response::error('Zona no encontrada.', [], 404);
        }
        Response::success($zone, 'Zona obtenida correctamente.');
    }

    public function store(Request $request): void
    {
        $body = $request->body;
        $errors = Validator::required($body, ['code', 'name']);
        if (!empty($errors)) {
            Response::error('Datos incompletos.', $errors, 422);
        }

        try {
            $model = new ZoneModel();
            $id = $model->create($body);
            $zone = $model->findById($id);
            Response::success($zone, 'Zona creada correctamente.', 201);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                Response::error('El código de zona ya existe.', [], 409);
            }
            Response::error('Error al crear la zona.', [], 500);
        }
    }

    public function update(Request $request): void
    {
        $id = (int) $request->params['id'];
        $body = $request->body;
        $model = new ZoneModel();

        if (!$model->findById($id)) {
            Response::error('Zona no encontrada.', [], 404);
        }

        try {
            $model->update($id, $body);
            $zone = $model->findById($id);
            Response::success($zone, 'Zona actualizada correctamente.');
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                Response::error('El código de zona ya existe.', [], 409);
            }
            Response::error('Error al actualizar la zona.', [], 500);
        }
    }

    public function destroy(Request $request): void
    {
        $id = (int) $request->params['id'];
        $model = new ZoneModel();

        if (!$model->findById($id)) {
            Response::error('Zona no encontrada.', [], 404);
        }

        $model->delete($id);
        Response::success([], 'Zona desactivada correctamente.');
    }
}
