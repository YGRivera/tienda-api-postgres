const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { URL } = require('node:url');
const { Pool } = require('pg');

// Load this project's settings explicitly so unrelated Windows environment
// variables (for example, another DATABASE_URL) cannot override the store DB.
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
    process.env[key] = value;
  }
}

const port = Number(process.env.PORT || 3000);
const pool = new Pool({
  connectionString: process.env.TIENDA_DATABASE_URL || 'postgres://tienda@127.0.0.1:5433/tienda_db',
});

const seedProducts = [
  ['Laptop Lenovo IdeaPad', 12999.00, 12, 'Electrónica'],
  ['Mouse inalámbrico', 349.90, 40, 'Accesorios'],
  ['Teclado mecánico', 1199.00, 18, 'Accesorios'],
  ['Monitor 24 pulgadas', 3899.00, 9, 'Electrónica'],
  ['Audífonos Bluetooth', 899.00, 25, 'Audio'],
  ['Silla de oficina', 2799.00, 7, 'Muebles'],
  ['Webcam HD', 649.00, 16, 'Electrónica'],
  ['Disco SSD 1 TB', 1599.00, 14, 'Almacenamiento'],
  ['Bocina portátil', 749.00, 21, 'Audio'],
  ['Base para laptop', 429.00, 30, 'Accesorios'],
];

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS productos (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(160) NOT NULL,
      precio NUMERIC(10, 2) NOT NULL CHECK (precio >= 0),
      stock INTEGER NOT NULL CHECK (stock >= 0),
      categoria VARCHAR(100) NOT NULL
    )
  `);
  const { rows } = await pool.query('SELECT COUNT(*)::int AS total FROM productos');
  if (rows[0].total === 0) {
    for (const producto of seedProducts) {
      await pool.query(
        'INSERT INTO productos (nombre, precio, stock, categoria) VALUES ($1, $2, $3, $4)',
        producto,
      );
    }
    console.log('Se cargaron 10 productos de ejemplo.');
  }
}

function send(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) body += chunk;
  if (!body) return {};
  return JSON.parse(body);
}

function validateProduct(data, partial = false) {
  const fields = ['nombre', 'precio', 'stock', 'categoria'];
  if (!partial && fields.some((key) => data[key] === undefined)) return 'Se requieren nombre, precio, stock y categoria.';
  if (data.nombre !== undefined && (typeof data.nombre !== 'string' || !data.nombre.trim())) return 'nombre debe ser texto no vacío.';
  if (data.categoria !== undefined && (typeof data.categoria !== 'string' || !data.categoria.trim())) return 'categoria debe ser texto no vacío.';
  if (data.precio !== undefined && (!Number.isFinite(Number(data.precio)) || Number(data.precio) < 0)) return 'precio debe ser un número mayor o igual a 0.';
  if (data.stock !== undefined && (!Number.isInteger(Number(data.stock)) || Number(data.stock) < 0)) return 'stock debe ser un entero mayor o igual a 0.';
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const match = url.pathname.match(/^\/api\/productos(?:\/(\d+))?\/?$/);
  try {
    if (url.pathname === '/health' && req.method === 'GET') {
      await pool.query('SELECT 1');
      return send(res, 200, { status: 'ok', database: 'connected' });
    }
    if (!match) return send(res, 404, { error: 'Ruta no encontrada.' });
    const id = match[1] ? Number(match[1]) : null;

    if (req.method === 'GET' && id === null) {
      const { rows } = await pool.query('SELECT id, nombre, precio, stock, categoria FROM productos ORDER BY id');
      return send(res, 200, rows);
    }
    if (req.method === 'GET' && id !== null) {
      const { rows } = await pool.query('SELECT id, nombre, precio, stock, categoria FROM productos WHERE id = $1', [id]);
      return rows[0] ? send(res, 200, rows[0]) : send(res, 404, { error: 'Producto no encontrado.' });
    }
    if (req.method === 'POST' && id === null) {
      const data = await readJson(req);
      const error = validateProduct(data);
      if (error) return send(res, 400, { error });
      const { rows } = await pool.query(
        'INSERT INTO productos (nombre, precio, stock, categoria) VALUES ($1, $2, $3, $4) RETURNING id, nombre, precio, stock, categoria',
        [data.nombre.trim(), data.precio, data.stock, data.categoria.trim()],
      );
      return send(res, 201, rows[0]);
    }
    return send(res, 405, { error: 'Método no permitido.' });
  } catch (error) {
    if (error instanceof SyntaxError) return send(res, 400, { error: 'El cuerpo debe ser JSON válido.' });
    console.error(error);
    return send(res, 500, { error: 'Error interno del servidor.' });
  }
});

initializeDatabase()
  .then(() => server.listen(port, () => console.log(`API disponible en http://localhost:${port}`)))
  .catch((error) => {
    console.error('No se pudo inicializar PostgreSQL:', error.message);
    process.exit(1);
  });

process.on('SIGINT', async () => {
  server.close();
  await pool.end();
  process.exit(0);
});
