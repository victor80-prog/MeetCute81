const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const pool = require('./config/db');

const setupWebSocket = (server) => {
  const wss = new WebSocket.Server({ server });

  const clients = new Map();

  wss.on('connection', (ws) => {
    const clientId = uuidv4();
    clients.set(clientId, ws);

    ws.on('message', async (message) => {
      try {
        const { type, data, token } = JSON.parse(message);

        if (type === 'authenticate') {
          // Verify JWT and associate WS connection with user
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const user = await pool.query('SELECT id FROM users WHERE id = $1', [decoded.id]);
          
          if (user.rows.length) {
            clients.set(user.rows[0].id, ws);
            clients.delete(clientId);
          }
        }

        if (type === 'message') {
          const { recipientId, content } = data;
          
          // Save to database
          await pool.query(
            `INSERT INTO messages (sender_id, recipient_id, content)
             VALUES ($1, $2, $3)`,
            [data.senderId, recipientId, content]
          );

          // Forward to recipient if online
          if (clients.has(recipientId)) {
            clients.get(recipientId).send(JSON.stringify({
              type: 'message',
              data: {
                senderId: data.senderId,
                content,
                timestamp: new Date().toISOString()
              }
            }));
          }
        }
      } catch (err) {
        console.error('WebSocket error:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
    });
  });

  return wss;
};

module.exports = setupWebSocket;