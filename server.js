const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
app.use(bodyParser.json());
app.use(express.static("public"));

const db = new sqlite3.Database("./database.db");

// Crear tablas
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT,
    usuario TEXT UNIQUE,
    password TEXT,
    rol TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS resultados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    unidad TEXT,
    nota REAL
  )`);
});

// Crear docente si no existe
const passwordDocente = bcrypt.hashSync("admin123", 10);
db.run(`INSERT OR IGNORE INTO usuarios (id, nombre, usuario, password, rol)
        VALUES (1, 'Wladimir', 'wladimir', '${passwordDocente}', 'docente')`);

// Ruta principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Login
app.post("/login", (req, res) => {
  const { usuario, password } = req.body;

  db.get("SELECT * FROM usuarios WHERE usuario = ?", [usuario], async (err, row) => {
    if (!row) return res.json({ success: false });

    const valido = await bcrypt.compare(password, row.password);
    if (!valido) return res.json({ success: false });

    res.json({ success: true, rol: row.rol, nombre: row.nombre });
  });
});

app.listen(3000, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});
// Crear estudiante
app.post("/crear-estudiante", async (req, res) => {
  const { nombre, usuario, password } = req.body;

  if (!nombre || !usuario || !password) {
    return res.json({ success: false, message: "Faltan datos" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  db.run(
    "INSERT INTO usuarios (nombre, usuario, password, rol) VALUES (?, ?, ?, ?)",
    [nombre, usuario, hashedPassword, "estudiante"],
    function (err) {
      if (err) {
        return res.json({ success: false, message: "Usuario ya existe" });
      }
      res.json({ success: true });
    }
  );
});