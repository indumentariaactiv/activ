import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { SmtpClient } from "https://deno.land/x/smtp/mod.ts"

// Estas variables las guardarás en Supabase de forma segura
const SMTP_USERNAME = Deno.env.get('SMTP_USERNAME') // Ej: tu-correo@gmail.com
const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD') // Ej: Contraseña de Aplicación de Google

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejo de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    const record = payload.record // El pedido actualizado

    if (record.status !== 'confirmed') {
      return new Response(JSON.stringify({ message: "El pedido no está confirmado, omitiendo." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    if (!SMTP_USERNAME || !SMTP_PASSWORD) {
      throw new Error("Faltan configurar SMTP_USERNAME o SMTP_PASSWORD")
    }

    // IMPORTANTE: Pon aquí el correo de la persona que debe recibir la notificación
    const DESTINATARIO = "produccion@altiv.com" 

    const client = new SmtpClient()

    // Conectamos al servidor de Gmail
    await client.connectTLS({
      hostname: "smtp.gmail.com",
      port: 465,
      username: SMTP_USERNAME,
      password: SMTP_PASSWORD,
    })

    const subjectText = `NUEVO PEDIDO CONFIRMADO: ${record.name || 'Pedido sin nombre'}`
    const htmlBody = `
      <div style="font-family: sans-serif; max-w-[600px]; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0052cc; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; text-transform: uppercase;">¡Nuevo Pedido Recibido!</h1>
        </div>
        <div style="padding: 24px;">
          <p style="font-size: 16px; color: #333;">Hola equipo de Producción,</p>
          <p style="font-size: 16px; color: #333;">Un cliente acaba de confirmar un nuevo pedido en la plataforma de <strong>ALTIV</strong>.</p>
          
          <div style="background-color: #f5f5f5; padding: 16px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0;"><strong>Nombre del pedido:</strong> <span style="font-size: 18px;">${record.name || 'Sin nombre'}</span></p>
            <p style="margin: 0;"><strong>ID del Sistema:</strong> <span style="color: #666;">${record.id}</span></p>
          </div>

          <p style="font-size: 16px; color: #333;">Ingresa a la plataforma para ver la ficha técnica completa.</p>
          
          <div style="text-align: center; margin-top: 30px;">
            <a href="https://altiv.com/admin/pedido/${record.id}" style="background-color: #0052cc; color: white; text-decoration: none; padding: 12px 24px; border-radius: 4px; font-weight: bold; display: inline-block;">Ver Pedido en el Sistema</a>
          </div>
        </div>
      </div>
    `

    // Enviamos el correo
    await client.send({
      from: SMTP_USERNAME,
      to: DESTINATARIO,
      subject: subjectText,
      content: "Un cliente acaba de confirmar un pedido. Ingresa al sistema para revisarlo.",
      html: htmlBody,
    })

    await client.close()

    return new Response(JSON.stringify({ success: true, message: "Correo enviado correctamente por SMTP" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })

  } catch (error: any) {
    console.error("Error en Edge Function SMTP:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
