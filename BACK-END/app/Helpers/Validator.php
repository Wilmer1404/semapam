<?php

declare(strict_types=1);

namespace App\Helpers;

final class Validator
{
    public static function required(array $data, array $fields): array
    {
        $errors = [];
        foreach ($fields as $field) {
            if (!array_key_exists($field, $data) || $data[$field] === null || $data[$field] === '') {
                $errors[$field] = "El campo {$field} es obligatorio.";
            }
        }
        return $errors;
    }
}
