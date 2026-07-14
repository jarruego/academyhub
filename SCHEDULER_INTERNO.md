# Scheduler Interno - Tareas Automáticas

## ¿Qué es?

Un sistema de **tareas programadas genérico** que corre dentro de tu app usando **expresiones cron tipo Unix** (con `node-cron`), sin necesidad de pagar por Cron Jobs externos o instancias adicionales en Render.

Puedes programar múltiples tareas con horarios específicos (importaciones, limpieza, backups, etc.) sin coste adicional.

## Ventajas

✅ **Gratis**: No requiere instancia adicional de Render  
✅ **Flexible**: Programación con expresiones cron (ejecutar a una hora específica)  
✅ **Simple**: Solo configuras variables de entorno  
✅ **Automático**: Se ejecuta al arrancar la app  
✅ **Extensible**: Añade nuevas tareas fácilmente  

## Desventajas

⚠️ **No escalar horizontalmente**: Si tienes múltiples instancias, todas ejecutarán el cron (duplicados)  
⚠️ **Depende del uptime**: Si la app se reinicia, el timer se reinicia también  

> **Recomendación**: Úsalo solo si tienes **1 instancia** de la app. Si escalas horizontalmente, usa Cron Jobs externos.

---

## Configuración

### 1. Variables de entorno

Añade a tu `.env` y a las variables de entorno de Render:

```env
# Activar scheduler interno (maestro)
ENABLE_CRON_SCHEDULER=true

# --- Tarea: Importación SAGE ---
SAGE_IMPORT_ENABLED=true
SAGE_IMPORT_CRON=30 5 * * *        # 5:30 AM todos los días

# Timezone (por defecto UTC en código; el repo usa Europe/Madrid = hora española)
SCHEDULER_TIMEZONE=Europe/Madrid
```

> **Importante (Render/producción):** las variables del panel de Render **tienen prioridad** sobre el `.env` y sobre el default del código. Para que la importación corra a las **5:30 hora española**, en _Render → tu servicio → Environment_ hay que fijar/actualizar `SAGE_IMPORT_CRON=30 5 * * *` y `SCHEDULER_TIMEZONE=Europe/Madrid` (además de `ENABLE_CRON_SCHEDULER=true` y `SAGE_IMPORT_ENABLED=true`), y **redesplegar**. La zona horaria afecta a **todas** las tareas: con `Europe/Madrid`, la sync de Moodle (`0 4 * * *`) pasa a las 4:00 hora española.

### 2. Configuración SFTP (obligatoria para importación SAGE)

```env
SFTP_SAGE_HOST=sftp.example.com
SFTP_SAGE_PORT=22
SFTP_SAGE_USER=tu_usuario
SFTP_SAGE_PASSWORD=tu_contraseña
SFTP_SAGE_PATH=/ruta/al/archivo.csv
```

---

## Expresiones Cron

Formato: `minuto hora día mes día_semana`

### Ejemplos comunes

```env
# 2:00 AM todos los días (importación diaria)
SAGE_IMPORT_CRON=0 2 * * *

# Cada 6 horas (0:00, 6:00, 12:00, 18:00)
SAGE_IMPORT_CRON=0 */6 * * *

# 3:00 AM de lunes a viernes (solo laborales)
# Nota: 1=lunes, 5=viernes
SAGE_IMPORT_CRON=0 3 * * 1-5

# 9:00 AM y 5:00 PM (dos veces al día)
SAGE_IMPORT_CRON=0 9,17 * * *

# Cada hora (solo para testing)
SAGE_IMPORT_CRON=0 * * * *

# Cada 30 minutos
SAGE_IMPORT_CRON=*/30 * * * *

# Cada lunes a las 2:00 AM
SAGE_IMPORT_CRON=0 2 * * 1
```

### Referencia completa

| Campo | Rango | Descripción |
|-------|-------|-------------|
| Minuto | 0-59 | Minuto de la hora |
| Hora | 0-23 | Hora del día (24h) |
| Día | 1-31 | Día del mes |
| Mes | 1-12 | Mes del año |
| Día semana | 0-6 | 0=domingo, 1=lunes, 6=sábado |

**Caracteres especiales:**
- `*` = cualquier valor
- `,` = múltiples valores (9,17)
- `-` = rango (1-5)
- `/` = cada N unidades (*/6 = cada 6)

---

## Timezone

Por defecto, el scheduler usa **UTC**. Si necesitas otra zona horaria:

```env
# Ejemplos de timezones
SCHEDULER_TIMEZONE=Europe/Madrid      # España
SCHEDULER_TIMEZONE=America/New_York   # Nueva York
SCHEDULER_TIMEZONE=Asia/Tokyo         # Tokio
SCHEDULER_TIMEZONE=Australia/Sydney   # Sídney
```

---

## Uso

### Activar

1. En Render, ve a tu servicio → **Environment**
2. Añade:
   ```env
   ENABLE_CRON_SCHEDULER=true
   SAGE_IMPORT_ENABLED=true
   SAGE_IMPORT_CRON=30 5 * * *
   SCHEDULER_TIMEZONE=Europe/Madrid
   ```
3. Redespliega la app

### Verificar en logs

Al arrancar la app, verás:

```
📅 Iniciando scheduler con expresiones cron...
📝 Tarea registrada: sage-import - Importación automática de usuarios SAGE desde SFTP
⏰ Programando: sage-import - Cron: "30 5 * * *"
✅ Scheduler iniciado con 1 tarea(s) activa(s)
```

Cuando se ejecute (a las 5:30 AM):

```
🔄 Iniciando: sage-import
📥 Descargando e importando CSV SAGE desde SFTP...
✅ Importación SAGE iniciada - Job ID: import_20260127_053000_abc
✅ Completado: sage-import
```

### Desactivar

Cambia la variable de entorno:

```env
ENABLE_CRON_SCHEDULER=false
```

O desactiva tareas individuales:

```env
SAGE_IMPORT_ENABLED=false
```

---

## Añadir nuevas tareas programadas

### Ejemplo: Limpieza automática de trabajos antiguos

#### 1. Crear el archivo de tarea

`server/src/scheduler/tasks/cleanup-jobs.task.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ScheduledTask } from '../interfaces/scheduled-task.interface';
import { JobService } from '../../api/import-sage/job.service';

@Injectable()
export class CleanupJobsTask implements ScheduledTask {
    private readonly logger = new Logger(CleanupJobsTask.name);

    name = 'cleanup-jobs';
    description = 'Limpieza automática de trabajos antiguos';

    constructor(private readonly jobService: JobService) {}

    get enabled(): boolean {
        return (process.env.CLEANUP_JOBS_ENABLED || 'false').toLowerCase() === 'true';
    }

    get cronExpression(): string {
        // 3:00 AM todos los días por defecto
        return process.env.CLEANUP_JOBS_CRON || '0 3 * * *';
    }

    get runOnStartup(): boolean {
        return false; // Las importaciones programadas nunca se ejecutan al arrancar
    }

    async execute(): Promise<void> {
        this.logger.log('🧹 Limpiando trabajos antiguos...');
        
        const days = Number(process.env.CLEANUP_JOBS_DAYS) || 30;
        const deleted = await this.jobService.cleanupOldJobs(days);
        
        this.logger.log(`✅ ${deleted} trabajos eliminados`);
    }
}
```

#### 2. Registrar en el módulo

`server/src/scheduler/scheduler.module.ts`:

```typescript
import { CleanupJobsTask } from './tasks/cleanup-jobs.task';

@Module({
    imports: [ImportModule],
    providers: [
        SchedulerService,
        SageImportTask,
        CleanupJobsTask, // 👈 Añadir aquí
        {
            provide: 'SCHEDULER_INIT',
            useFactory: (
                schedulerService: SchedulerService,
                sageImportTask: SageImportTask,
                cleanupJobsTask: CleanupJobsTask // 👈 Y aquí
            ) => {
                schedulerService.registerTask(sageImportTask);
                schedulerService.registerTask(cleanupJobsTask); // 👈 Y aquí
                return schedulerService;
            },
            inject: [SchedulerService, SageImportTask, CleanupJobsTask] // 👈 Y aquí
        }
    ],
    exports: [SchedulerService]
})
export class SchedulerModule {}
```

#### 3. Configurar variables de entorno

```env
CLEANUP_JOBS_ENABLED=true
CLEANUP_JOBS_CRON=0 3 * * *        # 3:00 AM todos los días
CLEANUP_JOBS_DAYS=30               # Eliminar trabajos de más de 30 días
```

---

## Testing

### Opción 1: Testing con cron cada minuto (para verificar rápidamente)

```env
ENABLE_CRON_SCHEDULER=true
SAGE_IMPORT_ENABLED=true
SAGE_IMPORT_CRON=* * * * *         # Cada minuto
```

Cámbialo después de verificar que funciona.

### Opción 2: Testing manual

Usa el endpoint de importación FTP directamente desde la UI:

1. Ve a **Herramientas** → **Importar Sage**
2. Pestaña **"Importar desde FTP"**
3. Click en **"Iniciar Importación"**

---

## Monitoreo

### En la app

1. Ve a **Herramientas** → **Importar Sage**
2. Pestaña **"Historial"**
3. Verás todos los trabajos de importación con su estado

### En Render

1. Dashboard → tu servicio → **Logs**
2. Busca mensajes con emojis:
   - 📅 Scheduler iniciado
   - 🔄 Iniciando tarea
   - ✅ Completado
   - ❌ Error en tarea

---

## Troubleshooting

### El scheduler no se activa

**Solución**: Verifica que `ENABLE_CRON_SCHEDULER` sea exactamente `"true"` (lowercase).

```bash
# Bien ✅
ENABLE_CRON_SCHEDULER=true

# Mal ❌
ENABLE_CRON_SCHEDULER=True
ENABLE_CRON_SCHEDULER=TRUE
ENABLE_CRON_SCHEDULER=1
```

### Una tarea específica no se ejecuta

**Solución 1**: Verifica que la tarea esté habilitada:

```env
SAGE_IMPORT_ENABLED=true
```

**Solución 2**: Valida la expresión cron. Revisa los logs para ver si hay error:

```
❌ Error configurando cron "0 2" para sage-import: ...
```

### La expresión cron es inválida

Las expresiones cron más comunes son válidas. Si tienes una personalizada, verifica:

```bash
# ❌ Malo (solo 2 campos)
SAGE_IMPORT_CRON=0 2

# ✅ Bueno (5 campos completos)
SAGE_IMPORT_CRON=0 2 * * *
```

### Las importaciones se duplican

**Problema**: Tienes múltiples instancias de la app corriendo.

**Solución**: El scheduler interno **solo funciona bien con 1 instancia**. Si necesitas escalar:

1. Desactiva el scheduler: `ENABLE_CRON_SCHEDULER=false`
2. Usa un cron externo (Render Cron Jobs u otro) configurado fuera de la app

---

## Arquitectura

```
server/src/
├── scheduler/
│   ├── scheduler.module.ts       # Módulo principal
│   ├── scheduler.service.ts      # Servicio genérico (usa node-cron)
│   ├── interfaces/
│   │   └── scheduled-task.interface.ts  # Interfaz para tareas
│   └── tasks/
│       ├── sage-import.task.ts   # Tarea de importación SAGE
│       └── [más tareas aquí...]  # Añade nuevas tareas aquí
```

Cada tarea es independiente y se puede habilitar/deshabilitar individualmente.

---

## Comparación: Interno vs Externo

| Característica | Scheduler Interno | Cron Job Externo |
|---------------|-------------------|------------------|
| **Coste** | Gratis | Requiere instancia adicional |
| **Configuración** | Variable de entorno (cron) | Crear Cron Job en Render |
| **Escalabilidad** | ❌ Solo 1 instancia | ✅ Múltiples instancias |
| **Disponibilidad** | Depende del uptime de la app | Independiente de la app |
| **Flexibilidad** | Muy flexible (cron expressions) | Flexible (cron expressions) |
| **Múltiples tareas** | ✅ Ilimitadas | ❌ Una instancia por tarea |
| **Hora específica** | ✅ Sí | ✅ Sí |

**Recomendación**:
- **Apps pequeñas (1 instancia)**: Scheduler interno ✅
- **Apps grandes (múltiples instancias)**: Cron Job externo ✅
