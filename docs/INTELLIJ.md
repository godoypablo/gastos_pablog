# Abrir el Proyecto en IntelliJ IDEA

## 📂 Estructura del Proyecto

```
gastos-personales/
├── api/                  # APIs REST PHP
├── assets/              # Recursos estáticos (CSS, JS, imágenes)
│   ├── css/            # Estilos personalizados
│   └── js/             # JavaScript de la aplicación
├── config/              # Configuración de la aplicación
├── docs/                # Documentación del proyecto
│   ├── COLORES.md      # Paleta de colores
│   ├── INSTALACION.md  # Guía de instalación
│   ├── INTELLIJ.md     # Este archivo
│   └── README.md       # README principal
├── includes/            # Archivos PHP auxiliares
├── scripts/             # Scripts SQL y utilidades
│   ├── schema.sql      # Esquema de base de datos
│   └── test_conexion.php # Test de conexión
├── .idea/               # Configuración de IntelliJ IDEA
├── .gitignore          # Archivos ignorados por Git
└── index.html          # Página principal
```

## 🚀 Abrir el Proyecto en IntelliJ IDEA

### Método 1: Abrir Directorio Existente

1. **Iniciar IntelliJ IDEA**

2. **Abrir el proyecto:**
   - Clic en `File` → `Open...`
   - Navegar a: `/home/pablog/git/pablogodoy/gastos-personales`
   - Clic en `OK`

3. **Configurar el proyecto:**
   - IntelliJ detectará automáticamente que es un proyecto web
   - Aparecerá un mensaje para confiar en el proyecto → Clic en `Trust Project`

### Método 2: Desde Terminal

```bash
cd /home/pablog/git/pablogodoy/gastos-personales
idea .
```

(Si `idea` no está en el PATH, usar la ruta completa al ejecutable de IntelliJ)

### Método 3: Importar desde Git (si no está clonado)

1. `File` → `New` → `Project from Version Control...`
2. Ingresar URL del repositorio
3. Seleccionar directorio destino
4. Clic en `Clone`

## ⚙️ Configuración Recomendada

### 1. Configurar PHP Interpreter

1. `File` → `Settings` (o `Ctrl+Alt+S`)
2. `Languages & Frameworks` → `PHP`
3. Configurar PHP Language Level: `7.4` o superior
4. Clic en `...` junto a `CLI Interpreter`
5. Agregar intérprete PHP local:
   - Clic en `+` → `Local Path`
   - Seleccionar ruta: `/usr/bin/php` (o donde esté instalado)
6. Aplicar cambios

### 2. Configurar Database Tools (MySQL)

1. `View` → `Tool Windows` → `Database`
2. Clic en `+` → `Data Source` → `MySQL`
3. Configurar conexión:
   - **Host:** localhost
   - **Port:** 3306
   - **Database:** gastos_personales
   - **User:** root (o tu usuario)
   - **Password:** (tu contraseña)
4. Clic en `Test Connection`
5. Si es exitoso → `OK`

### 3. Configurar Code Style

El proyecto usa:
- **Indentación:** 4 espacios
- **Encoding:** UTF-8
- **Line Endings:** LF (Unix)

Para configurar:
1. `File` → `Settings` → `Editor` → `Code Style`
2. Seleccionar `PHP`
3. Tab size: 4, Indent: 4, Continuation indent: 8

### 4. Habilitar Plugins Útiles

Plugins recomendados:
- **PHP** (incluido por defecto)
- **Database Tools and SQL** (incluido por defecto)
- **JavaScript and TypeScript** (incluido por defecto)
- **Bootstrap** (opcional, para autocompletado)
- **Markdown** (para editar documentación)

Para instalar:
1. `File` → `Settings` → `Plugins`
2. Buscar el plugin
3. Clic en `Install`

## 🔧 Funcionalidades de IntelliJ para este Proyecto

### 1. Ejecutar Servidor PHP Built-in

**Opción A: Desde Terminal Integrada**
1. `View` → `Tool Windows` → `Terminal`
2. Ejecutar:
   ```bash
   php -S localhost:8000
   ```

**Opción B: Crear Run Configuration**
1. `Run` → `Edit Configurations...`
2. Clic en `+` → `PHP Built-in Web Server`
3. Configurar:
   - **Name:** Gastos Personales Server
   - **Host:** localhost
   - **Port:** 8000
   - **Document root:** (ruta del proyecto)
4. Clic en `OK`
5. Ejecutar con `Shift+F10` o botón Run

### 2. Ejecutar Scripts SQL

1. Abrir `scripts/schema.sql`
2. Conectar a la base de datos (panel Database)
3. Seleccionar el código SQL
4. Clic derecho → `Execute` (o `Ctrl+Enter`)

### 3. Depurar PHP

1. Instalar Xdebug en tu sistema
2. Configurar en `php.ini`:
   ```ini
   zend_extension=xdebug.so
   xdebug.mode=debug
   xdebug.start_with_request=yes
   ```
3. En IntelliJ:
   - `Run` → `Edit Configurations...`
   - Agregar configuración de debug
   - Colocar breakpoints en el código
   - Iniciar debug con `Shift+F9`

### 4. Búsqueda y Navegación

- **Buscar archivo:** `Ctrl+Shift+N`
- **Buscar en archivos:** `Ctrl+Shift+F`
- **Ir a definición:** `Ctrl+B`
- **Buscar uso:** `Alt+F7`
- **Renombrar:** `Shift+F6`
- **Formatear código:** `Ctrl+Alt+L`

### 5. Control de Versiones (Git)

- **Commit:** `Ctrl+K`
- **Push:** `Ctrl+Shift+K`
- **Historial:** `Alt+9`
- **Ver cambios:** `Ctrl+D`

## 📝 Atajos Útiles

| Atajo | Acción |
|-------|--------|
| `Ctrl+Shift+A` | Buscar acción |
| `Alt+Insert` | Generar código |
| `Ctrl+/` | Comentar línea |
| `Ctrl+Shift+/` | Comentar bloque |
| `Ctrl+D` | Duplicar línea |
| `Ctrl+Y` | Eliminar línea |
| `Alt+J` | Selección múltiple |
| `Ctrl+W` | Expandir selección |
| `Ctrl+Shift+W` | Contraer selección |
| `Alt+Enter` | Mostrar intención/quick fix |

## 🐛 Solución de Problemas en IntelliJ

### PHP no se reconoce

**Solución:**
1. Instalar PHP en el sistema
2. Configurar intérprete PHP en Settings
3. Reiniciar IntelliJ

### Base de datos no conecta

**Solución:**
1. Verificar que MySQL esté ejecutándose
2. Descargar drivers JDBC (IntelliJ lo sugiere)
3. Verificar credenciales en Database Tool Window

### Archivos marcados como "External Library"

**Solución:**
1. Clic derecho en el directorio
2. `Mark Directory as` → `Unmark as Sources Root`
3. O configurar en `File` → `Project Structure`

### Sintaxis JavaScript no reconocida

**Solución:**
1. `File` → `Settings`
2. `Languages & Frameworks` → `JavaScript`
3. Seleccionar versión: `ECMAScript 6+`

## 📚 Recursos Adicionales

- [IntelliJ IDEA PHP Documentation](https://www.jetbrains.com/help/idea/php.html)
- [Database Tools](https://www.jetbrains.com/help/idea/database-tool-window.html)
- [PHP Built-in Web Server](https://www.jetbrains.com/help/idea/php-built-in-web-server.html)

## 🎯 Flujo de Trabajo Recomendado

1. **Iniciar IntelliJ IDEA**
2. **Abrir el proyecto**
3. **Conectar a la base de datos** (panel Database)
4. **Abrir terminal integrada** y ejecutar servidor PHP
5. **Navegar al navegador:** `http://localhost:8000`
6. **Editar código** en IntelliJ
7. **Refrescar navegador** para ver cambios
8. **Commit cambios** cuando estén listos

¡Ya estás listo para desarrollar! 🚀
