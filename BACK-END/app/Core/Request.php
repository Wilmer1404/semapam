<?php

declare(strict_types=1);

namespace App\Core;

final class Request
{
    public string $method;
    public string $path;
    public array $query;
    public array $body;
    public array $headers;
    public array $params;
    public $user;

    public function __construct(
        string $method,
        string $path,
        array $query,
        array $body,
        array $headers,
        array $params = [],
        $user = null
    ) {
        $this->method = $method;
        $this->path = $path;
        $this->query = $query;
        $this->body = $body;
        $this->headers = $headers;
        $this->params = $params;
        $this->user = $user;
    }

    public static function capture(): self
    {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $scriptName = dirname($_SERVER['SCRIPT_NAME'] ?? '') ?: '';
        // When Apache rewrites via .htaccess into a public/ subdirectory,
        // SCRIPT_NAME ends with /public/index.php but the URI has no /public/ segment.
        // Fall back to the parent directory to correctly strip the app base path.
        if ($scriptName !== '/' && !str_starts_with($uri, $scriptName)) {
            $scriptName = dirname($scriptName) ?: '/';
        }
        if ($scriptName !== '/' && str_starts_with($uri, $scriptName)) {
            $uri = substr($uri, strlen($scriptName)) ?: '/';
        }

        $rawBody = file_get_contents('php://input') ?: '';
        $decoded = json_decode($rawBody, true);
        $body = is_array($decoded) ? $decoded : $_POST;

        $headers = function_exists('getallheaders') ? getallheaders() : [];
        // Some SAPIs drop Authorization from getallheaders(); recover it from server vars.
        if (!isset($headers['Authorization']) && !isset($headers['authorization'])) {
            $serverAuth = $_SERVER['HTTP_AUTHORIZATION']
                ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
                ?? null;
            if (is_string($serverAuth) && $serverAuth !== '') {
                $headers['Authorization'] = $serverAuth;
            }
        }

        return new self(
            strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'),
            '/' . trim($uri, '/'),
            $_GET,
            $body,
            $headers,
        );
    }

    public function withParams(array $params): self
    {
        return new self($this->method, $this->path, $this->query, $this->body, $this->headers, $params, $this->user);
    }

    public function withUser(mixed $user): self
    {
        return new self($this->method, $this->path, $this->query, $this->body, $this->headers, $this->params, $user);
    }

    public function input(string $key, mixed $default = null): mixed
    {
        return $this->body[$key] ?? $default;
    }

    public function header(string $key, mixed $default = null): mixed
    {
        foreach ($this->headers as $headerKey => $value) {
            if (strcasecmp($headerKey, $key) === 0) {
                return $value;
            }
        }
        return $default;
    }
}
