<?php

declare(strict_types=1);

namespace App\Models;

final class ZoneModel extends BaseModel
{
    private const COLS = 'id, code, name, district, province, department, geojson, is_published, is_active, created_at, updated_at';

    public function allPublished(): array
    {
        $stmt = $this->db->query('SELECT id, code, name, district, province, department, geojson, is_published FROM zones WHERE is_published = 1 AND is_active = 1 ORDER BY name');
        $rows = $stmt->fetchAll();

        return array_map(static function (array $row): array {
            $geojson = json_decode((string) $row['geojson'], true) ?: [];
            return [
                'id'         => (int) $row['id'],
                'code'       => $row['code'],
                'nombre'     => $row['name'],
                'district'   => $row['district'],
                'province'   => $row['province'],
                'department' => $row['department'],
                'polygon'    => [
                    'type'        => 'Polygon',
                    'coordinates' => $geojson['coordinates'] ?? [],
                ],
                'estado'     => (bool) $row['is_published'],
            ];
        }, $rows);
    }

    public function all(): array
    {
        $stmt = $this->db->query('SELECT ' . self::COLS . ' FROM zones ORDER BY name');
        $rows = $stmt->fetchAll();
        return array_map([$this, 'decodeGeojson'], $rows);
    }

    public function findById(int $id): array|false
    {
        $stmt = $this->db->prepare('SELECT ' . self::COLS . ' FROM zones WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return $row ? $this->decodeGeojson($row) : false;
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO zones (code, name, district, province, department, geojson, is_published, is_active)
             VALUES (:code, :name, :district, :province, :department, :geojson, :is_published, :is_active)'
        );
        $stmt->execute([
            'code'         => strtoupper(trim((string) $data['code'])),
            'name'         => trim((string) $data['name']),
            'district'     => $data['district'] ?? null,
            'province'     => $data['province'] ?? null,
            'department'   => $data['department'] ?? null,
            'geojson'      => is_array($data['geojson'] ?? null) ? json_encode($data['geojson']) : ($data['geojson'] ?? '{}'),
            'is_published' => isset($data['is_published']) ? (int) $data['is_published'] : 1,
            'is_active'    => isset($data['is_active']) ? (int) $data['is_active'] : 1,
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function update(int $id, array $data): void
    {
        $fields = [];
        $params = ['id' => $id];

        if (isset($data['code']))       { $fields[] = 'code = :code';             $params['code']       = strtoupper(trim((string) $data['code'])); }
        if (isset($data['name']))       { $fields[] = 'name = :name';             $params['name']       = trim((string) $data['name']); }
        if (array_key_exists('district',   $data)) { $fields[] = 'district = :district';   $params['district']   = $data['district']; }
        if (array_key_exists('province',   $data)) { $fields[] = 'province = :province';   $params['province']   = $data['province']; }
        if (array_key_exists('department', $data)) { $fields[] = 'department = :department'; $params['department'] = $data['department']; }
        if (isset($data['geojson'])) {
            $fields[] = 'geojson = :geojson';
            $params['geojson'] = is_array($data['geojson']) ? json_encode($data['geojson']) : $data['geojson'];
        }
        if (isset($data['is_published'])) { $fields[] = 'is_published = :is_published'; $params['is_published'] = (int) $data['is_published']; }
        if (isset($data['is_active']))    { $fields[] = 'is_active = :is_active';       $params['is_active']    = (int) $data['is_active']; }

        if (empty($fields)) {
            return;
        }

        $this->db->prepare('UPDATE zones SET ' . implode(', ', $fields) . ' WHERE id = :id')->execute($params);
    }

    public function delete(int $id): void
    {
        $this->db->prepare('UPDATE zones SET is_active = 0, is_published = 0 WHERE id = :id')->execute(['id' => $id]);
    }

    private function decodeGeojson(array $row): array
    {
        $row['geojson'] = json_decode((string) $row['geojson'], true) ?: (object) [];
        return $row;
    }
}
