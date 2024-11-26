const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Inicializa o Express e o Socket.IO
const app = express();
const server = http.createServer(app);
const port = 3000;
const io = socketIo(server, {
  cors: {
    origin: "*",  // Permitir acesso de qualquer origem
  },
});

// Middleware
app.use(cors());
app.use(express.json());  // Para permitir JSON no body das requisições

// Configuração do Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API de Agendamento',
      version: '1.0.0',
      description: 'API para agendamentos de serviços.',
    },
    servers: [
      {
        url: 'http://localhost:3000',
      },
    ],
  },
  // Caminho dos arquivos que contêm as anotações do Swagger
  apis: ['./server.js'], // ou qualquer arquivo onde você tenha suas rotas
};

// Gera a documentação Swagger
const swaggerDocs = swaggerJsdoc(swaggerOptions);

// Rota para acessar a documentação Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));


// Servidor na porta 3000
server.listen(3000, () => {
  console.log('API rodando em http:localhost:3000');
  console.log('Acesse a documentação em http://localhost:3000/api-docs');
});

// Rota para verificar disponibilidade de horário
/**
 * @swagger
 * /verificar-disponibilidade:
 *   post:
 *     summary: Verificar se o horário está disponível.
 *     description: Verifica se um horário específico está disponível para agendamento.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: string
 *                 format: date
 *               hora:
 *                 type: string
 *                 format: time
 *     responses:
 *       200:
 *         description: Horário disponível ou não.
 *       400:
 *         description: Dados inválidos.
 *       500:
 *         description: Erro interno.
 */
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
/**
 * @swagger
 * /confirmar-agendamento:
 *   post:
 *     summary: Confirmar agendamento de serviço.
 *     description: Confirma o agendamento de um serviço para um horário específico.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cliente:
 *                 type: string
 *               email:
 *                 type: string
 *               telefone:
 *                 type: string
 *               data:
 *                 type: string
 *                 format: date
 *               hora:
 *                 type: string
 *                 format: time
 *               servicos:
 *                 type: array
 *                 items:
 *                   type: string
 *               dataEspecial:
 *                 type: string
 *               mensagem:
 *                 type: string
 *     responses:
 *       200:
 *         description: Agendamento confirmado com sucesso.
 *       400:
 *         description: Dados inválidos ou horário não disponível.
 *       500:
 *         description: Erro interno ao confirmar agendamento.
 */
app.post('/confirmar-agendamento', (req, res) => {
  const { cliente, email, telefone, data, hora, servicos, dataEspecial, mensagem } = req.body;

  if (!data || !hora || !cliente) {
    return res.status(400).json({ sucesso: false, message: 'Campos obrigatórios ausentes.' });
  }

  try {
    // Verificar se o horário está disponível
    const verificarQuery = 'SELECT * FROM agendamentos WHERE data = ? AND hora = ?';
    const horarioDisponivel = db.prepare(verificarQuery).get(data, hora);

    if (!horarioDisponivel) {
      return res.status(400).json({ sucesso: false, message: 'Horário não encontrado no banco.' });
    }

    if (horarioDisponivel.status === 'reservado') {
      return res.status(400).json({ sucesso: false, message: 'Horário já reservado.' });
    }

    // Atualizar agendamento
    const atualizarQuery = `
      UPDATE agendamentos 
      SET status = ?, cliente = ?, email = ?, telefone = ?, servicos = ?, dataEspecial = ?, mensagem = ? 
      WHERE data = ? AND hora = ?
    `;
    db.prepare(atualizarQuery).run(
      'reservado', 
      cliente, 
      email, 
      telefone, 
      servicos.join(', '), 
      dataEspecial, 
      mensagem, 
      data, 
      hora
    );

    // Emite confirmação
    io.emit('agendamento-confirmado', { cliente, data, hora });
    res.json({ sucesso: true, message: 'Agendamento confirmado com sucesso!' });
  } catch (error) {
    console.error('Erro ao confirmar agendamento:', error);
    res.status(500).json({ sucesso: false, message: 'Erro interno no servidor.' });
  }
});

// Rota para listar todos os agendamentos
/**
 * @swagger
 * /agendamentos:
 *   get:
 *     summary: Retorna todos os agendamentos
 *     responses:
 *       200:
 *         description: Lista de agendamentos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                 agendamentos:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       cliente:
 *                         type: string
 *                       email:
 *                         type: string
 *                       telefone:
 *                         type: string
 *                       data:
 *                         type: string
 *                         format: date
 *                       hora:
 *                         type: string
 *                         format: time
 *                       status:
 *                         type: string
 */
app.get('/agendamentos/:data', (req, res) => {
  const { data } = req.params;
  const query = 'SELECT * FROM agendamentos WHERE data = ?';
  const agendamentos = db.prepare(query).all(data);
  res.json({ sucesso: true, agendamentos });
});

// Rota para atualizar agendamento
/**
 * @swagger
 * /agendamentos/{id}:
 *   put:
 *     summary: Atualiza um agendamento
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID do agendamento
 *         schema:
 *           type: integer
 *     requestBody:
 *       description: Dados do agendamento
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cliente:
 *                 type: string
 *               email:
 *                 type: string
 *               telefone:
 *                 type: string
 *               data:
 *                 type: string
 *                 format: date
 *               hora:
 *                 type: string
 *                 format: time
 *               servicos:
 *                 type: array
 *                 items:
 *                   type: string
 *               dataEspecial:
 *                 type: string
 *               mensagem:
 *                 type: string
 *     responses:
 *       200:
 *         description: Agendamento atualizado com sucesso
 *       404:
 *         description: Agendamento não encontrado
 *       500:
 *         description: Erro interno ao atualizar o agendamento
 */
app.put('/agendamentos/:id', (req, res) => {
  const { id } = req.params;
  const { cliente, email, telefone, data, hora, servicos, dataEspecial, mensagem } = req.body;

  try {
    const query = `
      UPDATE agendamentos
      SET cliente = ?, email = ?, telefone = ?, data = ?, hora = ?, servicos = ?, dataEspecial = ?, mensagem = ?
      WHERE id = ?
    `;
    db.prepare(query).run(cliente, email, telefone, data, hora, servicos.join(', '), dataEspecial, mensagem, id);
    res.json({ sucesso: true, message: 'Agendamento atualizado com sucesso!' });
  } catch (error) {
    console.error('Erro ao atualizar agendamento:', error);
    res.status(500).json({ sucesso: false, message: 'Erro interno ao atualizar agendamento.' });
  }
});

// Rota para deletar agendamento
/**
 * @swagger
 * /agendamentos/{id}:
 *   delete:
 *     summary: Deleta um agendamento
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID do agendamento
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Agendamento deletado com sucesso
 *       404:
 *         description: Agendamento não encontrado
 *       500:
 *         description: Erro interno ao deletar o agendamento
 */
app.delete('/agendamentos/:id', (req, res) => {
  const { id } = req.params;

  try {
    const queryVerificacao = 'SELECT * FROM agendamentos WHERE id = ?';
    const agendamento = db.prepare(queryVerificacao).get(id);

    if (!agendamento) {
      return res.status(404).json({ sucesso: false, message: 'Agendamento não encontrado.' });
    }

    const queryDelecao = 'DELETE FROM agendamentos WHERE id = ?';
    db.prepare(queryDelecao).run(id);

    res.json({ sucesso: true, message: 'Agendamento deletado com sucesso!' });
  } catch (error) {
    console.error('Erro ao deletar agendamento:', error);
    res.status(500).json({ sucesso: false, message: 'Erro interno ao deletar agendamento.' });
  }
});


// WebSocket: Conexão e notificações em tempo real
io.on('connection', (socket) => {
  console.log('Novo cliente conectado:', socket.id);

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
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
    status TEXT DEFAULT 'disponivel',
    UNIQUE (data, hora)
  );
`);


function gerarHorariosDisponiveis(dataInicio, dataFim, horariosPorDia) {
  const dias = [];
  let dataAtual = new Date(dataInicio);

  while (dataAtual <= new Date(dataFim)) {
    dias.push(new Date(dataAtual));
    dataAtual.setDate(dataAtual.getDate() + 1); // Avança para o próximo dia
  }

  dias.forEach((dia) => {
    horariosPorDia.forEach((hora) => {
      const data = dia.toISOString().split('T')[0]; // Formato AAAA-MM-DD

      // Verifica se já existe um agendamento com a mesma data e hora
      const queryVerificacao = `SELECT COUNT(*) AS count FROM agendamentos WHERE data = ? AND hora = ?`;
      const result = db.prepare(queryVerificacao).get(data, hora);

      if (result.count === 0) {
        // Se não existe, insere o novo horário
        const queryInsercao = `
          INSERT INTO agendamentos (data, hora, status)
          VALUES (?, ?, 'disponivel')
        `;
        db.prepare(queryInsercao).run(data, hora);
      }
    });
  });

  console.log('Horários disponíveis adicionados ao banco de dados!');
}

// Configuração de horários
const dataInicio = '2024-12-01'; // Data inicial
const dataFim = '2024-12-31';   // Data final
const horariosPorDia = ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00'];

// Executa a função
gerarHorariosDisponiveis(dataInicio, dataFim, horariosPorDia);
