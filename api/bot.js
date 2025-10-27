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
        respuesta = "Escribe tu correo electrónico:";
      }
