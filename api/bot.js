const { URLSearchParams } = require('url');

// Configuración
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8399414595:AAFNfrB6xtdTOYDpfufq_w_Y_T7J4EGPlGw";
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || "1K8d-W95fDyEhBhariUZeZL21Pq2ZYNzSoXq7ipvz_WQ";

// Base de conocimiento
const BASE_CONOCIMIENTO = {
  "variabilidad": "La variabilidad son las diferencias naturales en cómo cada cerebro aprende. No es lo mismo que diversidad (diferencias entre grupos).",
  "dua": "DUA = Diseño Universal para el Aprendizaje. Tres principios: 1) Múltiples formas de representación 2) Múltiples formas de acción/expresión 3) Múltiples formas de motivación.",
  "bap": "BAP = Barreras para el Aprendizaje y Participación. Son obstáculos en el CONTEXTO, no en el estudiante.",
  "inclusión": "La inclusión educativa asegura que TODOS participen plenamente, no solo estén físicamente presentes.",
  "evaluación": "Evaluar en DUA significa ofrecer múltiples formas de demostrar lo aprendido."
};

// Estados de usuario
const userStates = new Map();

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Si es GET, mostrar que el bot está activo
    if (req.method === 'GET') {
      return res.json({
        status: 'Vesubio Bot activo 🔥',
        timestamp: new Date().toISOString()
      });
    }

    // Si es POST, procesar webhook de Telegram
    if (req.method === 'POST') {
      const update = req.body;
      
      // Verificar que sea un mensaje válido
      if (!update.message || !update.message.text) {
        return res.json({ ok: true });
      }

      const message = update.message;
      const chatId = message.chat.id;
      const userText = message.text.toLowerCase().trim();
      const userId = message.from.id;

      // Obtener estado del usuario
      let userState = userStates.get(userId) || { 
        correoRegistrado: false, 
        opcionElegida: null, 
        correo: "" 
      };

      let respuesta = "¡Hola! Soy Vesubio, tu asistente educativo 🔥\n\n📧 Para comenzar, necesito tu correo electrónico:";

      // FLUJO DE CONVERSACIÓN
      if (!userState.correoRegistrado) {
        if (isValidEmail(userText)) {
          userState.correo = userText;
          userState.correoRegistrado = true;
          userStates.set(userId, userState);
          respuesta = "✅ ¡Gracias! Ahora elige:\n\n[1] 🤔 Hacer consulta educativa\n[2] 🎓 Ver cursos en línea";
        } else if (userText === '/start') {
          respuesta = "¡Hola! Soy Vesubio, tu asistente educativo 🔥\n\n📧 Para comenzar, necesito tu correo electrónico:";
        } else {
          respuesta = "📧 Por favor ingresa un correo electrónico válido:";
        }
      } else if (!userState.opcionElegida) {
        if (userText.includes('1') || userText.includes('consulta')) {
          userState.opcionElegida = 'consulta';
          userStates.set(userId, userState);
          respuesta = "🤔 Escribe tu pregunta sobre DUA:";
        } else if (userText.includes('2') || userText.includes('curso')) {
          respuesta = "🔥 Explora nuestros cursos:\nhttps://declic.mx/cursos-y-talleres/\n\n💳 ¡Hola! 👋\nTe regalo $100 de descuento para Mercado Pago:\nhttps://mpago.li/2qvgknv";
        } else {
          respuesta = "✅ Elige:\n\n[1] 🤔 Hacer consulta educativa\n[2] 🎓 Ver cursos en línea";
        }
      } else if (userState.opcionElegida === 'consulta') {
        const resultado = buscarRespuesta(userText);
        respuesta = resultado.respuesta;
        userState.opcionElegida = null;
        userStates.set(userId, userState);
      }

      // Enviar respuesta a Telegram
      await sendToTelegram(chatId, respuesta);
      return res.json({ ok: true });
    }

    return res.status(404).json({ error: 'Ruta no encontrada' });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Buscar respuesta
function buscarRespuesta(pregunta) {
  const preguntaLower = pregunta.toLowerCase();
  
  for (const [keyword, respuesta] of Object.entries(BASE_CONOCIMIENTO)) {
    if (preguntaLower.includes(keyword)) {
      return { respuesta, tema: keyword };
    }
  }
  
  return {
    respuesta: "🤔 No encontré respuesta. Pregunta sobre: variabilidad, DUA, BAP, inclusión, evaluación?",
    tema: "sin_coincidencia"
  };
}

// Validar email
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Enviar mensaje a Telegram
async function sendToTelegram(chatId, text) {
  try {
    const params = new URLSearchParams();
    params.append('chat_id', chatId);
    params.append('text', text);
    
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      body: params,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    return await response.json();
  } catch (error) {
    console.error('Error enviando a Telegram:', error);
    throw error;
  }
}
