# Spike 0007: acceso a datos (Kysely, Drizzle y `pg` a secas)

- Estado: completado (decisión: Kysely; ver Conclusión)
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

Una columna por opción. El código de cada rama se conserva en las etiquetas `spike-pg`, `spike-kysely` y `spike-drizzle`; las ramas no se mergearon.

| Criterio | `pg` | Kysely | Drizzle |
| --- | --- | --- | --- |
| Legibilidad (líneas y nota) | 188 líneas (127 operaciones + 42 runner + 19 SQL). Nota 4 | 128 líneas (70 operaciones + 22 tipos + 12 migrador + 24 migración). Nota 4 | 139 líneas (80 operaciones + 35 esquema + 8 configuración + 16 SQL generado). Nota 4 |
| Seguridad de tipos | No cumple: el renombre pasa el typecheck y falla al ejecutar | No cumple el criterio tal como está escrito: el tipo `Database` se escribe a mano, así que un renombre en la migración no rompe el typecheck. Sí protege el builder (una columna mal escrita falla al compilar y sugiere el nombre), pero no el `sql` crudo | Cumple: el esquema genera la migración y los tipos; un renombre rompe el typecheck, también dentro del `sql` crudo |
| Migración | Cumple: runner propio de 42 líneas (aplicar dos veces, `down`, reaplicar) | Cumple: Migrator incluido con `up` y `down`; se aplica dos veces sin daño y se revierte | Parcial: genera el SQL y lo aplica dos veces sin daño; no tiene `down`, la reversa es SQL escrito a mano más borrar su registro de control |
| Prueba contra Postgres real | Cumple en local: 4,5 s contra Neon `dev`, 217 ms en contenedor. CI sin probar | Cumple en contenedor. CI sin probar | Cumple en contenedor. CI sin probar |
| Peso y arranque | Sin cambio: ya es la base | +4 MB (362 frente a 358 MB); arranque sin diferencia apreciable | +22 MB (380 frente a 358 MB): no cumple; arranque sin diferencia apreciable |
| Tiempo usado | Unos 30 min de trabajo (50 de reloj) | Unos 57 min | Unos 43 min |
| Dónde se atascó | Nada propio de `pg`; unos 20 min en nombres y ubicación de archivos. Aviso de `sslmode` de `pg` v9; `numeric` llega como texto | La ruta de importación de `Migrator` cambió a `kysely/migration` (unos 15 min) | Biome rechaza los JSON que genera; su configuración queda fuera del `tsconfig`; la versión estable es la 0.45 y la 1.0 (con cambios incompatibles) está en camino |

Notas de medición:

- El arranque se midió con 7 corridas alternadas contra una imagen `base` reconstruida el mismo día. Con 3 muestras la dispersión (hasta 1,2 s) era mayor que cualquier diferencia entre opciones. Las medianas de las tres opciones quedaron dentro de ±100 ms de la base.
- El tiempo es de reloj activo: hubo una pausa de unas 3 horas a mitad del spike de Kysely que no se cuenta.
- Los experimentos de tipos probaron una columna mal escrita en el código (builder y `sql` crudo). El criterio, tal como está escrito, es renombrar en la migración; por eso Kysely cuenta como no cumplido aunque su builder sí detecte errores de escritura.
- Un resultado inicial de Drizzle ("el typecheck pasa") resultó ser un cambio sin guardar; se repitió comprobando el `git diff` antes del `typecheck`.

## Conclusión

**Decisión: Kysely**, con `pg` como driver y las migraciones en SQL explícito.

Aplicada al pie de la letra, la regla de decisión fijada antes del spike habría dado **Drizzle**: la legibilidad empata (las tres cumplen con nota 4) y en el siguiente criterio, la seguridad de tipos, solo Drizzle cumple. Se elige Kysely cambiando el orden de prioridades **después** de ver los resultados: se pone por encima de la seguridad de tipos que las migraciones y el SQL sean directos y sin fricción. Se anota como desviación consciente de la regla y no como resultado de aplicarla.

Lo que respalda la elección en los datos: Kysely trae un Migrator con `up` y `down` (Drizzle no tiene reversa), es la opción con menos código (128 líneas), pesa +4 MB frente a +22 MB y no obliga a cambiar la configuración de Biome ni del `tsconfig`.

Riesgo aceptado: el tipo `Database` se escribe a mano y puede desalinearse de la tabla real, y un renombre de columna en una migración no lo detecta el compilador. Mitigaciones: pruebas de integración contra Postgres real en CI (en el spike detectaron el renombre al ejecutar) y, si el desalineamiento duele, evaluar un generador de tipos desde la base de datos (por ejemplo `kysely-codegen`).

Queda sin resolver, para el ADR-0007: dónde se ejecutan las migraciones (el Pre-Deploy de Render es de pago), la prueba con contenedor de Postgres dentro de CI (solo se probó en local) y el riesgo ya anotado de la fila confirmada tarde con un `updated_at` anterior al cursor.
