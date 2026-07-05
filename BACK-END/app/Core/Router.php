<?php

declare(strict_types=1);

namespace App\Core;

use Closure;

final class Router
{
    private array $routes = [];

    public function get(string $path, callable|array $handler, array $middlewares = []): void
    {
        $this->addRoute('GET', $path, $handler, $middlewares);
    }

    public function post(string $path, callable|array $handler, array $middlewares = []): void
    {
        $this->addRoute('POST', $path, $handler, $middlewares);
    }

    public function put(string $path, callable|array $handler, array $middlewares = []): void
    {
        $this->addRoute('PUT', $path, $handler, $middlewares);
    }

    public function patch(string $path, callable|array $handler, array $middlewares = []): void
    {
        $this->addRoute('PATCH', $path, $handler, $middlewares);
    }

    public function delete(string $path, callable|array $handler, array $middlewares = []): void
    {
        $this->addRoute('DELETE', $path, $handler, $middlewares);
    }

    private function addRoute(string $method, string $path, callable|array $handler, array $middlewares): void
    {
        $this->routes[] = compact('method', 'path', 'handler', 'middlewares');
    }

    public function dispatch(Request $request): void
    {
        foreach ($this->routes as $route) {
            if ($route['method'] !== $request->method) {
                continue;
            }

            $params = $this->match($route['path'], $request->path);
            if ($params === null) {
                continue;
            }

            $request = $request->withParams($params);
            $runner = $this->buildPipeline($route['middlewares'], $route['handler']);
            $runner($request);
            return;
        }

        Response::error('Ruta no encontrada.', [], 404);
    }

    private function match(string $routePath, string $requestPath): ?array
    {
        $pattern = preg_replace('#\{([^/]+)\}#', '(?P<$1>[^/]+)', rtrim($routePath, '/'));
        $pattern = '#^' . ($pattern === '' ? '/' : $pattern) . '$#';
        $requestPath = rtrim($requestPath, '/') ?: '/';

        if (!preg_match($pattern, $requestPath, $matches)) {
            return null;
        }

        return array_filter($matches, static fn ($key) => !is_int($key), ARRAY_FILTER_USE_KEY);
    }

    private function buildPipeline(array $middlewares, callable|array $handler): Closure
    {
        $controllerInvoker = function (Request $request) use ($handler): void {
            if (is_array($handler)) {
                [$controller, $method] = $handler;
                (new $controller())->{$method}($request);
                return;
            }
            $handler($request);
        };

        return array_reduce(
            array_reverse($middlewares),
            fn (Closure $next, string $middleware) => fn (Request $request) => (new $middleware())->handle($request, $next),
            $controllerInvoker,
        );
    }
}
