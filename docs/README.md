# Sistema de Gastos Personales

Sistema web para gestionar ingresos y gastos mensuales de forma simple y responsive.

## 🚀 Características

- ✅ Gestión de ingresos y gastos mensuales
- ✅ Diseño responsive (mobile-first) con Bootstrap 5
- ✅ Cálculo automático de totales y saldo
- ✅ Edición inline de importes con guardado automático
- ✅ Selector de mes/año
- ✅ API REST con PHP y MySQL
- ✅ Interfaz moderna con paleta de colores personalizada
- ✅ Iconos Bootstrap Icons contextuales para cada concepto
- ✅ Feedback visual al guardar (toasts, animaciones)
- ✅ Indicador de saldo positivo/negativo con iconos dinámicos

## 📋 Requisitos

- PHP 7.4 o superior
- MySQL 5.7 o superior
- Servidor web (Apache/Nginx)

## 🛠️ Instalación

### 1. Crear la base de datos

```bash
mysql -u root -p < scripts/schema.sql
```

O ejecutar manualmente el contenido de `scripts/schema.sql` en tu gestor de MySQL.

### 2. Configurar la conexión a la base de datos

Editar el archivo `config/database.php` y ajustar las credenciales:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'gastos_personales');
define('DB_USER', 'tu_usuario');
define('DB_PASS', 'tu_password');
```

### 3. Configurar el servidor web

**Opción A: Servidor PHP integrado (desarrollo)**
```bash
cd /home/pablog/git/pablogodoy/gastos-personales
php -S localhost:8000
```

**Opción B: Apache/Nginx**
- Configurar el DocumentRoot apuntando a la carpeta del proyecto
- Asegurarse de que mod_rewrite esté habilitado (Apache)

### 4. Acceder a la aplicación

Abrir en el navegador: `http://localhost:8000` (o la URL configurada)

## 📁 Estructura del Proyecto

```
gastos-personales/
├── api/
│   └── gastos_api.php          # API REST para operaciones CRUD
├── assets/
│   ├── css/
│   │   └── styles.css          # Estilos responsive
│   └── js/
│       └── app.js              # Lógica de frontend
├── config/
│   └── database.php            # Configuración de base de datos
├── includes/                    # Archivos PHP auxiliares (futuro)
├── index.html                   # Página principal
├── schema.sql                   # Script de creación de BD
└── README.md                    # Este archivo
```

## 🎯 Uso

1. **Seleccionar mes y año**: Usar los selectores en la parte superior
2. **Ingresar importes**: Hacer clic en los campos de importe y escribir el valor
3. **Guardar**: Los cambios se guardan automáticamente al salir del campo (blur) o presionar Enter
4. **Ver resumen**: El resumen se actualiza automáticamente con totales y saldo

## 🔧 Conceptos Preconfigurados

### Ingresos
- Sueldo HSC
- Sueldo TCER
- IPEM
- Ahorro

### Gastos
- Cuota Alimentaria, Rowing, Mastercard, Alquiler Departamento
- Supermercado, YouTube, Spotify, Elena
- ATER Etios, ATER Tornado, Enersa
- Rivadavia Etios, Rivadavia Tornado, Redengas
- Personal Flow (Int.&C), Monotributo Afip
- Roy Udrizar, Coprocier, Nafta
- Aire Acondicionado, Remedios, Cochera
- Gimnasio, Gastos

## 🎨 Características Responsive

- **Mobile (< 640px)**: Vista de tarjetas apiladas
- **Tablet (640px - 768px)**: Grid de 3 columnas en resumen
- **Desktop (> 768px)**: Vista completa optimizada

## 🔄 API Endpoints

### GET `/api/gastos_api.php?mes={mes}&anio={anio}`
Obtiene todos los conceptos con sus importes del mes/año especificado.

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "mes": 12,
    "anio": 2025,
    "conceptos": [...],
    "resumen": {
      "total_ingresos": 3621141.00,
      "total_gastos": 1561571.58,
      "saldo": 2059569.42
    }
  }
}
```

### POST `/api/gastos_api.php`
Guarda o actualiza un registro.

**Body:**
```json
{
  "concepto_id": 1,
  "mes": 12,
  "anio": 2025,
  "importe": 485000.00,
  "observaciones": "Opcional"
}
```

### DELETE `/api/gastos_api.php`
Elimina un registro.

**Body:**
```json
{
  "registro_id": 123
}
```

## 🚧 Mejoras Futuras

- [ ] Agregar gráficos de evolución mensual
- [ ] Exportar a Excel/PDF
- [ ] Categorías personalizables
- [ ] Comparativa entre meses
- [ ] Sistema de alertas por gastos excesivos
- [ ] Autenticación de usuarios
- [ ] Historial de cambios

## 📝 Notas

- Los importes se guardan automáticamente al cambiar de campo
- El sistema usa formato de moneda argentino (ARS)
- Todos los conceptos están precargados y se pueden modificar desde la BD

## 👤 Autor

Pablo Godoy - Diciembre 2025
