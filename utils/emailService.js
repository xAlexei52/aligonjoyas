const nodemailer = require('nodemailer');
require('dotenv').config();

// Configurar el transportador de nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true', // true para 465, false para otros puertos
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});


// Función para enviar email de reset de password
const sendPasswordResetEmail = async (email, resetToken, userName) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
  
  const mailOptions = {
    from: {
      name: 'Aligon Joyas',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: 'Restablecimiento de Contraseña - Aligon Joyas',
    html: `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Restablecer Contraseña</title>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
          }
          .content {
            padding: 40px 30px;
          }
          .content h2 {
            color: #333;
            margin-bottom: 20px;
          }
          .reset-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
            transition: transform 0.2s;
          }
          .reset-button:hover {
            transform: translateY(-2px);
          }
          .info-box {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 5px;
            padding: 15px;
            margin: 20px 0;
          }
          .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
          .warning {
            color: #dc3545;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Aligon Joyas</h1>
          </div>
          
          <div class="content">
            <h2>Hola ${userName || 'Usuario'},</h2>
            
            <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en Aligon Joyas.</p>
            
            <p>Si has solicitado este cambio, haz clic en el siguiente botón para restablecer tu contraseña:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="reset-button">
                🔑 Restablecer Contraseña
              </a>
            </div>
            
            <div class="info-box">
              <p><strong>📋 Información importante:</strong></p>
              <ul>
                <li>Este enlace es válido por <strong>1 hora</strong></li>
                <li>Solo puedes usar este enlace una vez</li>
                <li>Si no solicitaste este cambio, puedes ignorar este email</li>
              </ul>
            </div>
            
            <p>Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px;">
              ${resetUrl}
            </p>
            
            <p class="warning">⚠️ Si no solicitaste este cambio, te recomendamos que cambies tu contraseña inmediatamente para mantener tu cuenta segura.</p>
            
            <p>¡Gracias por usar Aligon Joyas!</p>
          </div>
          
          <div class="footer">
            <p>© 2024 Aligon Joyas. Todos los derechos reservados.</p>
            <p>Este es un email automático, por favor no respondas a este mensaje.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Hola ${userName || 'Usuario'},
      
      Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en Aligon Joyas.
      
      Si has solicitado este cambio, visita el siguiente enlace para restablecer tu contraseña:
      ${resetUrl}
      
      Este enlace es válido por 1 hora y solo puedes usarlo una vez.
      
      Si no solicitaste este cambio, puedes ignorar este email.
      
      ¡Gracias por usar Aligon Joyas!
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email de reset enviado:', info.messageId);
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('❌ Error enviando email:', error);
    throw new Error('Error enviando el email de recuperación');
  }
};

// Función para enviar email de confirmación cuando el password fue cambiado
const sendPasswordChangeConfirmation = async (email, userName) => {
  const mailOptions = {
    from: {
      name: 'Aligon Joyas',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: 'Contraseña Cambiada Exitosamente - Aligon Joyas',
    html: `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Contraseña Cambiada</title>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
          }
          .content {
            padding: 40px 30px;
          }
          .success-icon {
            text-align: center;
            font-size: 48px;
            margin: 20px 0;
          }
          .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Aligon Joyas</h1>
          </div>
          
          <div class="content">
            <div class="success-icon">🎉</div>
            
            <h2>¡Contraseña Cambiada Exitosamente!</h2>
            
            <p>Hola ${userName || 'Usuario'},</p>
            
            <p>Te confirmamos que la contraseña de tu cuenta en Aligon Joyas ha sido cambiada exitosamente.</p>
            
            <p><strong>Detalles del cambio:</strong></p>
            <ul>
              <li>📅 Fecha: ${new Date().toLocaleString('es-ES')}</li>
              <li>📧 Email: ${email}</li>
            </ul>
            
            <p>Si no realizaste este cambio, por favor contacta con nuestro equipo de soporte inmediatamente.</p>
            
            <p>¡Gracias por mantener tu cuenta segura!</p>
          </div>
          
          <div class="footer">
            <p>© 2024 Aligon Joyas. Todos los derechos reservados.</p>
            <p>Este es un email automático, por favor no respondas a este mensaje.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      ¡Contraseña Cambiada Exitosamente!
      
      Hola ${userName || 'Usuario'},
      
      Te confirmamos que la contraseña de tu cuenta en Aligon Joyas ha sido cambiada exitosamente.
      
      Fecha: ${new Date().toLocaleString('es-ES')}
      Email: ${email}
      
      Si no realizaste este cambio, por favor contacta con nuestro equipo de soporte.
      
      ¡Gracias por mantener tu cuenta segura!
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email de confirmación enviado:', info.messageId);
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('❌ Error enviando email de confirmación:', error);
    throw new Error('Error enviando el email de confirmación');
  }
};

// Función para enviar email con cupón de descuento
const sendCouponEmail = async (email, coupon, userName, orderTotal) => {
  const mailOptions = {
    from: {
      name: 'Aligon Joyas',
      address: process.env.EMAIL_USER
    },
    to: email,
    subject: `🎉 ¡Has ganado un cupón de ${coupon.discountValue}% de descuento!`,
    html: `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>¡Cupón de Descuento!</title>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background: white;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #ff6b6b 0%, #feca57 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
          }
          .content {
            padding: 40px 30px;
          }
          .coupon-box {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            margin: 20px 0;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
          }
          .coupon-code {
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 3px;
            background: rgba(255,255,255,0.2);
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
            border: 2px dashed rgba(255,255,255,0.5);
          }
          .discount-badge {
            background: #ff6b6b;
            color: white;
            padding: 10px 20px;
            border-radius: 50px;
            font-size: 24px;
            font-weight: bold;
            display: inline-block;
            margin: 10px 0;
          }
          .info-box {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 5px;
            padding: 20px;
            margin: 20px 0;
          }
          .highlight {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
          }
          .footer {
            background: #f8f9fa;
            padding: 20px;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
          .expiry-warning {
            color: #e74c3c;
            font-weight: bold;
            font-size: 18px;
          }
          .celebration {
            font-size: 48px;
            text-align: center;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 ¡Felicidades!</h1>
            <p>Has ganado un cupón de descuento</p>
          </div>
          
          <div class="content">
            <div class="celebration">🎊 🛍️ 🎊</div>
            
            <h2>¡Hola ${userName || 'Cliente'}!</h2>
            
            <p>¡Gracias por tu compra de <strong>${orderTotal}</strong>! Como agradecimiento, te hemos otorgado un cupón especial:</p>
            
            <div class="coupon-box">
              <div class="discount-badge">${coupon.discountValue}% OFF</div>
              <p style="margin: 10px 0; font-size: 18px;">${coupon.description || 'Descuento especial para ti'}</p>
              <div class="coupon-code">${coupon.code}</div>
              <p style="margin: 5px 0; font-size: 14px; opacity: 0.9;">Copia este código para usar tu descuento</p>
            </div>
            
            <div class="info-box">
              <h3>📋 Detalles del cupón:</h3>
              <ul>
                <li><strong>Descuento:</strong> ${coupon.discountValue}% en tu próxima compra</li>
                <li><strong>Descuento máximo:</strong> ${coupon.maxDiscount || 'Sin límite'}</li>
                <li><strong>Válido hasta:</strong> ${new Date(coupon.expiresAt).toLocaleDateString('es-ES', {
                  weekday: 'long',
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric'
                })}</li>
                <li><strong>Usos:</strong> Una sola vez</li>
              </ul>
            </div>
            
            <div class="highlight">
              <p class="expiry-warning">⏰ ¡No olvides usarlo! Este cupón expira en 10 días</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <p><strong>¿Cómo usar tu cupón?</strong></p>
              <ol style="text-align: left; display: inline-block;">
                <li>Añade productos a tu carrito</li>
                <li>En el checkout, ingresa el código: <strong>${coupon.code}</strong></li>
                <li>¡Disfruta tu descuento!</li>
              </ol>
            </div>
            
            <p>¡Esperamos verte pronto para que puedas aprovechar este increíble descuento!</p>
            
            <p>¡Felices compras! 🛒✨</p>
          </div>
          
          <div class="footer">
            <p>© 2024 Aligon Joyas. Todos los derechos reservados.</p>
            <p>Este cupón es personal e intransferible.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      ¡Felicidades ${userName || 'Cliente'}!
      
      Gracias por tu compra de ${orderTotal}. Has ganado un cupón de descuento:
      
      CÓDIGO: ${coupon.code}
      DESCUENTO: ${coupon.discountValue}%
      VÁLIDO HASTA: ${new Date(coupon.expiresAt).toLocaleDateString('es-ES')}
      
      ${coupon.description || 'Descuento especial para ti'}
      
      ¡No olvides usar tu cupón antes de que expire!
      
      ¡Gracias por elegirnos!
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email de cupón enviado:', info.messageId);
    return {
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('❌ Error enviando email de cupón:', error);
    throw new Error('Error enviando el email con el cupón');
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendPasswordChangeConfirmation,
  sendCouponEmail
};