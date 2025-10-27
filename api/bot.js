const { URLSearchParams } = require('url');

// Configuración
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const API_URL = "https://script.google.com/macros/s/AKfycbwoF_SPaxIfBfhuwQ0dWnf57GxHxgoMJUushxMmJ37DJIVPLyXSwFPRV1kG8J_Xjtm0Ig/exec";
const MAX_ESTUDIANTES = 600;
const DIAS_PURGA = 10;

// Cache de estudiantes
const userStates = new Map();

// FUNCIÓN DE PURGA QUE FALTABA
function purgarEstudiantesInactivos() {
  const ahora = Date.now();
  const diezDias = DIAS_PURGA * 24 * 60 * 60 * 1000;
  let eliminados = 0;

  const estudiantesOrdenados = Array.from(userStates.entries())
    .sort((a, b) => a[1].ultimaConexion - b[1].ultimaConexion);

  for (const [userId, userState] of estudiantesOrdenados) {
    const tiempoInactivo = ahora - userState.ultimaConexion;
    
    if (tiempoInactivo > diezDias || userStates.size > MAX_ESTUDIANTES) {
      userStates.delete(userId);
      eliminados++;
      if (userStates.size <= MAX_ESTUDIANTES * 0.9) break;
    }
  }

  console.log(`🧹 Purga: ${eliminados} eliminados, ${userStates.size} activos`);
  return eliminados;
}

function puedeAceptarNuevoEstudiante() {
  purgarEstudiantesInactivos();
  return userStates.size < MAX_ESTUDIANTES;
}

// FUNCIÓN PARA BUSCAR EN SPREADSHEET
async function buscarRespuestaEnSpreadsheet(pregunta) {
  try {
    console.log(`🔍 Buscando en spreadsheet: "${pregunta}"`);
    
    const respuesta = await callAPI("buscar_respuesta", {
      pregunta: pregunta
    });
    
    console.log("📨 Respuesta de API:", JSON.stringify(respuesta));
    
    if (respuesta.success && respuesta.respuesta) {
      return {
        respuesta: respuesta.respuesta,
        tema: respuesta.tema || "encontrado",
        encontrado: true
      };
    } else {
      return {
        respuesta: "🤔 No encontré una respuesta específica. ¿Podrías reformular tu pregunta?",
        tema: "sin_coincidencia", 
        encontrado: false
      };
    }
  } catch (error) {
    console.error("❌ Error buscando en spreadsheet:", error);
    return {
      respuesta: "⚠️ Error temporal al buscar la respuesta.",
      tema: "error",
      encontrado: false
    };
  }
}

module.exports = async (req, res) => {
  console.log('🟢 Vercel endpoint llamado, método:', req.method);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log('🔸 OPTIONS request');
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      console.log('🔸 GET request');
      const purgaEjecutada = purgarEstudiantesInactivos();
      return res.json({
        status: 'Vesubio Bot activo 🔥',
        estudiantes_activos: userStates.size,
        limite_estudiantes: MAX_ESTUDIANTES,
        purga_cada_dias: DIAS_PURGA,
        purga_ejecutada: purgaEjecutada,
        timestamp: new Date().toISOString()
      });
    }

    if (req.method === 'POST') {
      console.log('🔸 POST request recibido');
      
      if (!req.body) {
        console.log('❌ req.body es undefined');
        return res.json({ ok: false, error: 'No body received' });
      }

      const update = req.body;
      console.log('📨 Update recibido de Telegram');
      
      if (!update.message || !update.message.text) {
        console.log('❌ No message or text in update');
        return res.json({ ok: true });
      }

      const message = update.message;
      const chatId = message.chat.id;
      const userText = message.text.trim();
      const userId = message.from.id;

      console.log(`👤 Usuario ${userId}: "${userText}"`);

      // Verificar límite
      if (!userStates.has(userId) && !puedeAceptarNuevoEstudiante()) {
        console.log('🚫 Límite de estudiantes alcanzado');
        await sendToTelegram(chatId, 
          "🚫 Hemos alcanzado el límite de estudiantes activos.\n\n" +
          "Por favor intenta en unos días cuando haya cupos disponibles."
        );
        return res.json({ ok: true });
      }

      let userState = userStates.get(userId) || { 
        correoRegistrado: false, 
        opcionElegida: null, 
        correo: "",
        ultimaConexion: Date.now(),
        totalConsultas: 0
      };

      userState.ultimaConexion = Date.now();
      let respuesta = "¡Hola! Soy Vesubio, tu asistente educativo 🔥\n\n📧 Para comenzar, necesito tu correo electrónico:";

      // FLUJO DE CONVERSACIÓN
      if (!userState.correoRegistrado) {
        if (isValidEmail(userText)) {
          userState.correo = userText;
          userState.correoRegistrado = true;
          userStates.set(userId, userState);
          
          console.log(`✅ Estudiante registrado: ${userText}`);
          await callAPI("registrar_estudiante", {
            correo: userText,
            telegramId: userId.toString()
          });
          
          respuesta = "✅ ¡Gracias! Ahora elige:\n\n[1] 🤔 Hacer consulta educativa\n[2] 🎓 Ver cursos en línea";
        } else if (userText === '/start') {
          respuesta = "¡Hola! Soy Vesubio, tu asistente educativo 🔥\n\n📧 Para comenzar, necesito tu correo electrónico:";
        } else {
          respuesta = "📧 Por favor ingresa un correo electrónico válido:";
        }
      } else if (!userState.opcionElegida) {
        if (userText.includes('1') || userText.toLowerCase().includes('consulta')) {
          userState.opcionElegida = 'consulta';
          userStates.set(userId, userState);
          respuesta = "🤔 Escribe tu pregunta sobre DUA:";
        } else if (userText.includes('2') || userText.toLowerCase().includes('curso')) {
          respuesta = "🔥 Explora nuestros cursos:\nhttps://declic.mx/cursos-y-talleres/\n\n💳 ¡Hola! 👋\nTe regalo $100 de descuento para Mercado Pago:\nhttps://mpago.li/2qvgknv";
        } else {
          respuesta = "✅ Elige:\n\n[1] 🤔 Hacer consulta educativa\n[2] 🎓 Ver cursos en línea";
        }
      } else if (userState.opcionElegida === 'consulta') {
        userState.totalConsultas++;
        
        console.log(`🔍 Procesando consulta: "${userText}"`);
        
        // BUSCAR EN SPREADSHEET
        const resultado = await buscarRespuestaEnSpreadsheet(userText);
        respuesta = resultado.respuesta;
        
        console.log(`📝 Resultado: ${resultado.encontrado ? 'ENCONTRADO' : 'NO ENCONTRADO'}`);
        
        // Registrar estadísticas
        await callAPI("registrar_estadistica", {
          tema: resultado.tema,
          subtema: "consulta",
          encontrado: resultado.encontrado
        });
        
        userState.opcionElegida = null;
        userStates.set(userId, userState);
      }

      console.log(`📤 Enviando respuesta: ${respuesta.substring(0, 50)}...`);
      await sendToTelegram(chatId, respuesta);
      return res.json({ ok: true });
    }

    return res.status(404).json({ error: 'Ruta no encontrada' });

  } catch (error) {
    console.error('💥 Error en Vercel:', error);
    return res.status(500).json({ error: error.message });
  }
};

// FUNCIONES AUXILIARES
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

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

async function callAPI(action, data) {
  try {
    console.log(`📞 Llamando API: ${action}`, data);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: action,
        ...data
      }),
    });
    
    const result = await response.json();
    console.log(`✅ API ${action} respuesta:`, result);
    return result;
  } catch (error) {
    console.error(`❌ Error en API ${action}:`, error);
    return { success: false, error: error.message };
  }
}
