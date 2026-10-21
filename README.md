# API de tienda: Node.js + PostgreSQL

API REST para consultar productos de una tienda. Guarda `id`, `nombre`, `precio`, `stock` y `categoria` en PostgreSQL. La primera vez que arranca con una base vacía inserta 10 productos de ejemplo.

## API pública en Render

La API está desplegada en [https://tienda-api-olx7.onrender.com](https://tienda-api-olx7.onrender.com). Prueba [un producto por ID](https://tienda-api-olx7.onrender.com/api/productos/1), [la lista completa](https://tienda-api-olx7.onrender.com/api/productos) o [el estado de la base](https://tienda-api-olx7.onrender.com/health).

El archivo `render.yaml` configura el servicio web Node.js y PostgreSQL administrado. Render configura `TIENDA_DATABASE_URL` desde la base; no subas el archivo `.env`.

**Nota del plan gratuito:** la base PostgreSQL gratuita de Render vence 30 días después de crearla. Si la práctica debe seguir disponible después, habrá que cambiar a un plan pagado antes de que venza; Render ofrece 14 días de gracia después del vencimiento y luego elimina la base y sus datos. El servicio web gratuito puede suspenderse cuando está inactivo.

## Ejecutar localmente con Docker

Requisitos: Docker Desktop iniciado y Node.js 20 o posterior.

```powershell
Copy-Item .env.example .env
docker volume create postgres_data
docker compose up -d
npm ci
npm start
```

La API queda en `http://localhost:3000`; PostgreSQL escucha solo en `127.0.0.1:5433`. El volumen Docker `postgres_data` conserva los datos entre reinicios. La autenticación `trust` es únicamente para la base local de esta práctica. Para detener PostgreSQL: `docker compose down`. Para borrar también el volumen local: `docker compose down -v`.

## Rutas

| Método | Ruta | Acción |
|---|---|---|
| GET | `/health` | Comprueba la API y la conexión con la base |
| GET | `/api/productos` | Lista los productos |
| GET | `/api/productos/:id` | Consulta un producto por ID |
| POST | `/api/productos` | Agrega un producto |

Ejemplo: `http://localhost:3000/api/productos/1`. Cambia el último número para consultar otro producto.

Ejemplo de `POST /api/productos` con `Content-Type: application/json`:

```json
{
  "nombre": "Tablet",
  "precio": 4500,
  "stock": 8,
  "categoria": "Electrónica"
}
```
