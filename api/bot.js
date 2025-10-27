const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || "8496263047:AAG1lPzxj_zUiZqJIYyoyGAJJwcgduQNctA";
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwJ0-7dLJfeNBUOYyBiO-IaOjl_zp6mD1B7R92erfmxbGW06c6Dr0VO5nvFr2Ed8BB8/exec';

// Base de conocimiento de respaldo INMEDIATA
const BASE_CONOCIMIENTO = {
  "variabilidad": "🌋 **Variabilidad**: Diferencias naturales en cómo cada cerebro aprende. No es lo mismo que diversidad.",
  "dua": "🎯 **DUA**: Diseño Universal para el Aprendizaje. 3 principios: Representación, Acción/Expresión, Motivación.",
  "barreras": "🚧 **Barreras (BAP)**: Obstáculos en el CONTEXTO, no en el estudiante.",
  "inclusión": "🌈 **Inclusión**: Participación plena de TODOS los estudiantes.",
  "evaluación": "📊 **Evaluación DUA**: Múltiples formas de demostrar aprendizaje."
};

const userStates = new Map();

module.exports = async (req, res) => {
  // Configuración CORS básica
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Endpoint de estado
    if (req.method === 'GET') {
      return res.json({
        status: 'Vesubio Bot activo 🔥',
        estudiantes: Array.from(userStates.keys()).length,
        timestamp: new Date().toISOString()
      });
    }

    // Webhook de Telegram
    if (req.method === 'POST') {
      const update = req.body;
      
      // Debug en producción
      console.log('📨 UPDATE:', JSON.stringify(update).substring(0, 200));

      if (!update.message || !update.message.text) {
        return res.json({ ok: true });
      }

      const message = update.message;
      const chatId = message.chat.id;
      const userText = message.text.trim();
      const userId = message.from.id;

      let userState = userStates.get(userId) || { 
        paso: 'inicio',
        correo: '' 
      };

      let respuesta = '';

      // FLUJO SIMPLIFICADO
      if (userText === '/start') {
        userState.paso = 'esperando_correo';
        userStates.set(userId, userState);
        respuesta = "¡Hola! Soy Vesubio 🌋\n\n📧 Escribe tu correo electrónico:";
      }
      else if (userState.paso === 'esperando_correo') {
        if (isValidEmail(userText)) {
          userState.correo = userText;
          userState.paso = 'esperando_opcion';
          userStates.set(userId, userState);
          respuesta = `✅ Correo: ${userText}\n\nElige:\n1. 🔍 Buscar en DUA\n2. 🎓 Cursos`;
        } else {
          respuesta = "❌ Correo inválido. Intenta de nuevo:";
        }
      }
      else if (userState.paso === 'esperando_opcion') {
        if (userText.includes('1') || userText.toLowerCase().includes('buscar')) {
          userState.paso = 'esperando_pregunta';
          userStates.set(userId, userState);
          respuesta = "🌋 Escribe tu pregunta sobre DUA:";
        } else {
          respuesta = "🎓 Cursos: https://declic.mx/\n\nEscribe /start para buscar en DUA";
        }
      }
      else if (userState.paso === 'esperando_pregunta') {
        // BUSCAR RESPUESTA INMEDIATA
        const resultado = await buscarRespuesta(userText);
        respuesta = resultado;
        userState.paso = 'esperando_opcion';
        userStates.set(userId, userState);
      }

      // Enviar respuesta
      await enviarTelegram(chatId, respuesta);
      return res.json({ ok: true });
    }

  } catch (error) {
    console.error('❌ ERROR:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
};

// BUSCAR RESPUESTA - PRIORIDAD BASE LOCAL
async function buscarRespuesta(pregunta) {
  const preguntaLower = pregunta.toLowerCase();
  
  console.log(`🔍 Buscando: "${preguntaLower}"`);

  // 1. PRIMERO buscar en base local (instantáneo)
  for (const [clave, valor] of Object.entries(BASE_CONOCIMIENTO)) {
    if (preguntaLower.includes(clave)) {
      console.log(`✅ Encontrado local: ${clave}`);
      return `${valor}\n\n💡 ¿Otra pregunta? /start`;
    }
  }

  // 2. LUEGO intentar con Google Sheets (con timeout)
  try {
    console.log("🌐 Intentando con Google Sheets...");
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 seg timeout
    
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'buscar_respuesta',
        pregunta: preguntaLower
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (response.ok) {
      const data = await response.json();
      console.log("📊 Respuesta GAS:", data);
      
      if (data.encontrado && data.respuesta) {
        return `📚 ${data.respuesta}\n\n💡 ¿Otra pregunta? /start`;
      }
    }
  } catch (error) {
    console.log("❌ Error GAS:", error.message);
  }

  // 3. FALLBACK final
  return `🤔 No encontré sobre "${pregunta}"\n\nPrueba con: variabilidad, DUA, barreras, inclusión\n\n💡 Usa /start para nuevo menú`;
}

// FUNCIONES AUXILIARES
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function enviarTelegram(chatId, texto) {
  try {
    const params = new URLSearchParams();
    params.append('chat_id', chatId);
    params.append('text', texto);
    
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      body: params,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  } catch (error) {
    console.error('Error enviando a Telegram:', error);
  }
}
