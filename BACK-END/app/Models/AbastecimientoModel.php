<?php

declare(strict_types=1);

namespace App\Models;

use PDO;

final class AbastecimientoModel extends BaseModel
{
    public function create(array $payload, array $user): int
    {
        $sql = 'INSERT INTO abastecimientos (
                    local_id, quantity, product_id, driver_name, receiver_name, zone_id,
                    zone_name_snapshot, latitude, longitude, gps_accuracy, gps_captured_at,
                    started_at, finished_at, amount, zone_assignment_method, sync_status, print_status,
                    created_offline, user_id, created_at
                ) VALUES (
                    :local_id, :quantity, :product_id, :driver_name, :receiver_name, :zone_id,
                    :zone_name_snapshot, :latitude, :longitude, :gps_accuracy, :gps_captured_at,
                    :started_at, :finished_at, :amount, :zone_assignment_method, :sync_status, :print_status,
                    :created_offline, :user_id, :created_at
                )';

        $p = $this->normalizePayload($payload);
        $createdAt = date('Y-m-d H:i:s');
        $driverName = trim((string) ($p['driver_name'] ?? ''));
        if ($driverName === '') {
            $driverName = trim((string) ($user['full_name'] ?? $user['username'] ?? ''));
        }
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'local_id'              => $p['local_id'],
            'quantity'              => $p['quantity'],
            'product_id'            => $p['product_id'],
            'driver_name'           => $driverName,
            'receiver_name'         => $p['receiver_name'],
            'zone_id'               => $p['zone_id'],
            'zone_name_snapshot'    => $p['zone_name_snapshot'],
            'latitude'              => $p['latitude'],
            'longitude'             => $p['longitude'],
            'gps_accuracy'          => $p['gps_accuracy'],
            'gps_captured_at'       => $p['gps_captured_at'],
            'started_at'            => $p['started_at'],
            'finished_at'           => $p['finished_at'],
            'amount'                => $p['amount'],
            'zone_assignment_method' => $p['zone_assignment_method'],
            'sync_status'           => $p['sync_status'],
            'print_status'          => $p['print_status'],
            'created_offline'       => $p['created_offline'],
            'user_id'               => $user['id'],
            'created_at'            => $createdAt,
        ]);

        $abastecimientoId = (int) $this->db->lastInsertId();
        $this->createTicket($abastecimientoId, $payload, $createdAt);
        (new UserModel())->incrementCorrelativo((int) $user['id']);
        return $abastecimientoId;
    }

    public function createMany(array $items, array $user): array
    {
        $this->db->beginTransaction();
        try {
            $created = [];
            foreach ($items as $item) {
                $created[] = ['id_local' => $item['idLocal'] ?? null, 'id_remoto' => $this->create($item, $user)];
            }
            $this->db->commit();
            return $created;
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function listPaginated(array $filters = []): array
    {
        $offset = max(0, (int) ($filters['offset'] ?? 0));
        $limit = (int) ($filters['limit'] ?? 20);
        if ($limit <= 0) {
            $limit = 20;
        }
        if ($limit > 200) {
            $limit = 200;
        }

        $sqlBase = ' FROM abastecimientos a
                    INNER JOIN products p ON p.id = a.product_id
                    LEFT JOIN tickets t ON t.abastecimiento_id = a.id
                    LEFT JOIN zones z ON z.id = a.zone_id
                    LEFT JOIN users u ON u.id = a.user_id
                    WHERE 1 = 1';

        $params = [];

        if (!empty($filters['date'])) {
            $sqlBase .= ' AND DATE(a.created_at) = :date';
            $params['date'] = (string) $filters['date'];
        } elseif (!empty($filters['from']) && !empty($filters['to'])) {
            $sqlBase .= ' AND DATE(a.created_at) BETWEEN :from_date AND :to_date';
            $params['from_date'] = (string) $filters['from'];
            $params['to_date'] = (string) $filters['to'];
        }
        if (!empty($filters['local_id'])) {
            $sqlBase .= ' AND a.local_id LIKE :local_id';
            $params['local_id'] = '%' . (string) $filters['local_id'] . '%';
        }
        if (!empty($filters['ticket'])) {
            $sqlBase .= ' AND (t.ticket_number LIKE :ticket OR a.external_ticket_number LIKE :ticket)';
            $params['ticket'] = '%' . (string) $filters['ticket'] . '%';
        }
        if (!empty($filters['receiver'])) {
            $sqlBase .= ' AND a.receiver_name LIKE :receiver';
            $params['receiver'] = '%' . (string) $filters['receiver'] . '%';
        }
        if (!empty($filters['driver'])) {
            $sqlBase .= ' AND a.driver_name LIKE :driver';
            $params['driver'] = '%' . (string) $filters['driver'] . '%';
        }
        if (!empty($filters['product'])) {
            $sqlBase .= ' AND (p.name LIKE :product OR p.code LIKE :product)';
            $params['product'] = '%' . (string) $filters['product'] . '%';
        }
        if (!empty($filters['zone_method'])) {
            $sqlBase .= ' AND a.zone_assignment_method = :zone_method';
            $params['zone_method'] = (string) $filters['zone_method'];
        }
        if (!empty($filters['sync_status'])) {
            $sqlBase .= ' AND a.sync_status = :sync_status';
            $params['sync_status'] = (string) $filters['sync_status'];
        }
        if (!empty($filters['print_status'])) {
            $sqlBase .= ' AND COALESCE(t.print_status, a.print_status) = :print_status';
            $params['print_status'] = (string) $filters['print_status'];
        }

        $countStmt = $this->db->prepare('SELECT COUNT(*) AS total' . $sqlBase);
        $countStmt->execute($params);
        $total = (int) ($countStmt->fetch()['total'] ?? 0);

        $sql = 'SELECT
                    a.id,
                    a.local_id,
                    a.external_ticket_number,
                    t.ticket_number,
                    p.id AS product_id,
                    p.code AS product_code,
                    p.name AS product_name,
                    a.quantity,
                    a.unit_measure,
                    a.amount,
                    a.receiver_name,
                    a.receiver_dni,
                    a.driver_name,
                    a.zone_id,
                    COALESCE(z.name, a.zone_name_snapshot) AS zone_name,
                    a.zone_name_snapshot,
                    a.zone_assignment_method,
                    a.sync_status,
                    COALESCE(t.print_status, a.print_status) AS print_status,
                    a.sync_attempts,
                    a.created_offline,
                    a.started_at,
                    a.finished_at,
                    a.gps_captured_at,
                    a.created_at,
                    a.updated_at,
                    u.id AS user_id,
                    u.username,
                    u.full_name
                ' . $sqlBase . '
                ORDER BY a.created_at DESC, a.id DESC
                LIMIT ' . $limit . ' OFFSET ' . $offset;

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return [
            'items' => $stmt->fetchAll(),
            'pagination' => [
                'offset' => $offset,
                'limit' => $limit,
                'total' => $total,
                'has_more' => ($offset + $limit) < $total,
            ],
        ];
    }

    public function findDetailById(int $id): array|false
    {
        $stmt = $this->db->prepare('SELECT
                                        a.id,
                                        a.local_id,
                                        a.external_ticket_number,
                                        t.ticket_number,
                                        p.id AS product_id,
                                        p.code AS product_code,
                                        p.name AS product_name,
                                        a.quantity,
                                        a.unit_measure,
                                        a.amount,
                                        a.receiver_name,
                                        a.receiver_dni,
                                        a.driver_name,
                                        a.zone_id,
                                        z.code AS zone_code,
                                        z.name AS zone_name,
                                        a.zone_name_snapshot,
                                        a.zone_assignment_method,
                                        a.latitude,
                                        a.longitude,
                                        a.gps_accuracy,
                                        a.gps_captured_at,
                                        a.sync_status,
                                        a.sync_attempts,
                                        a.last_sync_at,
                                        a.sync_error_message,
                                        COALESCE(t.print_status, a.print_status) AS print_status,
                                        a.printed_at,
                                        a.reprint_count,
                                        a.created_offline,
                                        a.notes,
                                        a.started_at,
                                        a.finished_at,
                                        a.created_at,
                                        a.updated_at,
                                        u.id AS user_id,
                                        u.username,
                                        u.full_name
                                    FROM abastecimientos a
                                    INNER JOIN products p ON p.id = a.product_id
                                    LEFT JOIN tickets t ON t.abastecimiento_id = a.id
                                    LEFT JOIN zones z ON z.id = a.zone_id
                                    LEFT JOIN users u ON u.id = a.user_id
                                    WHERE a.id = :id
                                    LIMIT 1');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public function tickets(array $filters = []): array
    {
        $offset = max(0, (int) ($filters['offset'] ?? 0));
        $limit = (int) ($filters['limit'] ?? 20);
        if ($limit <= 0) {
            $limit = 20;
        }
        if ($limit > 200) {
            $limit = 200;
        }

        $sqlBase = ' FROM tickets t
                INNER JOIN abastecimientos a ON a.id = t.abastecimiento_id
                INNER JOIN products p ON p.id = a.product_id
                LEFT JOIN users u ON u.id = a.user_id
                WHERE 1 = 1';

        $params = [];
        $queryDate = $filters['date'] ?? null;

        // Compatibilidad: si no hay filtro de fechas, devuelve tickets del dia actual segun la app (APP_TIMEZONE).
        if (!empty($queryDate)) {
            $sqlBase .= ' AND DATE(t.created_at) = :query_date';
            $params['query_date'] = (string) $queryDate;
        } elseif (empty($filters['from']) && empty($filters['to'])) {
            $sqlBase .= ' AND DATE(t.created_at) = :today';
            $params['today'] = date('Y-m-d');
        }

        if (!empty($filters['from'])) {
            $sqlBase .= ' AND DATE(t.created_at) >= :from_date';
            $params['from_date'] = (string) $filters['from'];
        }
        if (!empty($filters['to'])) {
            $sqlBase .= ' AND DATE(t.created_at) <= :to_date';
            $params['to_date'] = (string) $filters['to'];
        }

        if (!empty($filters['search'])) {
            $sqlBase .= ' AND (a.local_id LIKE :search OR u.username LIKE :search OR u.full_name LIKE :search)';
            $params['search'] = '%' . (string) $filters['search'] . '%';
        }
        if (!empty($filters['status'])) {
            $sqlBase .= ' AND a.sync_status = :status';
            $params['status'] = (string) $filters['status'];
        }

        $countStmt = $this->db->prepare('SELECT COUNT(*) AS total' . $sqlBase);
        $countStmt->execute($params);
        $total = (int) ($countStmt->fetch()['total'] ?? 0);

        $sql = 'SELECT
                       t.id,
                       a.id AS abastecimiento_id,
                       a.local_id AS abastecimiento_codigo,
                       a.local_id AS abastecimiento_code,
                       a.local_id AS idLocal,
                       t.ticket_number,
                       t.ticket_number AS ticket_code,
                       t.created_at AS fecha_emision,
                       t.created_at,
                       DATE(t.created_at) AS date,
                       t.reprint_count,
                       a.quantity,
                       a.quantity AS liters,
                       a.amount,
                       a.amount AS total,
                       a.receiver_name,
                       a.receiver_name AS received_by,
                       a.receiver_name AS customer,
                       a.driver_name,
                       a.zone_name_snapshot,
                       a.zone_name_snapshot AS zone_name,
                       a.zone_name_snapshot AS zone,
                       u.id AS user_id,
                       u.username,
                       u.full_name,
                       COALESCE(u.full_name, u.username) AS operador,
                       p.name AS producto,
                       a.sync_status AS status
                ' . $sqlBase . '
                ORDER BY t.created_at DESC, t.id DESC
                LIMIT ' . $limit . ' OFFSET ' . $offset;
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return [
            'items' => $stmt->fetchAll(),
            'pagination' => [
                'offset' => $offset,
                'limit' => $limit,
                'total' => $total,
                'has_more' => ($offset + $limit) < $total,
            ],
        ];
    }

    public function ticketById(int $ticketId): array|false
    {
        $stmt = $this->db->prepare('SELECT t.*, a.id AS abastecimiento_id, a.local_id AS abastecimiento_codigo, a.local_id AS abastecimiento_code,
                                           a.local_id AS idLocal, a.quantity, a.amount, a.receiver_name, a.driver_name, a.zone_name_snapshot,
                                           p.name AS producto
                                    FROM tickets t
                                    INNER JOIN abastecimientos a ON a.id = t.abastecimiento_id
                                    INNER JOIN products p ON p.id = a.product_id
                                    WHERE t.id = :id LIMIT 1');
        $stmt->execute(['id' => $ticketId]);
        return $stmt->fetch();
    }

    public function incrementReprint(int $ticketId): void
    {
        $stmt = $this->db->prepare('UPDATE tickets SET reprint_count = reprint_count + 1, printed_at = NOW() WHERE id = :id');
        $stmt->execute(['id' => $ticketId]);
    }

    public function dailyArqueo(string $date, ?int $userId = null): array
    {
        $sql = 'SELECT COUNT(*) AS total_registros, COALESCE(SUM(a.amount), 0) AS total_monto
                FROM abastecimientos a
                WHERE DATE(a.created_at) = :fecha';
        $params = ['fecha' => $date];

        if ($userId !== null) {
            $sql .= ' AND a.user_id = :user_id';
            $params['user_id'] = $userId;
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetch() ?: ['total_registros' => 0, 'total_monto' => 0];
    }

    public function dailyArqueoItems(string $date, ?int $userId = null): array
    {
        $sql = 'SELECT p.name AS producto,
                       COUNT(*) AS total_tickets,
                       COALESCE(SUM(a.quantity), 0) AS total_cubos,
                       COALESCE(SUM(a.amount), 0) AS total_amount
                FROM abastecimientos a
                INNER JOIN products p ON p.id = a.product_id
                WHERE DATE(a.created_at) = :fecha';

        $params = ['fecha' => $date];
        if ($userId !== null) {
            $sql .= ' AND a.user_id = :user_id';
            $params['user_id'] = $userId;
        }

        $sql .= ' GROUP BY p.id, p.name ORDER BY p.name ASC';

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function dailyArqueoDetail(string $date, ?int $userId = null, ?string $startDate = null, ?string $endDate = null): array
    {
        $sql = 'SELECT
                       t.id,
                       a.id AS abastecimiento_id,
                       a.local_id AS abastecimiento_codigo,
                       a.local_id AS abastecimiento_code,
                       a.local_id AS idLocal,
                       t.ticket_number,
                       t.ticket_number AS ticket_code,
                       t.created_at AS fecha_emision,
                       t.created_at,
                       DATE(t.created_at) AS date,
                       a.receiver_name,
                       a.receiver_name AS received_by,
                       a.receiver_name AS customer,
                       p.name AS producto,
                       p.name AS productName,
                       a.quantity,
                       a.quantity AS liters,
                       a.quantity AS cubos,
                       a.amount,
                       a.amount AS total,
                       a.zone_name_snapshot,
                       a.zone_name_snapshot AS zone_name,
                       a.zone_name_snapshot AS zone,
                       a.sync_status AS status
                FROM tickets t
                INNER JOIN abastecimientos a ON a.id = t.abastecimiento_id
                INNER JOIN products p ON p.id = a.product_id
                WHERE 1 = 1';

        $params = [];
        if ($startDate !== null && $endDate !== null) {
            $sql .= ' AND DATE(t.created_at) BETWEEN :start_date AND :end_date';
            $params['start_date'] = $startDate;
            $params['end_date'] = $endDate;
        } else {
            $sql .= ' AND DATE(t.created_at) = :fecha';
            $params['fecha'] = $date;
        }

        if ($userId !== null) {
            $sql .= ' AND a.user_id = :user_id';
            $params['user_id'] = $userId;
        }

        $sql .= ' ORDER BY t.created_at DESC, t.id DESC';

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    private function createTicket(int $abastecimientoId, array $payload, string $createdAt): void
    {
        $p = $this->normalizePayload($payload);
        $ticketDate = date('Ymd', strtotime($createdAt));
        $numeroTicket = 'TK-' . $ticketDate . '-' . str_pad((string) $abastecimientoId, 6, '0', STR_PAD_LEFT);
        $stmt = $this->db->prepare('INSERT INTO tickets (abastecimiento_id, ticket_number, print_status, created_at)
                                    VALUES (:abastecimiento_id, :ticket_number, :print_status, :created_at)');
        $stmt->execute([
            'abastecimiento_id' => $abastecimientoId,
            'ticket_number'     => $numeroTicket,
            'print_status'      => $p['print_status'],
            'created_at'        => $createdAt,
        ]);
    }

    private function normalizePayload(array $d): array
    {
        if (empty($d['producto'])) {
            throw new \InvalidArgumentException('Campo requerido: producto');
        }
        if (empty($d['idLocal'])) {
            throw new \InvalidArgumentException('Campo requerido: idLocal');
        }
        if (!isset($d['cantidad'])) {
            throw new \InvalidArgumentException('Campo requerido: cantidad');
        }
        if (empty($d['recibidoPor'])) {
            throw new \InvalidArgumentException('Campo requerido: recibidoPor');
        }
        if (empty($d['zonaNombreSnapshot'])) {
            throw new \InvalidArgumentException('Campo requerido: zonaNombreSnapshot');
        }
        if (!isset($d['latitud']) || !isset($d['longitud'])) {
            throw new \InvalidArgumentException('Campos requeridos: latitud y longitud');
        }
        if (!isset($d['precisionGps'])) {
            throw new \InvalidArgumentException('Campo requerido: precisionGps');
        }
        if (empty($d['fechaGps'])) {
            throw new \InvalidArgumentException('Campo requerido: fechaGps');
        }
        if (!isset($d['importe'])) {
            throw new \InvalidArgumentException('Campo requerido: importe');
        }

        $productId = is_array($d['producto']) ? (int) ($d['producto']['id'] ?? 0) : (int) $d['producto'];
        if ($productId <= 0) {
            throw new \InvalidArgumentException('El producto debe ser un ID valido (numero entero positivo)');
        }
        $baseDate = $d['fechaGps'] ?? null;

        // Normalizar datetime: convierte ISO 8601, fechas solas o datetimes de MySQL
        $toDatetime = static function (mixed $v): string {
            if (!$v) {
                return date('Y-m-d H:i:s');
            }
            $ts = is_numeric($v) ? (int) $v : strtotime((string) $v);
            return $ts !== false ? date('Y-m-d H:i:s', $ts) : date('Y-m-d H:i:s');
        };

        // Para horaInicio/horaFin que pueden llegar solo como "HH:MM:SS"
        $toFullDatetime = static function (mixed $v, mixed $base = null) use ($toDatetime): string {
            if (!$v) {
                return $toDatetime($base);
            }
            $str = (string) $v;
            // Si es solo hora (HH:MM o HH:MM:SS), prefijamos la fecha de hoy
            if (preg_match('/^\d{1,2}:\d{2}(:\d{2})?$/', $str)) {
                $baseTs = is_numeric($base) ? (int) $base : strtotime((string) $base);
                $baseDay = $baseTs !== false ? date('Y-m-d', $baseTs) : date('Y-m-d');
                $str = $baseDay . ' ' . $str;
            }
            return $toDatetime($str);
        };

        return [
            'local_id'              => (string) $d['idLocal'],
            'quantity'              => (float) $d['cantidad'],
            'product_id'            => $productId,
            'driver_name'           => (string) ($d['conductor'] ?? ''),
            'receiver_name'         => (string) $d['recibidoPor'],
            'zone_id'               => !empty($d['zonaId']) ? (int) $d['zonaId'] : null,
            'zone_name_snapshot'    => (string) $d['zonaNombreSnapshot'],
            'latitude'              => (float) $d['latitud'],
            'longitude'             => (float) $d['longitud'],
            'gps_accuracy'          => (float) $d['precisionGps'],
            'gps_captured_at'       => $toDatetime($d['fechaGps']),
            'started_at'            => $toFullDatetime($d['horaInicio'] ?? null, $baseDate),
            'finished_at'           => $toFullDatetime($d['horaFin'] ?? null, $baseDate),
            'amount'                => (float) $d['importe'],
            'zone_assignment_method' => (string) ($d['metodoZona'] ?? 'UNRESOLVED'),
            'sync_status'           => (string) ($d['estadoSincronizacion'] ?? 'PENDING'),
            'print_status'          => (string) ($d['estadoImpresion'] ?? 'PENDING'),
            'created_offline'       => !empty($d['creadoOffline']) ? 1 : 0,
        ];
    }
}
