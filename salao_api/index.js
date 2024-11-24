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
app.post('/verificar-disponibilidade', (req, res) => {
    const { data, hora } = req.body;
  
    try {
      // Query para verificar se o horário já está reservado
      const verificarQuery = 'SELECT status FROM agendamentos WHERE data = ? AND hora = ?';
      const resultado = db.prepare(verificarQuery).get(data, hora);
  
      if (!resultado) {
        return res.json({ disponivel: false, message: 'Horário não está disponível ou não foi cadastrado.' });
      }
  
      if (resultado.status === 'disponivel') {
        res.json({ disponivel: true, message: 'Horário está disponível!' });
      } else {
        res.json({ disponivel: false, message: 'Horário já está reservado.' });
      }
    } catch (error) {
      console.error('Erro ao verificar disponibilidade:', error);
      res.status(500).json({ message: 'Erro interno ao verificar disponibilidade.' });
    }
  });

// Rota para verificar disponibilidade de horário
app.post('/verificar-disponibilidade', (req, res) => {
    const { data, hora } = req.body;
  
    try {
      const query = 'SELECT * FROM agendamentos WHERE data = ? AND hora = ? AND status = ?';
      const result = db.prepare(query).get(data, hora, 'disponivel');
  
      if (result) {
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
app.post('/confirmar-agendamento', (req, res) => {
    const { data, hora, cliente } = req.body;
  
    try {
      // Verificar disponibilidade
      const verificarQuery = 'SELECT * FROM agendamentos WHERE data = ? AND hora = ? AND status = ?';
      const horarioDisponivel = db.prepare(verificarQuery).get(data, hora, 'disponivel');
  
      if (horarioDisponivel) {
        // Atualizar o horário para reservado
        const atualizarQuery = 'UPDATE agendamentos SET status = ?, cliente = ? WHERE data = ? AND hora = ?';
        db.prepare(atualizarQuery).run('reservado', cliente, data, hora);
  
        // Emitir evento via WebSocket
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
});

// Servidor na porta 3000
server.listen(3000, () => {
  console.log('API rodando em http://localhost:3000');
});

const sqlite3 = require('better-sqlite3'); // Importa a biblioteca SQLite

// Inicializa o banco de dados SQLite
const db = new sqlite3('./database.sqlite', { verbose: console.log });

// Criar tabela (caso ainda não exista)
db.exec(`
  CREATE TABLE IF NOT EXISTS agendamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    Pname TEXT,
    Email TEXT,
    tel TEXT,
    data TEXT NOT NULL,
    hora TEXT NOT NULL,
    servicos TEXT,
    dataEspecial TEXT,
    mensagem TEXT,
    status TEXT DEFAULT 'disponivel'
  );
`);
