<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Helpers\Validator;
use App\Models\AbastecimientoModel;
use App\Services\LoggerService;
use PDOException;
use Throwable;

final class AbastecimientoController
{
    private const VALID_ZONE_METHODS = ['AUTO', 'MANUAL', 'UNRESOLVED'];
    private const VALID_SYNC_STATUS = ['PENDING', 'SYNCED', 'ERROR'];
    private const VALID_PRINT_STATUS = ['PENDING', 'PRINTED', 'ERROR'];

    public function index(Request $request): void
    {
        $date = $request->query['date'] ?? null;
        if ($date !== null && !$this->isValidDate((string) $date)) {
            Response::error('El parametro date debe tener formato YYYY-MM-DD.', ['date' => 'Formato invalido'], 422);
        }

        $from = $request->query['from'] ?? null;
        $to = $request->query['to'] ?? null;
        if ($from !== null && !$this->isValidDate((string) $from)) {
            Response::error('El parametro from debe tener formato YYYY-MM-DD.', ['from' => 'Formato invalido'], 422);
        }
        if ($to !== null && !$this->isValidDate((string) $to)) {
            Response::error('El parametro to debe tener formato YYYY-MM-DD.', ['to' => 'Formato invalido'], 422);
        }
        if (($from !== null && $to === null) || ($from === null && $to !== null)) {
            Response::error('Para filtrar por rango debe enviar from y to juntos (YYYY-MM-DD).', ['from_to' => 'Formato invalido'], 422);
        }
        if ($from !== null && $to !== null && $from > $to) {
            Response::error('El parametro from no puede ser mayor que to.', ['from_to' => 'Rango invalido'], 422);
        }

        $offset = isset($request->query['offset']) ? (int) $request->query['offset'] : 0;
        $limit = isset($request->query['limit']) ? (int) $request->query['limit'] : 20;
        if ($offset < 0) {
            Response::error('El parametro offset debe ser mayor o igual a 0.', ['offset' => 'Formato invalido'], 422);
        }
        if ($limit <= 0 || $limit > 200) {
            Response::error('El parametro limit debe estar entre 1 y 200.', ['limit' => 'Formato invalido'], 422);
        }

        $zoneMethod = isset($request->query['zone_method']) ? strtoupper((string) $request->query['zone_method']) : null;
        $syncStatus = isset($request->query['sync_status']) ? strtoupper((string) $request->query['sync_status']) : null;
        $printStatus = isset($request->query['print_status']) ? strtoupper((string) $request->query['print_status']) : null;

        if ($zoneMethod !== null && $zoneMethod !== '' && !in_array($zoneMethod, self::VALID_ZONE_METHODS, true)) {
            Response::error('zone_method invalido. Valores permitidos: AUTO, MANUAL, UNRESOLVED.', ['zone_method' => 'Formato invalido'], 422);
        }
        if ($syncStatus !== null && $syncStatus !== '' && !in_array($syncStatus, self::VALID_SYNC_STATUS, true)) {
            Response::error('sync_status invalido. Valores permitidos: PENDING, SYNCED, ERROR.', ['sync_status' => 'Formato invalido'], 422);
        }
        if ($printStatus !== null && $printStatus !== '' && !in_array($printStatus, self::VALID_PRINT_STATUS, true)) {
            Response::error('print_status invalido. Valores permitidos: PENDING, PRINTED, ERROR.', ['print_status' => 'Formato invalido'], 422);
        }

        $filters = [
            'date' => $date,
            'from' => $from,
            'to' => $to,
            'local_id' => $request->query['local_id'] ?? null,
            'ticket' => $request->query['ticket'] ?? null,
            'receiver' => $request->query['receiver'] ?? null,
            'driver' => $request->query['driver'] ?? $request->query['conductor'] ?? null,
            'product' => $request->query['product'] ?? null,
            'zone_method' => $zoneMethod,
            'sync_status' => $syncStatus,
            'print_status' => $printStatus,
            'offset' => $offset,
            'limit' => $limit,
        ];

        $result = (new AbastecimientoModel())->listPaginated($filters);
        Response::success($result, 'Abastecimientos obtenidos correctamente.');
    }

    public function show(Request $request): void
    {
        $id = (int) ($request->params['id'] ?? 0);
        if ($id <= 0) {
            Response::error('ID de abastecimiento invalido.', ['id' => 'Formato invalido'], 422);
        }

        $item = (new AbastecimientoModel())->findDetailById($id);
        if (!$item) {
            Response::error('Abastecimiento no encontrado.', [], 404);
        }

        Response::success($item, 'Detalle de abastecimiento obtenido correctamente.');
    }

    public function store(Request $request): void
    {
        /**
         * Campos requeridos (debe enviar desde la app):
         * - idLocal: string, identificador local
         * - cantidad: float
         * - producto: int o array con id, nombre, código
         * - recibidoPor: string, nombre receptor
         * - zonaNombreSnapshot: string, nombre de zona al momento de registro
         * - latitud: float, coordenada GPS
         * - longitud: float, coordenada GPS
         * - precisionGps: float, precisión en metros
         * - fechaGps: string, fecha/datetime de captura GPS
         * - importe: float, monto de la transacción
         * 
         * Campos opcionales (si no se envían, usan defaults):
         * - metodoZona: 'AUTO' (asignada automáticamente) | 'MANUAL' (usuario eligió) | 'UNRESOLVED' (sin asignar). Default: 'UNRESOLVED'
         * - estadoSincronizacion: 'PENDING' | 'SYNCED' | 'ERROR'. Default: 'PENDING' (nuevo registro espera sincronización)
         * - estadoImpresion: 'PENDING' | 'PRINTED' | 'ERROR'. Default: 'PENDING' (nuevo registro espera impresión)
         * - zonaId: int, ID de la zona asignada (si aplica)
         * - conductor: string, nombre del conductor/vendedor
         * - horaInicio: string, hora de inicio (HH:MM:SS o datetime)
         * - horaFin: string, hora de fin (HH:MM:SS o datetime)
         * - creadoOffline: boolean, si se creó sin conexión a internet
         */
        $required = [
            'idLocal',
            'cantidad',
            'producto',
            'recibidoPor',
            'zonaNombreSnapshot',
            'latitud',
            'longitud',
            'precisionGps',
            'fechaGps',
            'importe',
        ];

        $errors = Validator::required($request->body, $required);
        if ($errors) {
            Response::error('Datos incompletos para registrar abastecimiento.', $errors, 422);
        }

        $user = (array) $request->user;
        $payload = $request->body;

        try {
            $id = (new AbastecimientoModel())->create($payload, $user);
            Response::success(['id' => $id], 'Abastecimiento registrado correctamente.', 201);
        } catch (Throwable $e) {
            LoggerService::error('Error al registrar abastecimiento', ['error' => $e->getMessage(), 'code' => $e->getCode()]);
            $error = $this->mapExceptionToError($e);
            Response::error($error['message'], $error['data'], $error['status']);
        }
    }

    public function sync(Request $request): void
    {
        $items = $request->input('items', $request->body);
        if (!is_array($items) || empty($items)) {
            Response::error('No se recibieron abastecimientos para sincronizar.', [], 422);
        }

        $required = [
            'idLocal',
            'cantidad',
            'producto',
            'recibidoPor',
            'zonaNombreSnapshot',
            'latitud',
            'longitud',
            'precisionGps',
            'fechaGps',
            'importe',
        ];
        foreach ($items as $index => $item) {
            if (!is_array($item)) {
                Response::error('Cada item de sincronización debe ser un objeto JSON.', ['index' => $index], 422);
            }
            $errors = Validator::required($item, $required);
            if ($errors) {
                Response::error('Datos incompletos en item de sincronización.', ['index' => $index, 'errors' => $errors], 422);
            }
        }

        $user = (array) $request->user;

        try {
            $created = (new AbastecimientoModel())->createMany($items, $user);
            Response::success($created, 'Abastecimientos sincronizados correctamente.');
        } catch (Throwable $e) {
            LoggerService::error('Error en sincronización de abastecimientos', ['error' => $e->getMessage(), 'code' => $e->getCode()]);
            $error = $this->mapExceptionToError($e);
            Response::error($error['message'], $error['data'], $error['status']);
        }
    }

    private function isValidDate(string $date): bool
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return false;
        }
        $dt = \DateTime::createFromFormat('Y-m-d', $date);
        return $dt !== false && $dt->format('Y-m-d') === $date;
    }

    private function mapExceptionToError(Throwable $e): array
    {
        // Errores de validación lanzados por el modelo (campos faltantes/formato inválido)
        if ($e instanceof \InvalidArgumentException) {
            return [
                'message' => $e->getMessage(),
                'data' => [],
                'status' => 422,
            ];
        }

        if ($e instanceof PDOException) {
            $errorInfo = $e->errorInfo ?? [];
            $driverCode = (int) ($errorInfo[1] ?? 0);
            $driverMessage = (string) ($errorInfo[2] ?? $e->getMessage());

            if ($driverCode === 1062 && str_contains($driverMessage, 'abastecimientos.local_id')) {
                return [
                    'message' => 'El idLocal ya fue registrado anteriormente.',
                    'data' => ['idLocal' => 'El campo idLocal ya existe. Debe ser unico.'],
                    'status' => 409,
                ];
            }

            if ($driverCode === 1452 && str_contains($driverMessage, 'product_id')) {
                return [
                    'message' => 'El producto enviado no existe en catalogo.',
                    'data' => ['producto' => 'Debe enviar un ID de producto valido.'],
                    'status' => 422,
                ];
            }

            if ($driverCode === 1452 && str_contains($driverMessage, 'zone_id')) {
                return [
                    'message' => 'La zona enviada no existe en catalogo.',
                    'data' => ['zonaId' => 'Debe enviar un ID de zona valido.'],
                    'status' => 422,
                ];
            }

            if ($driverCode === 1048 && str_contains($driverMessage, 'product_id')) {
                return [
                    'message' => 'Falta el ID de producto o es invalido.',
                    'data' => ['producto' => 'Debe enviar un ID de producto (entero positivo).'],
                    'status' => 422,
                ];
            }
        }

        return [
            'message' => 'No se pudo registrar el abastecimiento por un error interno.',
            'data' => [],
            'status' => 500,
        ];
    }
}
