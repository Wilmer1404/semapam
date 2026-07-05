# Backend Dispensador de Agua API

API REST en PHP 8.1 + MySQL para el sistema de control de abastecimiento de agua.

## Estructura

- `public/`: punto de entrada.
- `app/Controllers`: endpoints.
- `app/Models`: acceso a datos.
- `app/Services`: JWT y logging.
- `app/Middleware`: autenticación.
- `database/schema.sql`: script base de BD.
- `routes/api.php`: rutas.

## Requisitos

- PHP 8.1 o superior
- Composer
- MySQL 8+
- Apache con `mod_rewrite`

## Instalación

1. Copia `.env.example` a `.env`
2. Ajusta credenciales de base de datos y secretos
3. Ejecuta:

```bash
composer install
```

4. Importa `database/schema.sql`
5. Configura Apache apuntando a `public/`

## Usuario demo

- usuario: `operador`
- contraseña: `123456`

## Endpoints principales

### Auth
- `POST /login`
- `GET /me`

### Catálogos
- `GET /catalogs/products`
- `GET /catalogs/zones`
- `GET /sync/catalogs`

### Abastecimientos
- `POST /abastecimientos`
- `POST /sync/abastecimientos`

### Tickets
- `GET /tickets`
- `GET /tickets/{id}`
- `POST /tickets/{id}/reprint`

### Arqueo
- `GET /arqueo/daily?fecha=2026-04-05`

## Formato de respuesta

```json
{
  "total_rows": 1,
  "status": true,
  "data": {},
  "message": "Operación realizada correctamente."
}
```

## Ejemplo login

```json
{
  "username": "operador",
  "password": "123456"
}
```

## Ejemplo sincronización de abastecimientos

```json
[
  {
    "idLocal": "abc-123",
    "cantidad": 10,
    "producto": { "id": 1 },
    "conductor": "Juan Perez",
    "recibidoPor": "Carlos Diaz",
    "zonaId": 1,
    "zonaNombreSnapshot": "Zona Centro",
    "latitud": -14.068,
    "longitud": -75.727,
    "precisionGps": 12,
    "fechaGps": "2026-04-05 08:00:00",
    "horaInicio": "2026-04-05 08:00:00",
    "horaFin": "2026-04-05 08:20:00",
    "importe": 18,
    "estadoSincronizacion": "SYNCED",
    "estadoImpresion": "PRINTED",
    "creadoOffline": true
  }
]
```

## Nota

La API está preparada para que luego le agregues:

- integración con tu capa real de impresión
- auditoría avanzada
- Google Cloud Logging
- gestión web de usuarios, productos y zonas
- refresh token y control de permisos
