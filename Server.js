const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const mysql = require('mysql2');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');

function requireRole(...roles) {
  return (req, res, next) => {
      if (req.session.user && roles.includes(req.session.user.tipo_usuario)) {
          next();
      } else {
          res.status(403).send('Acceso denegado');
      }
  };
}
app.use(bodyParser.urlencoded({ extended: true }));

// Configuración de la sesión
app.use(session({
  secret: 'secretKey',
  resave: false,
  saveUninitialized: false,
}));

// Ruta protegida (Página principal después de iniciar sesión)
app.get('/', requireLogin, (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos (HTML)
app.use(express.static(path.join(__dirname, 'public')));

// Ruta para la página principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar el servidor
app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});


// Configurar conexión a MySQL
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'DSLI.vizio.2004', // Cambia por tu contraseña
  database: 'gestion_pacientes'
});



// Registro de usuario
app.post('/registrar', async (req, res) => {
  const { nombre_usuario, password, codigo_acceso } = req.body;

  const query = 'SELECT tipo_usuario FROM codigos_acceso WHERE codigo = ?';
  connection.query(query, [codigo_acceso], (err, results) => {
      if (err || results.length === 0) {
          return res.send('Código de acceso inválido');
      }

      const tipo_usuario = results[0].tipo_usuario;
      const hashedPassword = bcrypt.hashSync(password, 10);

      const insertUser = 'INSERT INTO usuarios (nombre_usuario, password_hash, tipo_usuario) VALUES (?, ?, ?)';
      connection.query(insertUser, [ nombre_usuario, hashedPassword, tipo_usuario], (err) => {
          if (err) return res.send('Error al registrar usuario');
          res.redirect('/login.html');
      });
  });
});

// Iniciar sesión
app.post('/login', (req, res) => {
  const { nombre_usuario, password } = req.body;

  // Consulta para obtener el usuario y su tipo
  const query = 'SELECT * FROM usuarios WHERE nombre_usuario = ?';
  connection.query(query, [nombre_usuario], (err, results) => {
      if (err) {
          return res.send('Error al obtener el usuario');
      }

      if (results.length === 0) {
          return res.send('Usuario no encontrado');
      }

      const user = results[0];

      // Verificar la contraseña
      const isPasswordValid = bcrypt.compareSync(password, user.password_hash);
      if (!isPasswordValid) {
          return res.send('Contraseña incorrecta');
      }

      // Almacenar la información del usuario en la sesión
      req.session.user = {
          id: user.id,
          nombre_usuario: user.nombre_usuario,
          tipo_usuario: user.tipo_usuario // Aquí se establece el tipo de usuario en la sesión
      };

      // Redirigir al usuario a la página principal
      res.redirect('/');
  });
});

// Cerrar sesión
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login.html');
});

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login.html');
  }
  next();
}

connection.connect(err => {
  if (err) {
    console.error('Error conectando a MySQL:', err);
    return;
  }
  console.log('Conexión exitosa a MySQL');
});

// Ruta para guardar datos en la base de datos
app.post('/submit-data', (req, res) => {
  const { name, age, heart_rate, presion, peso } = req.body;

  const query = 'INSERT INTO pacientes (nombre, edad, frecuencia_cardiaca, presion, peso) VALUES (?, ?, ?, ?, ?)';
  connection.query(query, [name, age, heart_rate, presion, peso], (err, result) => {
    if (err) {
      return res.send('Error al guardar los datos en la base de datos.');
    }
    res.send(`Paciente ${name} guardado en la base de datos.`);
  });
});


// Ruta para mostrar los datos de la base de datos en formato HTML



app.get('/medicos',requireLogin, requireRole('admin'), (req, res) => {
  connection.query('SELECT * FROM medicos', (err, results) => {
    if (err) {
      return res.send('Error al obtener los datos.');
    }

    let html = `
      <html>
      <head>
        <link rel="stylesheet" href="/styles.css">
        <title>Medicos</title>
      </head>
      <body>
        <h1>Medicos Registrados</h1>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Especialidad</th>
            </tr>
          </thead>
          <tbody>
    `;

    results.forEach(medicos => {
      html += `
        <tr>
          <td>${medicos.nombre}</td>
          <td>${medicos.especialidad}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
        <button onclick="window.location.href='/'">Volver</button>
        <button onclick="window.location.href='/medicosALF'">Ver Medicos Guardados alfabeticamente</button>
      </body>
      </html>
    `;

    res.send(html);
  });
});

app.get('/medicosALF', requireLogin, requireRole('admin'), (req, res) => {
  const query = 'SELECT * FROM medicos ORDER BY nombre ASC';

  connection.query(query, (err, results) => {
    if (err) {
      return res.send('Error al obtener los datos.');
    }

    let html = `
    <html>
    <head>
      <link rel="stylesheet" href="/styles.css">
      <title>Medicos</title>
    </head>
    <body>
      <h1>Medicos Registrados</h1>
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Especialidad</th>
          </tr>
        </thead>
        <tbody>
  `;

  results.forEach(medicos => {
    html += `
      <tr>
        <td>${medicos.nombre}</td>
        <td>${medicos.especialidad}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
      <button onclick="window.location.href='/'">Volver</button>
    </body>
    </html>
  `;

  res.send(html);
});
});


// Otras rutas protegidas
app.get('/buscar-pacientes', requireLogin,requireRole('medico', 'admin'), (req, res) => {
  // lógica de búsqueda de pacientes
  // Ruta para buscar pacientes según filtros
  const { name_search, age_search } = req.query;
  let query = 'SELECT * FROM pacientes WHERE 1=1';

  if (name_search) {
    query += ` AND nombre LIKE '%${name_search}%'`;
  }
  if (age_search) {
    query += ` AND edad = ${age_search}`;
  }

  connection.query(query, (err, results) => {
    if (err) {
      return res.send('Error al obtener los datos.');
    }

    let html = `
      <html>
      <head>
        <link rel="stylesheet" href="/styles.css">
        <title>Resultados de Búsqueda</title>
      </head>
      <body>
        <h1>Resultados de Búsqueda</h1>
        <table>
          <thead>
            <tr>
              <th>Id</th>
              <th>Nombre</th>
              <th>Edad</th>
              <th>Frecuencia Cardiaca (bpm)</th>
              <th>Presion del Paciente (mmHg)</th>
              <th>Peso del paciente (Kg)</th>
            </tr>
          </thead>
          <tbody>
    `;

    results.forEach(paciente => {
      html += `
        <tr>
           <td>${paciente.id}</td>
          <td>${paciente.nombre}</td>
          <td>${paciente.edad}</td>
          <td>${paciente.frecuencia_cardiaca}</td>
           <td>${paciente.presion}</td>
          <td>${paciente.Peso}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
        <button onclick="window.location.href='/'">Volver</button>
      </body>
      </html>
    `;

    res.send(html);
  });
});


app.get('/ordenar-pacientes', requireLogin, requireRole('medico', 'admin'), (req, res) => {
  // lógica de ordenamiento de pacientes
  // Ruta para ordenar pacientes por frecuencia cardiaca
  const query = 'SELECT * FROM pacientes ORDER BY frecuencia_cardiaca DESC';

  connection.query(query, (err, results) => {
    if (err) {
      return res.send('Error al obtener los datos.');
    }

    let html = `
      <html>
      <head>
        <link rel="stylesheet" href="/styles.css">
        <title>Pacientes Ordenados</title>
      </head>
      <body>
        <h1>Pacientes Ordenados por Frecuencia Cardiaca</h1>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Edad</th>
              <th>Frecuencia Cardiaca (bpm)</th>
            </tr>
          </thead>
          <tbody>
    `;

    results.forEach(paciente => {
      html += `
        <tr>
          <td>${paciente.nombre}</td>
          <td>${paciente.edad}</td>
          <td>${paciente.frecuencia_cardiaca}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
        <button onclick="window.location.href='/'">Volver</button>
      </body>
      </html>
    `;

    res.send(html);
  });
});

app.post('/insertar-medico', requireLogin, requireRole('admin'), (req, res) => {
  // lógica de inserción de médicos
  // Ruta para insertar un nuevo médico
  const { medico_name, especialidad } = req.body;
  const query = 'INSERT INTO medicos (nombre, especialidad) VALUES (?, ?)';

  connection.query(query, [medico_name, especialidad], (err, result) => {
    if (err) {
      return res.send('Error al insertar el médico.');
    }
    res.send(`Médico ${medico_name} guardado exitosamente.`);
  });
});

// Ruta para que solo admin pueda ver todos los usuarios
app.get('/ver-usuarios', requireLogin, requireRole('admin'), (req, res) => {
  const query = 'SELECT * FROM usuarios';
  connection.query(query, (err, results) => {
      if (err) return res.send('Error al obtener usuarios');
    
      let html = `
      <html>
      <head>
        <link rel="stylesheet" href="/styles.css">
        <title>Resultados de Búsqueda</title>
      </head>
      <body>
        <h1>Resultados de Búsqueda</h1>
        <table>
          <thead>
            <tr>
              <th>Id</th>
              <th>Nombre</th>
              <th>Contraseña</th>
              <th>Tipo de usuario (bpm)</th
            </tr>
          </thead>
          <tbody>
    `;

    results.forEach(usuario => {
      html += `
        <tr>
           <td>${usuario.id}</td>
          <td>${usuario.nombre_usuario}</td>
          <td>${usuario.password_hash}</td>
          <td>${usuario.tipo_usuario}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
        <button onclick="window.location.href='/'">Volver</button>
      </body>
      </html>
    `;

    res.send(html);
  });
});

// Ruta para que los médicos puedan ver pacientes
app.get('/pacientes', requireLogin, requireRole('medico', 'admin'), (req, res) => {
  // Lógica de consulta para ver pacientes
    connection.query('SELECT * FROM pacientes', (err, results) => {
      if (err) {
        return res.send('Error al obtener los datos.');
      }
  
      let html = `
        <html>
        <head>
          <link rel="stylesheet" href="/styles.css">
          <title>Pacientes</title>
        </head>
        <body>
          <h1>Pacientes Registrados</h1>
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Edad</th>
                <th>Frecuencia Cardiaca (bpm)</th>
                <th>Presion del Paciente (mmHg)</th>
                <th>Peso del paciente (Kg)</th>
              </tr>
            </thead>
            <tbody>
      `;
  
      results.forEach(paciente => {
        html += `
          <tr>
            <td>${paciente.nombre}</td>
            <td>${paciente.edad}</td>
            <td>${paciente.frecuencia_cardiaca}</td>
            <td>${paciente.presion}</td>
            <td>${paciente.Peso}</td>
          </tr>
        `;
      });
  
      html += `
            </tbody>
          </table>
          <button onclick="window.location.href='/'">Volver</button>
        </body>
        </html>
      `;
  
      res.send(html);
    });
});

// Ruta para obtener el tipo de usuario actual
app.get('/tipo-usuario', requireLogin, (req, res) => {
  res.json({ tipo_usuario: req.session.user.tipo_usuario });
}); 

// Ruta para que el paciente vea sus propios datos
app.get('/ver-mis-datos', requireLogin, requireRole('paciente'), (req, res) => {
  const user = req.session.user.nombre_usuario;
  const query = 'SELECT * FROM pacientes WHERE nombre = ? ';
  connection.query(query, [user], (err, results) => {
      if (err) return res.send('Error al obtener usuarios');
    
      let html = `
      <html>
      <head>
        <link rel="stylesheet" href="/styles.css">
        <title>Resultados de Búsqueda</title>
      </head>
      <body>
        <h1>Resultados de Búsqueda</h1>
        <table>
          <thead>
            <tr>
              <th>Id</th>
              <th>Nombre</th>
              <th>Edad</th>
              <th>Frecuencia Cardiaca (bpm)</th>
              <th>Presion del Paciente (mmHg)</th>
              <th>Peso del paciente (Kg)</th>
            </tr>
          </thead>
          <tbody>
    `;

    results.forEach(paciente => {
      html += `
        <tr>
           <td>${paciente.id}</td>
          <td>${paciente.nombre}</td>
          <td>${paciente.edad}</td>
          <td>${paciente.frecuencia_cardiaca}</td>
           <td>${paciente.presion}</td>
          <td>${paciente.Peso}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
        <button onclick="window.location.href='/'">Volver</button>
      </body>
      </html>
    `;

    res.send(html);
  });
});
