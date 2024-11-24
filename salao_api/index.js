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


// Rota para verificar disponibilidade de horário
app.post('/verificar-disponibilidade', (req, res) => {
  const { data, hora } = req.body;

  try {
    const query = 'SELECT * FROM agendamentos WHERE data = ? AND hora = ? AND status = ?';
    const result = db.prepare(query).get(data, hora, 'disponivel');

    if (!result) {
      res.json({ disponivel: false, message: 'Horário não existe.' });
    } else if (result.status === 'reservado') {
      res.json({ disponivel: false, message: 'Horário já reservado.' });
    } else {
      res.json({ disponivel: true, message: 'Horário disponível!' });
    }    
  } catch (error) {
    console.error('Erro ao verificar disponibilidade:', error);
    res.status(500).json({ message: 'Erro interno ao verificar disponibilidade.' });
  }
});


// Rota para confirmar agendamento
app.post('/confirmar-agendamento', (req, res) => {
  const { cliente, email, telefone, data, hora, servicos, dataEspecial, mensagem } = req.body;

  if (!data || !hora || !cliente) {
    return res.status(400).json({ sucesso: false, message: 'Campos obrigatórios ausentes.' });
  }

  try {
    const verificarQuery = 'SELECT * FROM agendamentos WHERE data = ? AND hora = ?';
    const horarioDisponivel = db.prepare(verificarQuery).get(data, hora);

    if (!horarioDisponivel) {
      return res.status(400).json({ sucesso: false, message: 'Horário não encontrado no banco.' });
    }

    if (horarioDisponivel.status === 'reservado') {
      return res.status(400).json({ sucesso: false, message: 'Horário já reservado.' });
    }

    const atualizarQuery = 'UPDATE agendamentos SET status = ?, cliente = ?, email = ?, telefone = ?, servicos = ?, dataEspecial = ?, mensagem = ? WHERE data = ? AND hora = ?';
    db.prepare(atualizarQuery).run('reservado', cliente, email, telefone, servicos.join(', '), dataEspecial, mensagem, data, hora);

    io.emit('agendamento-confirmado', { cliente, data, hora });
    res.json({ sucesso: true, message: 'Agendamento confirmado com sucesso!' });
  } catch (error) {
    console.error('Erro ao confirmar agendamento:', error);
    res.status(500).json({ sucesso: false, message: 'Erro interno no servidor.' });
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
  console.log('API rodando em https:localhost:3000');
});

const sqlite3 = require('better-sqlite3'); // Importa a biblioteca SQLite

// Inicializa o banco de dados SQLite
try {
  db = new sqlite3('./database.sqlite', { verbose: console.log });
  console.log('Banco de dados inicializado com sucesso.');
} catch (error) {
  console.error('Erro ao inicializar o banco de dados:', error);
  process.exit(1); // Encerre o servidor se o banco não for carregado corretamente
}

// Criar tabela (caso ainda não exista)
db.exec(`
  CREATE TABLE IF NOT EXISTS agendamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente TEXT,
    email TEXT,
    telefone TEXT,
    data TEXT NOT NULL,
    hora TEXT NOT NULL,
    servicos TEXT,
    dataEspecial TEXT,
    mensagem TEXT,
    status TEXT DEFAULT 'disponivel'
  );
`);
