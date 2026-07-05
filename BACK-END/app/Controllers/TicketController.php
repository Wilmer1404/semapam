<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Models\AbastecimientoModel;

final class TicketController
{
    private const VALID_STATUS = ['PENDING', 'SYNCED', 'ERROR'];

    public function index(Request $request): void
    {
        $date = $request->query['date'] ?? null;
        if ($date !== null && !$this->isValidDate((string) $date)) {
            Response::error('El parametro date debe tener formato YYYY-MM-DD.', ['date' => 'Formato invalido'], 422);
        }

        $from = $request->query['from'] ?? $request->query['fecha_desde'] ?? null;
        $to = $request->query['to'] ?? $request->query['fecha_hasta'] ?? null;
        if ($from !== null && !$this->isValidDate((string) $from)) {
            Response::error('El parametro from debe tener formato YYYY-MM-DD.', ['from' => 'Formato invalido'], 422);
        }
        if ($to !== null && !$this->isValidDate((string) $to)) {
            Response::error('El parametro to debe tener formato YYYY-MM-DD.', ['to' => 'Formato invalido'], 422);
        }

        $offset = isset($request->query['offset']) ? (int) $request->query['offset'] : 0;
        $limit = isset($request->query['limit']) ? (int) $request->query['limit'] : 20;
        if ($offset < 0) {
            Response::error('El parametro offset debe ser mayor o igual a 0.', ['offset' => 'Formato invalido'], 422);
        }
        if ($limit <= 0 || $limit > 200) {
            Response::error('El parametro limit debe estar entre 1 y 200.', ['limit' => 'Formato invalido'], 422);
        }

        $status = isset($request->query['status']) ? strtoupper((string) $request->query['status']) : null;
        if ($status !== null && $status !== '' && !in_array($status, self::VALID_STATUS, true)) {
            Response::error('status invalido. Valores permitidos: PENDING, SYNCED, ERROR.', ['status' => 'Formato invalido'], 422);
        }

        $filters = [
            'search' => $request->query['search'] ?? $request->query['ticket'] ?? null,
            'status' => $status,
            'date' => $date,
            'from' => $from,
            'to' => $to,
            'offset' => $offset,
            'limit' => $limit,
        ];

        $tickets = (new AbastecimientoModel())->tickets($filters);
        Response::success($tickets, 'Tickets obtenidos correctamente.');
    }

    private function isValidDate(string $date): bool
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return false;
        }
        $dt = \DateTime::createFromFormat('Y-m-d', $date);
        return $dt !== false && $dt->format('Y-m-d') === $date;
    }

    public function show(Request $request): void
    {
        $ticket = (new AbastecimientoModel())->ticketById((int) $request->params['id']);
        if (!$ticket) {
            Response::error('Ticket no encontrado.', [], 404);
        }
        Response::success($ticket, 'Detalle de ticket obtenido correctamente.');
    }

    public function reprint(Request $request): void
    {
        $model = new AbastecimientoModel();
        $ticket = $model->ticketById((int) $request->params['id']);
        if (!$ticket) {
            Response::error('Ticket no encontrado.', [], 404);
        }

        $model->incrementReprint((int) $request->params['id']);
        Response::success(['ticket_id' => (int) $request->params['id']], 'Reimpresión registrada correctamente.');
    }
}
