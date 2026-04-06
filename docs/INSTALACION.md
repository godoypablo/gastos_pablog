# Guía de Instalación - Sistema de Gastos Personales

## 📋 Requisitos Previos

- PHP 7.4 o superior
- MySQL 5.7 o superior (o MariaDB)
- Servidor web (Apache, Nginx) o PHP Built-in Server

## 🔧 Instalación Paso a Paso

### Paso 1: Instalar PHP y MySQL

#### En Ubuntu/Debian:
```bash
sudo apt update
sudo apt install php php-mysql php-pdo mysql-server
```

#### En Fedora/CentOS/RHEL:
```bash
sudo dnf install php php-mysqlnd php-pdo mysql-server
sudo systemctl start mysqld
sudo systemctl enable mysqld
```

#### En Arch Linux:
```bash
sudo pacman -S php php-pdo mariadb
sudo systemctl start mariadb
sudo systemctl enable mariadb
```

#### Verificar instalación:
```bash
php -v
mysql --version
```

### Paso 2: Configurar MySQL

#### 2.1. Iniciar MySQL
```bash
sudo systemctl start mysql   # o mysqld en algunas distribuciones
```

#### 2.2. Acceder a MySQL
```bash
mysql -u root -p
# Si es la primera vez y no tienes contraseña, solo presiona Enter
```

#### 2.3. Crear la base de datos (Opción A - Desde MySQL)
```sql
CREATE DATABASE gastos_personales CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gastos_personales;
SOURCE /home/pablog/git/pablogodoy/gastos-personales/scripts/schema.sql;
EXIT;
```

#### 2.3. Crear la base de datos (Opción B - Desde línea de comandos)
```bash
cd /home/pablog/git/pablogodoy/gastos-personales
mysql -u root -p < scripts/schema.sql
```

### Paso 3: Configurar Credenciales de Base de Datos

Edita el archivo `config/database.php`:

```bash
nano config/database.php
```

Ajusta estas líneas según tu configuración:

```php
define('DB_HOST', 'localhost');     // Servidor MySQL
define('DB_NAME', 'gastos_personales'); // Nombre de la BD
define('DB_USER', 'root');          // Tu usuario MySQL
define('DB_PASS', '');              // Tu contraseña MySQL
```

**IMPORTANTE:** Si tu usuario MySQL tiene contraseña, agrégala en `DB_PASS`.

### Paso 4: Verificar la Instalación

Ejecuta el script de prueba:

```bash
cd /home/pablog/git/pablogodoy/gastos-personales
php scripts/test_conexion.php
```

Este script verificará:
- ✅ Conexión al servidor MySQL
- ✅ Existencia de la base de datos
- ✅ Tablas creadas correctamente
- ✅ Datos de prueba cargados

Si todo está correcto, verás:
```
=== TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE ===
```

### Paso 5: Iniciar el Servidor

#### Opción A: Servidor PHP Built-in (Recomendado para desarrollo)
```bash
cd /home/pablog/git/pablogodoy/gastos-personales
php -S localhost:8000
```

Luego abre en tu navegador: `http://localhost:8000`

#### Opción B: Apache

1. Copia el proyecto a `/var/www/html/`:
```bash
sudo cp -r /home/pablog/git/pablogodoy/gastos-personales /var/www/html/
```

2. Configura permisos:
```bash
sudo chown -R www-data:www-data /var/www/html/gastos-personales
sudo chmod -R 755 /var/www/html/gastos-personales
```

3. Accede a: `http://localhost/gastos-personales`

#### Opción C: Nginx

1. Crea un archivo de configuración:
```bash
sudo nano /etc/nginx/sites-available/gastos-personales
```

2. Agrega esta configuración:
```nginx
server {
    listen 8000;
    server_name localhost;
    root /home/pablog/git/pablogodoy/gastos-personales;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php7.4-fpm.sock;
    }
}
```

3. Habilita el sitio:
```bash
sudo ln -s /etc/nginx/sites-available/gastos-personales /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

## 🔍 Solución de Problemas

### Error: "Error de conexión: Unexpected token 'E'"

**Causa:** La API está devolviendo un error de PHP en lugar de JSON.

**Soluciones:**

1. **La base de datos no existe:**
   ```bash
   mysql -u root -p < scripts/schema.sql
   ```

2. **Credenciales incorrectas:**
   - Verifica `config/database.php`
   - Asegúrate de que el usuario y contraseña sean correctos

3. **MySQL no está ejecutándose:**
   ```bash
   sudo systemctl start mysql
   ```

4. **Ver errores en la API:**
   - Abre `http://localhost:8000/api/gastos_api.php?mes=12&anio=2025`
   - Verás el error real que está ocurriendo

### Error: "Connection refused"

**Causa:** El servidor PHP no está ejecutándose.

**Solución:**
```bash
cd /home/pablog/git/pablogodoy/gastos-personales
php -S localhost:8000
```

### Error: "Access denied for user"

**Causa:** Usuario o contraseña incorrecta en MySQL.

**Solución:**

1. Accede a MySQL:
   ```bash
   mysql -u root -p
   ```

2. Crea un nuevo usuario (opcional):
   ```sql
   CREATE USER 'gastos_user'@'localhost' IDENTIFIED BY 'tu_contraseña';
   GRANT ALL PRIVILEGES ON gastos_personales.* TO 'gastos_user'@'localhost';
   FLUSH PRIVILEGES;
   EXIT;
   ```

3. Actualiza `config/database.php` con el nuevo usuario.

### Error: "Table doesn't exist"

**Causa:** Las tablas no se crearon correctamente.

**Solución:**
```bash
mysql -u root -p gastos_personales < scripts/schema.sql
```

### No aparecen datos en el sistema

**Causa:** Los conceptos no se insertaron.

**Solución:**

1. Verifica que existan:
   ```bash
   mysql -u root -p -e "SELECT COUNT(*) FROM gastos_personales.conceptos;"
   ```

2. Si es 0, ejecuta nuevamente:
   ```bash
   mysql -u root -p gastos_personales < scripts/schema.sql
   ```

## 📱 Acceso desde el Celular

Para acceder desde tu celular en la misma red WiFi:

1. Obtén la IP de tu computadora:
   ```bash
   ip addr show | grep "inet " | grep -v 127.0.0.1
   ```
   Ejemplo: `192.168.1.100`

2. Inicia el servidor permitiendo conexiones externas:
   ```bash
   php -S 0.0.0.0:8000
   ```

3. En tu celular, abre el navegador y accede a:
   ```
   http://192.168.1.100:8000
   ```
   (Reemplaza con tu IP real)

## ✅ Verificación Final

Una vez que todo esté instalado, deberías ver:

1. **Pantalla principal** con:
   - Selector de mes/año
   - Cards de resumen (Ingresos, Gastos, Saldo)
   - Tabla de ingresos con 4 conceptos
   - Tabla de gastos con 24 conceptos

2. **Puedes editar** cualquier importe haciendo clic en el campo

3. **Al guardar** verás:
   - Una notificación toast "✓ Guardado correctamente"
   - Los totales se actualizan automáticamente

## 📚 Comandos Útiles

```bash
# Ver logs de PHP (si hay errores)
php -S localhost:8000 2>&1 | tee server.log

# Ver logs de MySQL
sudo tail -f /var/log/mysql/error.log

# Hacer backup de la base de datos
mysqldump -u root -p gastos_personales > backup.sql

# Restaurar backup
mysql -u root -p gastos_personales < backup.sql

# Reiniciar MySQL
sudo systemctl restart mysql

# Ver base de datos
mysql -u root -p gastos_personales -e "SHOW TABLES;"
```

## 🎯 Próximos Pasos

Una vez instalado correctamente:

1. Selecciona el mes actual
2. Ingresa tus importes de ingresos y gastos
3. El sistema calculará automáticamente tu saldo
4. Repite para cada mes que desees registrar

¡Listo! Ya tienes tu sistema de gastos personales funcionando.
