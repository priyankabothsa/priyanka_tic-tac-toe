// bring in express, apollo server, and socker.io
const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const socketIO = require('socket.io');

// bring in path to help build paths, and cors to configure express to use cors
const path = require('path');
const cors = require('cors');

// bring in auth helper, typedefs & resolvers, and db connection which will be used
// to connect to MongoDB and utilize apollo/graphQL
const { authMiddleware } = require('./utils/auth');
const { typeDefs, resolvers } = require('./schemas');
const db = require('./config/connection');

// declare port number, start up express and create an apollo server instance with schemas
// and set up context using auth import
const PORT = process.env.PORT || 3001;
const app = express();
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: authMiddleware,
});

// configure express to utilize cors, and to be able to process data
app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Serve up static assets
app.use('/images', express.static(path.join(__dirname, '../client/images')));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// function to start up the apollo server through express
const startApolloServer = async () => {
  await server.start();
  server.applyMiddleware({ app });
};

// Call the async function to start the server
startApolloServer();

// open connection to MongoDB
db.once('open', () => {
  // express starts listening, and store this instance in a variable
  const expressInstance = app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}!`);
    console.log(`Use GraphQL at http://localhost:${PORT}${server.graphqlPath}`);
  });

  // start up socket.io using the express instance
  const io = socketIO(expressInstance, {
    cors: {
      origin: "*"
    }
  });
  
  // socket.io connection event handler
  io.on("connection", (socket) => {
    console.log(`user connected: ${socket.id}`);

    socket.on('joinRoom', (roomNum, callback) => {
      console.log('joinroom event, roomnum:', roomNum);
      console.log('joinroom event, numInRoom:', io.sockets.adapter.rooms.get(roomNum)?.size || 0);
      const numInRoom = io.sockets.adapter.rooms.get(roomNum)?.size || 0;
      if (numInRoom <= 1) {
        socket.join(roomNum.toString());
        callback({
          status: "ok"
        });
      };
      if (numInRoom >= 2) {
        callback({
          status: "full"
        });
      };
    });
  
    socket.on('sendMessage', (data) => {
      console.log(data);
      socket.to(data.room).emit('recieveMessage', data.message);
    });

    socket.on('checkRoom', (roomNum, username, callback) => {
      const numInRoom = io.sockets.adapter.rooms.get(roomNum)?.size;
      console.log('checkRoom event, numInRoom:', numInRoom);
      io.to(roomNum).emit('recieveMessage', { user: 'server', message: `A wild ${username} has appeared!`});      
      if (numInRoom === 1) {
        socket.join(roomNum.toString());
        callback({
          player: "X"
        });
        io.to(roomNum).emit('recieveMessage', { user: 'server', message: `Send the room ID to a friend and have them join your room to begin playing.`});
      };
      if (numInRoom === 2) {
        callback({
          player: "O"
        });
        io.to(roomNum).emit('startGame', 'start');
        io.to(roomNum).emit('recieveMessage', { user: 'server', message: `Let the game begin!`}); 
      }
    });

    socket.on('passTurn', ({ tileClicked, roomNum }) => {
      console.log('tileclicked:', tileClicked);
      socket.to(roomNum).emit('recieveTurn', tileClicked);
    });
    
    socket.on('checkRestart', (roomNum) => {
      console.log('checking restart in room:', roomNum);
      socket.to(roomNum).emit('confirmRestart', roomNum)
    });

    socket.on('relayRestart', (roomNum, ConfirmRestarted) => {
      console.log('relayRestart:', roomNum, ConfirmRestarted);
      if (ConfirmRestarted) {
        io.to(roomNum).emit('restartGame', 'restart');
      };
    })

  });
});
