const { URLSearchParams } = require('url');

// Configuración
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const API_URL = "https://script.google.com/macros/s/AKfycbwoF_SPaxIfBfhuwQ0dWnf57GxHxgoMJUushxMmJ37DJIVPLyXSwFPRV1kG8J_Xjtm0Ig/exec";
const MAX_ESTUDIANTES = 600;
const DIAS_PURGA = 10;

// Cache de estudiantes
const userStates = new Map();

// ... (funciones de purga se mantienen igual)

module.exports = async (req, res) => {
  console.log('🟢 Vercel endpoint llamado, método:', req.method);
  
  // Configurar CORS
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
      console.log('📦 Body:', JSON.stringify(req.body));
      
      // VERIFICAR QUE HAY BODY
      if (!req.body) {
        console.log('❌ req.body es undefined');
        return res.json({ ok: false, error: 'No body received' });
      }

      const update = req.body;
      console.log('📨 Update:', JSON.stringify(update));
      
      if (!update.message || !update.message.text) {
        console.log('❌ No message or text in update');
        return res.json({ ok: true });
      }

      const message = update.message;
      const chatId = message.chat.id;
      const userText = message.text.trim();
      const userId = message.from.id;

      console.log(`👤 Usuario ${userId}: "${userText}"`);

      // ... (el resto del flujo se mantiene igual)
      // PERO VERIFICA QUE callAPI ESTÉ BIEN:

      // DEBE SER EXACTAMENTE ASÍ:
      const resultado = await callAPI("buscar_respuesta", {
        pregunta: userText
      });

      // ... resto del código
    }

  } catch (error) {
    console.error('💥 Error en Vercel:', error);
    return res.status(500).json({ error: error.message });
  }
};

// ... (funciones auxiliares se mantienen igual)
