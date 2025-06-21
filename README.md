# API REST con MongoDB

API educativa migrada de JSON Server a MongoDB con Express y Mongoose.

## 🚀 Características

- **Base de datos**: MongoDB con Mongoose
- **Autenticación**: JWT Tokens
- **Autorización**: Roles de usuario (admin/user)
- **Encriptación**: Passwords hasheados con bcrypt
- **Validaciones**: Esquemas de Mongoose
- **Paginación**: Para listados de clientes
- **Búsqueda**: Filtros en clientes y cursos
- **Relaciones**: Referencias entre modelos

## 📦 Instalación

### Prerrequisitos

- Node.js (v14 o superior)
- MongoDB (local o Atlas)

### Pasos

1. **Clonar e instalar dependencias**
```bash
npm install
```

2. **Configurar variables de entorno**
```bash
cp .env.example .env
```

Editar `.env` con tus configuraciones:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/education_api
JWT_SECRET=tu_clave_secreta_jwt
```

3. **Migrar datos existentes**
```bash
npm run seed
```

4. **Iniciar el servidor**
```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## 📝 Endpoints

### Autenticación

```http
POST /api/users/login
Content-Type: application/json

{
  "email": "admin@mail.com",
  "password": "123123123"
}
```

### Usuarios

```http
GET    /api/users           # Listar usuarios (requiere auth)
GET    /api/users/:id       # Obtener usuario (requiere auth)
POST   /api/users           # Crear usuario
PUT    /api/users/:id       # Actualizar usuario (requiere auth)
DELETE /api/users/:id       # Eliminar usuario (requiere auth)
POST   /api/users/login     # Login
```

### Clientes

```http
GET    /api/clients         # Listar clientes (con paginación y búsqueda)
GET    /api/clients/:id     # Obtener cliente
POST   /api/clients         # Crear cliente
PUT    /api/clients/:id     # Actualizar cliente (requiere auth)
DELETE /api/clients/:id     # Eliminar cliente (requiere auth)
```

**Parámetros de consulta para clientes:**
- `page`: Número de página (default: 1)
- `limit`: Elementos por página (default: 10)
- `search`: Búsqueda en nombre, apellido o email

### Productos

```http
GET    /api/products         # Listar productos (con filtros)
GET    /api/products/:id     # Obtener producto
POST   /api/products         # Crear producto (requiere auth)
PUT    /api/products/:id     # Actualizar producto (requiere auth)
DELETE /api/products/:id     # Eliminar producto (requiere auth)

# Gestión de clases
POST   /api/products/:id/classes           # Agregar clase
PUT    /api/products/:id/classes/:classId  # Actualizar clase
DELETE /api/products/:id/classes/:classId  # Eliminar clase
```

**Parámetros de consulta para productos:**
- `level`: Filtrar por nivel (Beginner, Intermediate, Advanced)
- `search`: Búsqueda en nombre o descripción

### Inscripciones

```http
GET    /api/inscriptions         # Listar inscripciones (requiere auth)
GET    /api/inscriptions/:id     # Obtener inscripción (requiere auth)
POST   /api/inscriptions         # Crear inscripción
PUT    /api/inscriptions/:id     # Actualizar inscripción (requiere auth)
PATCH  /api/inscriptions/:id/progress  # Actualizar progreso (requiere auth)
DELETE /api/inscriptions/:id     # Eliminar inscripción (requiere auth)
GET    /api/inscriptions/stats/overview  # Estadísticas (requiere auth)
```

**Parámetros de consulta para inscripciones:**
- `status`: Filtrar por estado (active, completed, cancelled)
- `clientId`: Filtrar por cliente
- `productId`: Filtrar por producto

## 🔐 Autenticación

La API usa JWT tokens. Incluye el token en el header:

```http
Authorization: Bearer <tu_token_jwt>
```

## 👥 Usuarios de Prueba

Después de ejecutar `npm run seed`:

- **Admin**: `admin@mail.com` / `123123123`
- **Usuario**: `test@test.com` / `123123123`

## 🏗️ Estructura del Proyecto

```
src/
├── models/           # Esquemas de Mongoose
│   ├── User.js
│   ├── Client.js
│   ├── Product.js
│   └── Inscription.js
├── routes/           # Rutas de la API
│   ├── users.js
│   ├── clients.js
│   ├── products.js
│   └── inscriptions.js
├── middleware/       # Middlewares
│   └── auth.js
├── seeders/          # Scripts de migración
│   └── seed.js
└── index.js          # Servidor principal
```

## 🔄 Migración desde JSON Server

Los datos existentes en `db.json` se migran automáticamente ejecutando:

```bash
npm run seed
```

Este comando:
1. Limpia la base de datos
2. Migra usuarios, clientes y cursos
3. Crea inscripciones de ejemplo
4. Hashea las contraseñas
5. Genera tokens JWT

## 🆕 Nuevas Funcionalidades

### Respecto al JSON Server original:

- ✅ **Autenticación JWT**
- ✅ **Roles y permisos**
- ✅ **Passwords encriptados**
- ✅ **Validaciones de datos**
- ✅ **Relaciones entre modelos**
- ✅ **Paginación y búsqueda**
- ✅ **Gestión de progreso en inscripciones**
- ✅ **Estadísticas de inscripciones**
- ✅ **Gestión de clases en cursos**

## 📊 Modelos de Datos

### Usuario
```javascript
{
  firstName: String,
  lastName: String,
  email: String (único),
  password: String (hasheado),
  role: 'admin' | 'user',
  token: String
}
```

### Cliente
```javascript
{
  firstName: String,
  lastName: String,
  email: String (único),
  birthdate: Date,
  token: String
}
```

### Curso
```javascript
{
  name: String,
  duration: String,
  level: 'Beginner' | 'Intermediate' | 'Advanced',
  description: String,
  classes: [{
    name: String,
    date: Date
  }]
}
```

### Inscripción
```javascript
{
  client: ObjectId (ref: Client),
  course: ObjectId (ref: Course),
  status: 'active' | 'completed' | 'cancelled',
  enrollmentDate: Date,
  completionDate: Date,
  progress: Number (0-100)
}
```

## 🛠️ Scripts Disponibles

- `npm start`: Iniciar servidor en producción
- `npm run dev`: Iniciar con nodemon (desarrollo)
- `npm run seed`: Migrar datos de db.json a MongoDB