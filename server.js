const express = require("express");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const path = require("path");
const { Pool } = require("pg");

const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Crear tablas si no existen
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nombre TEXT,
      usuario TEXT UNIQUE,
      password TEXT,
      rol TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS resultados (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER REFERENCES usuarios(id),
      unidad TEXT,
      nota REAL
    );
  `);

  // Crear docente si no existe
  const passwordDocente = bcrypt.hashSync("admin123", 10);
  await pool.query(`
    INSERT INTO usuarios (nombre, usuario, password, rol)
    VALUES ('Wladimir', 'wladimir', $1, 'docente')
    ON CONFLICT (usuario) DO NOTHING;
  `, [passwordDocente]);

})();

// Ruta principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Login
app.post("/login", async (req, res) => {
  const { usuario, password } = req.body;

  const result = await pool.query(
    "SELECT * FROM usuarios WHERE usuario = $1",
    [usuario]
  );

  if (result.rows.length === 0) {
    return res.json({ success: false });
  }

  const user = result.rows[0];
  const valido = await bcrypt.compare(password, user.password);

  if (!valido) {
    return res.json({ success: false });
  }

  res.json({ success: true, rol: user.rol, nombre: user.nombre });
});

// Obtener estudiantes
app.get("/estudiantes", async (req, res) => {
  const result = await pool.query(
    "SELECT nombre, usuario FROM usuarios WHERE rol = 'estudiante'"
  );
  res.json(result.rows);
});

// Crear estudiante
app.post("/crear-estudiante", async (req, res) => {
  const { nombre, usuario, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    await pool.query(
      "INSERT INTO usuarios (nombre, usuario, password, rol) VALUES ($1, $2, $3, 'estudiante')",
      [nombre, usuario, hashedPassword]
    );

    res.json({ mensaje: "Estudiante creado correctamente" });
  } catch (error) {
    res.json({ mensaje: "Error: usuario ya existe" });
  }
});

// Guardar resultado
app.post("/guardar-resultado", async (req, res) => {
  const { usuario_id, unidad, nota } = req.body;

  await pool.query(
    "INSERT INTO resultados (usuario_id, unidad, nota) VALUES ($1, $2, $3)",
    [usuario_id, unidad, nota]
  );

  res.json({ mensaje: "Resultado guardado" });
});

// Ver resultados
app.get("/resultados", async (req, res) => {
  const result = await pool.query(`
    SELECT u.nombre, r.unidad, r.nota
    FROM resultados r
    JOIN usuarios u ON r.usuario_id = u.id
  `);

  res.json(result.rows);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor corriendo...");
});
let usuarioActual = null;

// Guardar usuario al hacer login
app.post("/login", async (req, res) => {
  const { usuario, password } = req.body;

  const result = await pool.query(
    "SELECT * FROM usuarios WHERE usuario = $1",
    [usuario]
  );

  if (result.rows.length === 0) {
    return res.json({ success: false });
  }

  const user = result.rows[0];
  const valido = await bcrypt.compare(password, user.password);

  if (!valido) {
    return res.json({ success: false });
  }

  usuarioActual = user; // 👈 guardamos sesión simple

  res.json({ success: true, rol: user.rol, nombre: user.nombre });
});

// Ruta usuario actual
app.get("/usuario-actual", (req, res) => {
  res.json(usuarioActual);
});

// Mis resultados
app.get("/mis-resultados/:id", async (req, res) => {
  const result = await pool.query(
    "SELECT unidad, nota FROM resultados WHERE usuario_id = $1",
    [req.params.id]
  );
  res.json(result.rows);
});