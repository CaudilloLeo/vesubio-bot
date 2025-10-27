const { URLSearchParams } = require('url');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8399414595:AAFNfrB6xtdTOYDpfufq_w_Y_T7J4EGPlGw";
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
      if (!update.message || !update.message.text) return res.json({ ok: true });

      const message = update.message;
      const chatId = message.chat.id;
      const userText = message.text.trim();
      const userId = message.from.id;

      let userState = userStates.get(userId) || { 
        correoRegistrado: false, 
        opcionElegida: null 
      };

      let respuesta = "";

      // 1. /start → Pedir correo
      if (userText === '/start') {
        userState.correoRegistrado = false;
        userState.opcionElegida = null;
        userStates.set(userId, userState);
        respuesta = "¡Hola! Soy Vesubio 🌋\n\n📧 Por favor escribe tu correo electrónico:";
      }
      // 2. Esperando correo
      else if (!userState.correoRegistrado) {
        if (isValidEmail(userText)) {
          userState.correoRegistrado = true;
          userStates.set(userId, userState);
          respuesta = "✅ Correo recibido\n\nElige una opción:\n\n1. Buscar respuesta DUA\n2. Cursos en línea";
        } else {
          respuesta = "❌ Por favor escribe un correo válido:";
        }
      }
      // 3. Esperando opción
      else if (!userState.opcionElegida) {
        if (userText === '1') {
          userState.opcionElegida = 'consulta';
          userStates.set(userId, userState);
          respuesta = "🌋 Escribe tu pregunta sobre DUA:";
        } else if (userText === '2') {
          respuesta = "🎓 Cursos en línea:\n\nhttps://declic.mx/\n\n💳 Pago seguro:\nhttps://mpago.li/2qvgknv";
        } else {
          respuesta = "Elige una opción:\n\n1. Buscar respuesta DUA\n2. Cursos en línea";
        }
      }
      // 4. Buscar en Google Sheets
      else if (userState.opcionElegida === 'consulta') {
        const resultado = await buscarEnSheets(userText);
        respuesta = resultado;
        userState.opcionElegida = null;
        userStates.set(userId, userState);
      }

      await sendToTelegram(chatId, respuesta);
      return res.json({ ok: true });
    }

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};

// BUSCAR EN GOOGLE SHEETS
async function buscarEnSheets(pregunta) {
  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'buscar_respuesta',
        pregunta: pregunta
      })
    });
    
    const data = await response.json();
    
    if (data.encontrado && data.respuesta) {
      return data.respuesta;
    } else {
      return "🤔 No encontré información. Intenta con: variabilidad, DUA, barreras, inclusión, evaluación.";
    }
    
  } catch (error) {
    return "🔧 Error accediendo a la base de conocimiento.";
  }
}

function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

async function sendToTelegram(chatId, text) {
  const params = new URLSearchParams();
  params.append('chat_id', chatId);
  params.append('text', text);
  
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    body: params,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}
