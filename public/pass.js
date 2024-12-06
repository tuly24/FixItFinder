const bcrypt = require('bcrypt');

const hashPassword = async () => {
    const password = 'fixitfinder'; // Replace with your password
    const hashedPassword = await bcrypt.hash(password, 10); // 10 is the salt rounds
    console.log('Hashed Password:', hashedPassword);
};

hashPassword().catch(console.error);
