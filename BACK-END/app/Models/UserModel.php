<?php

declare(strict_types=1);

namespace App\Models;

final class UserModel extends BaseModel
{
    private const COLS = 'id, username, full_name, role, dni, phone, status, correlativo, last_login_at, created_at, updated_at';

    public function findByUsername(string $username): array|false
    {
        $stmt = $this->db->prepare('SELECT id, username, password_hash, full_name, role, status, correlativo FROM users WHERE username = :username LIMIT 1');
        $stmt->execute(['username' => $username]);
        return $stmt->fetch();
    }

    public function all(): array
    {
        $stmt = $this->db->query('SELECT ' . self::COLS . ' FROM users ORDER BY full_name');
        return $stmt->fetchAll();
    }

    public function findById(int $id): array|false
    {
        $stmt = $this->db->prepare('SELECT ' . self::COLS . ' FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public function findSessionById(int $id): array|false
    {
        $stmt = $this->db->prepare('SELECT id, username, full_name, role, correlativo FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch();
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare(
            'INSERT INTO users (username, password_hash, full_name, role, dni, phone, status)
             VALUES (:username, :password_hash, :full_name, :role, :dni, :phone, :status)'
        );
        $stmt->execute([
            'username'      => trim((string) $data['username']),
            'password_hash' => password_hash((string) $data['password'], PASSWORD_BCRYPT),
            'full_name'     => trim((string) $data['full_name']),
            'role'          => $data['role'] ?? 'OPERADOR',
            'dni'           => $data['dni'] ?? null,
            'phone'         => $data['phone'] ?? null,
            'status'        => $data['status'] ?? 'ACTIVE',
        ]);
        return (int) $this->db->lastInsertId();
    }

    public function update(int $id, array $data): void
    {
        $fields = [];
        $params = ['id' => $id];

        if (isset($data['username']))  { $fields[] = 'username = :username';             $params['username']      = trim((string) $data['username']); }
        if (isset($data['full_name'])) { $fields[] = 'full_name = :full_name';           $params['full_name']     = trim((string) $data['full_name']); }
        if (isset($data['password']))  { $fields[] = 'password_hash = :password_hash';   $params['password_hash'] = password_hash((string) $data['password'], PASSWORD_BCRYPT); }
        if (isset($data['role']))      { $fields[] = 'role = :role';                     $params['role']          = $data['role']; }
        if (array_key_exists('dni',   $data)) { $fields[] = 'dni = :dni';     $params['dni']   = $data['dni']; }
        if (array_key_exists('phone', $data)) { $fields[] = 'phone = :phone'; $params['phone'] = $data['phone']; }
        if (isset($data['status']))    { $fields[] = 'status = :status';                 $params['status']        = $data['status']; }

        if (empty($fields)) {
            return;
        }

        $this->db->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = :id')->execute($params);
    }

    public function delete(int $id): void
    {
        $this->db->prepare("UPDATE users SET status = 'INACTIVE' WHERE id = :id")->execute(['id' => $id]);
    }

    public function incrementCorrelativo(int $id): int
    {
        $this->db->prepare('UPDATE users SET correlativo = COALESCE(correlativo, 1) + 1 WHERE id = :id')
            ->execute(['id' => $id]);

        $stmt = $this->db->prepare('SELECT correlativo FROM users WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $id]);
        return (int) (($stmt->fetch()['correlativo'] ?? 1));
    }
}
