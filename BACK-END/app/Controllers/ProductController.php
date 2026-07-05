<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Helpers\Validator;
use App\Models\ProductModel;
use PDOException;

final class ProductController
{
    public function index(Request $request): void
    {
        $products = (new ProductModel())->all();
        Response::success($products, 'Productos obtenidos correctamente.');
    }

    public function show(Request $request): void
    {
        $id = (int) $request->params['id'];
        $product = (new ProductModel())->findById($id);
        if (!$product) {
            Response::error('Producto no encontrado.', [], 404);
        }
        Response::success($product, 'Producto obtenido correctamente.');
    }

    public function store(Request $request): void
    {
        $body = $request->body;
        $errors = Validator::required($body, ['code', 'name', 'unit_price']);
        if (!empty($errors)) {
            Response::error('Datos incompletos.', $errors, 422);
        }

        try {
            $model = new ProductModel();
            $id = $model->create($body);
            $product = $model->findById($id);
            Response::success($product, 'Producto creado correctamente.', 201);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                Response::error('El código del producto ya existe.', [], 409);
            }
            Response::error('Error al crear el producto.', [], 500);
        }
    }

    public function update(Request $request): void
    {
        $id = (int) $request->params['id'];
        $body = $request->body;
        $model = new ProductModel();

        if (!$model->findById($id)) {
            Response::error('Producto no encontrado.', [], 404);
        }

        try {
            $model->update($id, $body);
            $product = $model->findById($id);
            Response::success($product, 'Producto actualizado correctamente.');
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') {
                Response::error('El código del producto ya existe.', [], 409);
            }
            Response::error('Error al actualizar el producto.', [], 500);
        }
    }

    public function destroy(Request $request): void
    {
        $id = (int) $request->params['id'];
        $model = new ProductModel();

        if (!$model->findById($id)) {
            Response::error('Producto no encontrado.', [], 404);
        }

        $model->delete($id);
        Response::success([], 'Producto desactivado correctamente.');
    }
}
