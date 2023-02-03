const db = require('./connection');
const { User } = require('../models');
const bcrypt = require('bcrypt');
const saltRounds = 10;

const usersArr = [
  {
    username: 'John',
    email: 'john@email.com',
    password: 'john123'
  },
  {
    username: 'althea',
    email: 'althea@email.com',
    password: 'althea123'
  },
  {
    username: 'richard',
    email: 'richard@email.com',
    password: 'richard123'
  }
];

const hashPasswords = usersArr.map(
  async (user) => {
    let hashedPassword = await bcrypt.hash(user.password, saltRounds);
    user.password = hashedPassword;
    return user;
});

db.once('open', async () => {

  const usersWithHashedPasswords = await Promise.all(hashPasswords)
  
  await User.deleteMany();

  await User.insertMany(usersWithHashedPasswords);

  console.log('users seeded');

  process.exit();
});
