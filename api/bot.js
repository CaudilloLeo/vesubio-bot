const { URLSearchParams } = require('url');

// ✅ TOKEN CORREGIDO - Usando el NUEVO bot
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8496263047:AAG1lPzxj_zUiZqJIYyoyGAJJwcgduQNctA";
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwJ0-7dLJfeNBUOYyBiO-IaOjl_zp6mD1B7R92erfmxbGW06c6Dr0VO5nvFr2Ed8BB8/exec';

const userStates = new Map();

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      return res.json({
        status: 'Vesubio Bot activo 🔥',
        estudiantes_activos: Array.from(userStates.keys()).length,
        timestamp: new Date().toISOString()
      });
    }

    if (req.method === 'POST') {
      const update = req.body;
      
      // ✅ Manejar callback queries (botones)
      if (update.callback_query) {
        const callback = update.callback_query;
        const chatId = callback.message.chat.id;
        const userId = callback.from.id;
        const data = callback.data;
        
        let userState = userStates.get(userId) || { 
          correoRegistrado: false, 
          opcionElegida: null 
        };

        if (data === 'opcion_consulta') {
          userState.opcionElegida = 'consulta';
          userStates.set(userId, userState);
          await sendToTelegram(chatId, "🌋 Escribe tu pregunta sobre DUA:");
        } else if (data === 'opcion_cursos') {
          await sendToTelegram(chatId, "🎓 Cursos en línea:\n\nhttps://declic.mx/\n\n💳 Pago seguro:\nhttps://mpago.li/2qvgknv");
        }
        
        // Responder a callback
        await answerCallbackQuery(callback.id);
        return res.json({ ok: true });
      }

      // ✅ Manejar mensajes normales
      if (!update.message || !update.message.text) return res.json({ ok: true });

      const message = update.message;
      const chatId = message.chat.id;
      const userText = message.text.trim();
      const userId = message.from.id;

      let userState = userStates.get(userId) || { 
        correoRegistrado: false, 
        opcionElegida: null,
        correo: "" 
      };

      let respuesta = "";

      // 1. /start → Pedir correo
      if (userText === '/start') {
        userState.correoRegistrado = false;
        userState.opcionElegida = null;
        userState.correo = "";
        userStates.set(userId, userState);
        respuesta = "¡Hola! Soy Vesubio 🌋\n\n📧 Por favor escribe tu correo electrónico:";
      }
      // 2. Esperando correo
      else if (!userState.correoRegistrado) {
        if (isValidEmail(userText)) {
          userState.correo = userText;
          userState.correoRegistrado = true;
          userStates.set(userId, userState);
          
          // ✅ Enviar teclado inline con opciones
          await sendOptionsKeyboard(chatId, "✅ Correo registrado: " + userText + "\n\nElige una opción:");
          return res.json({ ok: true });
        } else {
          respuesta = "❌ Por favor escribe un correo válido:";
        }
      }
      // 3. Esperando opción (texto como fallback)
      else if (!userState.opcionElegida) {
        if (userText.includes('1') || userText.toLowerCase().includes('consulta')) {
          userState.opcionElegida = 'consulta';
          userStates.set(userId, userState);
          respuesta = "🌋 Escribe tu pregunta sobre DUA:";
        } else if (userText.includes('2') || userText.toLowerCase().includes('curso')) {
          respuesta = "🎓 Cursos en línea:\n\nhttps://declic.mx/\n\n💳 Pago seguro:\nhttps://mpago.li/2qvgknv";
        } else {
          // Reenviar opciones si no entiende
          await sendOptionsKeyboard(chatId, "Elige una opción:");
          return res.json({ ok: true });
        }
      }
      // 4. Buscar en Google Sheets
      else if (userState.opcionElegida === 'consulta') {
        respuesta = "🔍 Buscando en la base de conocimiento...";
        await sendToTelegram(chatId, respuesta);
        
        const resultado = await buscarEnSheets(userText);
        respuesta = resultado;
        userState.opcionElegida = null;
        userStates.set(userId, userState);
      }

      if (respuesta) {
        await sendToTelegram(chatId, respuesta);
      }
      return res.json({ ok: true });
    }

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};

// ✅ BUSCAR EN GOOGLE SHEETS (mejorado)
async function buscarEnSheets(pregunta) {
  try {
    console.log("Buscando:", pregunta);
    
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'buscar_respuesta',
        pregunta: pregunta.toLowerCase()
      })
    });
    
    const data = await response.json();
    console.log("Respuesta GAS:", data);
    
    if (data.encontrado && data.respuesta) {
      return `📚 **Encontrado:**\n\n${data.respuesta}\n\n¿Tienes otra pregunta? Escribe /start para comenzar de nuevo.`;
    } else {
      return "🤔 No encontré información sobre eso. Intenta con palabras como: variabilidad, DUA, barreras, inclusión, evaluación.\n\nEscribe /start para volver al menú.";
    }
    
  } catch (error) {
    console.error("Error GAS:", error);
    return "🔧 Error accediendo a la base de conocimiento. Intenta más tarde.\n\nEscribe /start para volver al menú.";
  }
}

// ✅ ENVIAR TECLADO CON OPCIONES
async function sendOptionsKeyboard(chatId, text) {
  const keyboard = {
    inline_keyboard: [
      [
        { 
          text: "🔍 Buscar respuesta DUA", 
          callback_data: "opcion_consulta" 
        }
      ],
      [
        { 
          text: "🎓 Ver cursos en línea", 
          callback_data: "opcion_cursos" 
        }
      ]
    ]
  };

  const params = new URLSearchParams();
  params.append('chat_id', chatId);
  params.append('text', text);
  params.append('reply_markup', JSON.stringify(keyboard));
  
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    body: params,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}

// ✅ RESPONDER A CALLBACK QUERIES
async function answerCallbackQuery(callbackId) {
  const params = new URLSearchParams();
  params.append('callback_query_id', callbackId);
  
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    body: params,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}

function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

async function sendToTelegram(chatId, text) {
  try {
    const params = new URLSearchParams();
    params.append('chat_id', chatId);
    params.append('text', text);
    params.append('parse_mode', 'Markdown');
    
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      body: params,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    
    return await response.json();
  } catch (error) {
    console.error('Error enviando mensaje:', error);
  }
}
