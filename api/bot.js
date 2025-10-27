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
      return res.json({ status: 'Bot activo', timestamp: new Date().toISOString() });
    }

    if (req.method === 'POST') {
      const update = req.body;
      
      if (!update.message || !update.message.text) return res.json({ ok: true });

      const message = update.message;
      const chatId = message.chat.id;
      const userText = message.text.trim();
      const userId = message.from.id;

      let userState = userStates.get(userId) || { paso: 'inicio' };
      let respuesta = '';

      if (userText === '/start') {
        userState.paso = 'esperando_correo';
        userStates.set(userId, userState);
        respuesta = "Hola 😊 dame tu correo para conocerte mejor:";
      }
      else if (userState.paso === 'esperando_correo') {
        if (isValidEmail(userText)) {
          userState.correo = userText;
          userState.paso = 'esperando_opcion';
          userStates.set(userId, userState);
          respuesta = "✅ Gracias. Elige una opción:\n\n1. Dime sobre DUA - ¿qué aprenderemos hoy?\n2. Cursos en línea";
        } else {
          respuesta = "❌ Correo inválido. Intenta de nuevo:";
        }
      }
      else if (userState.paso === 'esperando_opcion') {
        if (userText.includes('1')) {
          userState.paso = 'esperando_pregunta';
          userStates.set(userId, userState);
          respuesta = "🌍 Escribe tu pregunta sobre DUA:";
        } else if (userText.includes('2')) {
          respuesta = "🎓 Aprende con Declic en línea:\nhttps://declic.mx/\n\n💳 Pagos seguros con Mercado Pago:\nhttps://mpago.li/2qvgknv";
        } else {
          respuesta = "Elige:\n1. Dime sobre DUA - ¿qué aprenderemos hoy?\n2. Cursos en línea";
        }
      }
      else if (userState.paso === 'esperando_pregunta') {
        const resultado = await buscarEnBaseDeDatos(userText);
        respuesta = resultado;
        userState.paso = 'esperando_opcion';
        userStates.set(userId, userState);
      }

      await enviarTelegram(chatId, respuesta);
      return res.json({ ok: true });
    }

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

async function buscarEnBaseDeDatos(pregunta) {
  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'buscar_respuesta',
        pregunta: pregunta.toLowerCase()
      })
    });
    
    const data = await response.json();
    
    if (data.encontrado && data.respuesta) {
      return data.respuesta;
    } else {
      return "🤔 No encontré información en la base de datos. Prueba con: variabilidad, DUA, barreras, inclusión";
    }
    
  } catch (error) {
    return "🔧 Error conectando con la base de datos. Intenta más tarde.";
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function enviarTelegram(chatId, texto) {
  const params = new URLSearchParams();
  params.append('chat_id', chatId);
  params.append('text', texto);
  
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    body: params,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
}
