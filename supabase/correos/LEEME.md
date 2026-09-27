# Correos de MisFinanzas en español

Supabase envía los correos de registro, recuperación de contraseña, etc. Sus textos **no están en el
código de la app**: se configuran en el panel de Supabase. Estos archivos son las plantillas en español
listas para pegar.

## Cómo aplicarlas

1. En tu proyecto de Supabase, entra a **Authentication → Emails** y abre la pestaña **Templates**.
2. Por cada plantilla de la tabla:
   1. Elígela en la lista (por ejemplo, **Confirm signup**).
   2. En **Subject**, pega el asunto de la tabla.
   3. En **Body** (vista *Source*), borra todo y pega el contenido completo del archivo `.html`.
   4. Pulsa **Save**.

| Plantilla en Supabase | Asunto | Archivo |
|---|---|---|
| Confirm signup | `Confirma tu cuenta de MisFinanzas` | `1-confirmar-registro.html` |
| Invite user | `Te invitaron a MisFinanzas` | `2-invitacion.html` |
| Magic link | `Tu enlace para entrar a MisFinanzas` | `3-enlace-magico.html` |
| Change email address | `Confirma tu nuevo correo en MisFinanzas` | `4-cambiar-correo.html` |
| Reset password | `Crea una nueva contraseña de MisFinanzas` | `5-restablecer-contrasena.html` |
| Reauthentication | `Tu código de verificación de MisFinanzas` | `6-reautenticacion.html` |

Las que usa la app hoy son **Confirm signup** y **Reset password**; las demás conviene traducirlas igual
por si se usan más adelante.

## No cambies lo que va entre llaves

`{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}`, `{{ .Token }}` y `{{ .Data.nombre }}` los
reemplaza Supabase por el enlace, el correo, el código o el nombre de la persona. Puedes cambiar
cualquier texto alrededor, pero no esas expresiones.

## El remitente

Los correos salen desde el servidor de pruebas de Supabase: el remitente aparece como *Supabase Auth*
y solo permite enviar unos pocos correos por hora. Para publicar la app conviene configurar un servidor
de correo propio en **Authentication → Emails → SMTP Settings** (por ejemplo Resend o Brevo, que tienen
plan gratuito). Ahí también puedes poner **MisFinanzas** como nombre del remitente.
