const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

// Inicializa o Express e o Socket.IO
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",  // Permitir acesso de qualquer origem
  },
});

// Middleware
app.use(cors());
app.use(express.json());  // Para permitir JSON no body das requisições

// Simulação de um "banco de dados" de horários
let horariosDisponiveis = {
  '2024-11-10': ['09:00', '10:00', '14:00'],
  '2024-11-11': ['08:00', '09:00', '11:00'],
};

// Função para verificar disponibilidade
const verificarDisponibilidade = (data, hora) => {
  if (horariosDisponiveis[data]) {
    return horariosDisponiveis[data].includes(hora);
  }
  return false;
};

// Rota para verificar disponibilidade de horário
app.post('/verificar-disponibilidade', async (req, res) => {
  const { data, hora } = req.body;

  try {
    const query = 'SELECT * FROM agendamentos WHERE data = $1 AND hora = $2 AND status = $3';
    const values = [data, hora, 'disponivel'];

    const result = await pool.query(query, values);

    if (result.rows.length > 0) {
      res.json({ disponivel: true, message: 'Horário disponível!' });
    } else {
      res.json({ disponivel: false, message: 'Horário indisponível.' });
    }
  } catch (error) {
    console.error('Erro ao verificar disponibilidade:', error);
    res.status(500).json({ message: 'Erro interno ao verificar disponibilidade.' });
  }
});

// Rota para confirmar agendamento
app.post('/confirmar-agendamento', async (req, res) => {
  const { data, hora, cliente } = req.body;

  try {
    // Verificar se o horário está disponível
    const verificarQuery = 'SELECT * FROM agendamentos WHERE data = $1 AND hora = $2 AND status = $3';
    const verificarValues = [data, hora, 'disponivel'];
    const result = await pool.query(verificarQuery, verificarValues);

    if (result.rows.length > 0) {
      // Atualizar o horário para "reservado" e associar ao cliente
      const atualizarQuery = 'UPDATE agendamentos SET status = $1, cliente = $2 WHERE data = $3 AND hora = $4';
      const atualizarValues = ['reservado', cliente, data, hora];
      await pool.query(atualizarQuery, atualizarValues);

      // Emitir o evento de confirmação para todos os clientes conectados via WebSocket
      io.emit('agendamento-confirmado', { data, hora, cliente });

      res.json({ sucesso: true, message: 'Agendamento confirmado!' });
    } else {
      res.status(400).json({ sucesso: false, message: 'Horário já reservado.' });
    }
  } catch (error) {
    console.error('Erro ao confirmar agendamento:', error);
    res.status(500).json({ message: 'Erro interno ao confirmar agendamento.' });
  }
});

// WebSocket: Conexão e notificações em tempo real
io.on('connection', (socket) => {
  console.log('Novo cliente conectado:', socket.id);

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });

  socket.on('agendamento-confirmado', (data) => {
    console.log("mensagem: " + data);
  });
    
});

// Servidor na porta 3000
server.listen(3000, () => {
  console.log('API rodando em http://localhost:3000');
});

const { Pool } = require('pg');

// Configuração da conexão com o banco de dados PostgreSQL
const pool = new Pool({
  user: 'postgres',        // Usuário do PostgreSQL
  host: 'localhost',          // Host do banco de dados
  database: 'salaobeleza',    // Nome do banco de dados
  password: 'admin',      // Senha do PostgreSQL
  port: 5432,                 // Porta padrão do PostgreSQL
});
