# Spike 0007: acceso a datos (Kysely, Drizzle y `pg` a secas)

- Estado: plan (los criterios se fijan antes de programar; los resultados se anotan al final)
- Fecha: 2026-11-27
- Alimenta: ADR-0007 (acceso a datos, migraciones y dónde corren)

## Pregunta

¿Con qué se habla a Postgres desde la API de coachlink? Opciones: SQL a mano con `pg` (línea base), Kysely con migraciones en SQL, y Drizzle. Prisma se descarta de entrada por el peso en la imagen y por el poco control sobre las consultas de sincronización; el ADR lo recoge como alternativa descartada.

## Por qué importa en este proyecto

La sincronización offline-first es un problema de datos: dos dispositivos pueden modificar lo mismo, un reintento no debe duplicar una operación y lo que llega tarde debe ordenarse bien. Lo que se busca es poder ver y controlar esas consultas, no que la herramienta las esconda.

## Caso de prueba común

Idéntico para las tres opciones, sobre la rama `dev` de Neon.

Tabla `workout_logs`:

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | `uuid` | clave primaria |
| `client_id` | `uuid` | sin clave foránea en el spike |
| `device_op_id` | `uuid` | identifica la operación del dispositivo; único junto con `client_id` |
| `exercise` | `text` | |
| `reps` | `integer` | |
| `weight_kg` | `numeric(6,2)` | |
| `performed_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | lo fija la base de datos, no el cliente |
| `deleted_at` | `timestamptz` | nulo si no está borrado (borrado lógico) |

Dos operaciones:

1. **Insertar de forma idempotente.** Reintentar la misma operación (mismo `client_id` y `device_op_id`) no duplica la fila y devuelve la existente.
2. **Traer los cambios desde un cursor** para un cliente, incluidos los borrados lógicos. El cursor es el par (`updated_at`, `id`), no solo `updated_at`: dos filas con la misma marca de tiempo no deben perderse. Devuelve un máximo de N filas y el cursor siguiente.

Fuera de alcance del spike: resolución de conflictos de edición, autenticación, relaciones con entrenadores y el caso de una fila confirmada tarde con un `updated_at` anterior al cursor (se anota como riesgo para el ADR, no se resuelve aquí).

## Criterios y cómo se miden

Umbrales iniciales, a ajustar si la medición demuestra que están mal puestos.

| Criterio | Cómo se mide | Éxito |
| --- | --- | --- |
| Legibilidad de la consulta de sincronización | Líneas de código de la consulta y valoración de 1 a 5 del autor, anotada antes de ver las otras opciones | Se entiende a la primera lectura (4 o más) |
| Seguridad de tipos | Renombrar una columna en la migración y ejecutar el typecheck | El typecheck falla en el código que usa el nombre antiguo |
| Migración | Escribirla o generarla, aplicarla dos veces y revertirla | Es reversible y la segunda aplicación no falla ni duplica |
| Prueba contra Postgres real | Una prueba de integración de las dos operaciones, en local y en CI con un contenedor de Postgres | Pasa en ambos y el tiempo de CI se anota |
| Peso y arranque | Mismo método que ADR-0006 (base: imagen de 357 MB y arranque mediano de 787 ms) | No más de +10 MB ni +100 ms sobre la base |

## Regla de decisión

Se fija ahora, antes de ver resultados. Orden de prioridad: primero el control sobre el SQL de sincronización (legibilidad), después la seguridad de tipos, después las migraciones, y por último la prueba en CI y el peso. Si dos opciones empatan en lo primero, se decide por lo siguiente, y así sucesivamente. Si ninguna cumple el criterio de migración, se descarta la opción que no pueda revertirlas.

## Reglas del spike

- Una rama por opción (`spike/pg`, `spike/kysely`, `spike/drizzle`), que **no se mergea**. El ADR conserva los resultados; el código se borra.
- Tope de **2 horas** por opción. Al llegar al tope se anota hasta dónde se llegó, aunque no esté terminado: que algo se atasque es un resultado.
- Las pruebas locales usan la rama `dev` de Neon; nunca la de producción.
- Supuesto a verificar: en CI se usa un contenedor de Postgres y no Neon, para no depender de secretos ni de la red.

## Resultados

Se rellena durante el spike. Una columna por opción.

| Criterio | `pg` | Kysely | Drizzle |
| --- | --- | --- | --- |
| Legibilidad (líneas y nota) | | | |
| Seguridad de tipos | | | |
| Migración | | | |
| Prueba contra Postgres real | | | |
| Peso y arranque | | | |
| Tiempo usado | | | |
| Dónde se atascó | | | |

## Conclusión

Se escribe al final y se traslada a ADR-0007.
