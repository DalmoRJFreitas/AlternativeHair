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
app.post('/verificar-disponibilidade', (req, res) => {
  const { data, hora } = req.body;
  
  const disponivel = verificarDisponibilidade(data, hora);
  
  if (disponivel) {
    res.json({ disponivel: true, message: 'Horário disponível!' });
  } else {
    res.json({ disponivel: false, message: 'Horário indisponível.' });
  }
});

// Rota para confirmar agendamento
app.post('/confirmar-agendamento', (req, res) => {
  const { data, hora, cliente } = req.body;

  if (verificarDisponibilidade(data, hora)) {
    // Remove o horário do array, simulando a reserva
    horariosDisponiveis[data] = horariosDisponiveis[data].filter(h => h !== hora);
    
    // Emitir o evento de confirmação para todos os clientes conectados via WebSocket
    io.emit('agendamento-confirmado', { data, hora, cliente });
    
    res.json({ sucesso: true, message: 'Agendamento confirmado!' });
  } else {
    res.status(400).json({ sucesso: false, message: 'Horário já reservado.' });
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
