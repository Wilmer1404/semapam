<?php

declare(strict_types=1);

namespace App\Models;

final class ProductModel extends BaseModel
{
    private const COLS = 'id, code, name, unit_measure, unit_price, base_amount, is_active, created_at, updated_at';

    public function allActive(): array
    {
        $stmt = $this->db->query('SELECT id, code, name, unit_measure, unit_price, base_amount, is_active FROM products WHERE is_active = 1 ORDER BY name');
        return $stmt->fetchAll();
    }

    public function all(): array
    {
        $stmt = $this->db->query('SELECT ' . self::COLS . ' FROM products ORDER BY name');
        return $stmt->fetchAll();
    }

    public function findById(int $id): array|false
    {
        $stmt = $this->db->prepare('SELECT ' . self::COLS . ' FROM products WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO products (code, name, unit_measure, unit_price, base_amount, is_active)
             VALUES (:code, :name, :unit_measure, :unit_price, :base_amount, :is_active)'
        );
        $stmt->execute([
            'code'         => strtoupper(trim((string) $data['code'])),
            'name'         => trim((string) $data['name']),
            'unit_measure' => strtoupper(trim((string) ($data['unit_measure'] ?? 'GAL'))),
            'unit_price'   => (float) ($data['unit_price'] ?? 0),
            'base_amount'  => isset($data['base_amount']) ? (float) $data['base_amount'] : null,
            'is_active'    => isset($data['is_active']) ? (int) $data['is_active'] : 1,
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function update(int $id, array $data): void
    {
        $fields = [];
        $params = ['id' => $id];

        if (isset($data['code']))         { $fields[] = 'code = :code';                 $params['code']         = strtoupper(trim((string) $data['code'])); }
        if (isset($data['name']))         { $fields[] = 'name = :name';                 $params['name']         = trim((string) $data['name']); }
        if (isset($data['unit_measure'])) { $fields[] = 'unit_measure = :unit_measure'; $params['unit_measure'] = strtoupper(trim((string) $data['unit_measure'])); }
        if (isset($data['unit_price']))   { $fields[] = 'unit_price = :unit_price';     $params['unit_price']   = (float) $data['unit_price']; }
        if (array_key_exists('base_amount', $data)) {
            $fields[] = 'base_amount = :base_amount';
            $params['base_amount'] = $data['base_amount'] !== null ? (float) $data['base_amount'] : null;
        }
        if (isset($data['is_active'])) { $fields[] = 'is_active = :is_active'; $params['is_active'] = (int) $data['is_active']; }

        if (empty($fields)) {
            return;
        }

        $this->db->prepare('UPDATE products SET ' . implode(', ', $fields) . ' WHERE id = :id')->execute($params);
    }

    public function delete(int $id): void
    {
        $this->db->prepare('UPDATE products SET is_active = 0 WHERE id = :id')->execute(['id' => $id]);
    }
}
