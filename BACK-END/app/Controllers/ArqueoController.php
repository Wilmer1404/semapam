<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Models\AbastecimientoModel;

final class ArqueoController
{
    public function daily(Request $request): void
    {
        $fecha = (string) ($request->query['date'] ?? $request->query['fecha'] ?? date('Y-m-d'));
        if (!$this->isValidDate($fecha)) {
            Response::error('El parametro date debe tener formato YYYY-MM-DD.', ['date' => 'Formato invalido'], 422);
        }

        $startDate = isset($request->query['start']) ? (string) $request->query['start'] : null;
        $endDate = isset($request->query['end']) ? (string) $request->query['end'] : null;

        if (($startDate !== null && $endDate === null) || ($startDate === null && $endDate !== null)) {
            Response::error('Para filtrar por rango debe enviar start y end juntos (YYYY-MM-DD).', ['start_end' => 'Formato invalido'], 422);
        }
        if ($startDate !== null && !$this->isValidDate($startDate)) {
            Response::error('El parametro start debe tener formato YYYY-MM-DD.', ['start' => 'Formato invalido'], 422);
        }
        if ($endDate !== null && !$this->isValidDate($endDate)) {
            Response::error('El parametro end debe tener formato YYYY-MM-DD.', ['end' => 'Formato invalido'], 422);
        }
        if ($startDate !== null && $endDate !== null && $startDate > $endDate) {
            Response::error('El parametro start no puede ser mayor que end.', ['start_end' => 'Rango invalido'], 422);
        }

        $authUser = $request->user ?? [];
        $authUserId = (int) ($authUser['id'] ?? 0);
        $authRole = strtoupper((string) ($authUser['role'] ?? ''));

        if ($authUserId <= 0) {
            Response::error('Token inválido: no se encontró id de usuario.', [], 401);
        }

        if ($authRole === 'ADMIN') {
            $userId = isset($request->query['user_id']) ? (int) $request->query['user_id'] : null;
            if ($userId !== null && $userId <= 0) {
                Response::error('El parametro user_id debe ser un entero positivo.', ['user_id' => 'Formato invalido'], 422);
            }
        } else {
            // Operador y cualquier otro rol no admin ven únicamente su propia venta.
            $userId = $authUserId;
        }

        $model = new AbastecimientoModel();
        $itemsDetailRaw = $model->dailyArqueoDetail($fecha, $userId, $startDate, $endDate);
        $itemsDetail = array_map(static function (array $row): array {
            $quantity = (float) ($row['quantity'] ?? 0);
            $amount = (float) ($row['amount'] ?? 0);

            return [
                'id' => (int) ($row['id'] ?? 0),
                'abastecimiento_id' => (int) ($row['abastecimiento_id'] ?? 0),
                'abastecimiento_codigo' => (string) ($row['abastecimiento_codigo'] ?? ''),
                'abastecimiento_code' => (string) ($row['abastecimiento_code'] ?? ''),
                'idLocal' => (string) ($row['idLocal'] ?? ''),
                'ticket_number' => (string) ($row['ticket_number'] ?? ''),
                'ticket_code' => (string) ($row['ticket_code'] ?? ''),
                'fecha_emision' => (string) ($row['fecha_emision'] ?? ''),
                'created_at' => (string) ($row['created_at'] ?? ''),
                'date' => (string) ($row['date'] ?? ''),
                'receiver_name' => (string) ($row['receiver_name'] ?? ''),
                'received_by' => (string) ($row['received_by'] ?? ''),
                'customer' => (string) ($row['customer'] ?? ''),
                'producto' => (string) ($row['producto'] ?? ''),
                'productName' => (string) ($row['productName'] ?? ''),
                'quantity' => $quantity,
                'liters' => $quantity,
                'cubos' => $quantity,
                'amount' => $amount,
                'total' => $amount,
                'zone_name_snapshot' => (string) ($row['zone_name_snapshot'] ?? ''),
                'zone_name' => (string) ($row['zone_name'] ?? ''),
                'zone' => (string) ($row['zone'] ?? ''),
                'status' => (string) ($row['status'] ?? ''),
            ];
        }, $itemsDetailRaw);

        $groupedAccumulator = [];
        $totalMonto = 0.0;
        foreach ($itemsDetail as $detail) {
            $product = (string) $detail['producto'];
            if (!isset($groupedAccumulator[$product])) {
                $groupedAccumulator[$product] = [
                    'producto' => $product,
                    'productName' => $product,
                    'total_tickets' => 0,
                    'tickets' => 0,
                    'total_cubos' => 0.0,
                    'quantity' => 0.0,
                    'cubos' => 0.0,
                    'total_amount' => 0.0,
                    'total' => 0.0,
                    'amount' => 0.0,
                ];
            }

            $amount = (float) $detail['amount'];
            $quantity = (float) $detail['quantity'];

            $groupedAccumulator[$product]['total_tickets']++;
            $groupedAccumulator[$product]['tickets']++;
            $groupedAccumulator[$product]['total_cubos'] += $quantity;
            $groupedAccumulator[$product]['quantity'] += $quantity;
            $groupedAccumulator[$product]['cubos'] += $quantity;
            $groupedAccumulator[$product]['total_amount'] += $amount;
            $groupedAccumulator[$product]['total'] += $amount;
            $groupedAccumulator[$product]['amount'] += $amount;

            $totalMonto += $amount;
        }

        $itemsGrouped = array_values($groupedAccumulator);
        $totalRegistros = count($itemsDetail);
        $fechaReferencia = $startDate ?? $fecha;

        Response::success([
            'fecha' => $fechaReferencia,
            'date' => $fechaReferencia,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'range_applied' => $startDate !== null && $endDate !== null,
            'total_registros' => $totalRegistros,
            'totalTickets' => $totalRegistros,
            'total_monto' => $totalMonto,
            'totalAmount' => $totalMonto,
            // Compatibilidad transición: mantenemos items agrupado y añadimos bloques explícitos.
            'items' => $itemsGrouped,
            'items_grouped' => $itemsGrouped,
            'items_detail' => $itemsDetail,
        ], 'Arqueo obtenido correctamente.');
    }

    private function isValidDate(string $date): bool
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return false;
        }
        $dt = \DateTime::createFromFormat('Y-m-d', $date);
        return $dt !== false && $dt->format('Y-m-d') === $date;
    }
}
