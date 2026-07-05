<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Models\ProductModel;
use App\Models\ZoneModel;

final class CatalogController
{
    public function products(Request $request): void
    {
        $products = (new ProductModel())->allActive();
        Response::success($products, 'Productos obtenidos correctamente.');
    }

    public function zones(Request $request): void
    {
        $zones = (new ZoneModel())->allPublished();
        Response::success($zones, 'Zonas obtenidas correctamente.');
    }

    public function sync(Request $request): void
    {
        $data = [
            'products' => (new ProductModel())->allActive(),
            'zones' => (new ZoneModel())->allPublished(),
        ];
        Response::success($data, 'Catálogos sincronizados correctamente.');
    }
}
