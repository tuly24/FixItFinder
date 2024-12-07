const express = require("express")
const app = express()
const path = require('path');
const multer = require('multer')
const bcrypt = require('bcrypt');
const { PrismaClient } = require("@prisma/client");
const jwt = require('jsonwebtoken');
const { log } = require("console");
const nodemailer = require('nodemailer');
const validator = require('validator');
const fs = require('fs');
// const auth = require('./middleware/auth');
const router = express.Router();
const cors = require('cors');
app.use(cors());
app.use(express.static('public'));

const activeTokens = [];

app.set('views', path.join(__dirname, 'public'));
app.set('view engine', 'ejs');


// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Route to handle 'Edit Profile' button
app.get('/edit-profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'edit.html')); // Serve custo_edit.html
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

app.use(express.static(path.join(__dirname, 'public')))
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const prisma = new PrismaClient({ errorFormat: "pretty" });

const popularDomains = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'aol.com',
  'live.com',
];

//check phone number is valid or not
function isValidPhoneNumber(phoneNumber) {
  const phoneRegex = /^(017|013|019|018|015|016)\d{8}$/; //set phone number to 11 digit with specific prefix
  return phoneRegex.test(phoneNumber);
}

//check email is valid or not
function isEmailWithPopularDomain(email) {
  if (!validator.isEmail(email)) {
    return false;
  }

  const domain = email.split('@')[1].toLowerCase();
  return popularDomains.includes(domain);
}


app.get('/technician/:userName', async (req, res) => {
  const { userName } = req.params;

  try {
    const technician = await prisma.technician.findUnique({
      where: { userName: userName },
    });

    console.log('Technician fetched:', technician); // Debugging line

    if (!technician) {
      return res.status(404).send('Technician not found');
    }

    // Pass technician and userType to the EJS template
    res.render('technicianportfolio', { technician, userType: 'Technician' });
  } catch (err) {
    console.error('Error fetching data:', err); // Log the error details
    res.status(500).send('Error fetching data');
  }
});


//see details about technician
app.get('/portfolio', async (req, res) => {
  const { userName } = req.query;

  try {
    // Fetch technician data from PostgreSQL using Prisma
    const technician = await prisma.technician.findUnique({
      where: { userName: userName }, // Filter by username instead of ID
    });

    if (!technician) {
      return res.status(404).send('Technician not found');
    }

    // Pass data to the EJS template
    res.render('techprofile', { technician });
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).send('Error fetching data');
  }
});


//home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'frontpage.html'))
})

//provided service
app.get('/services', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'service_list_C.html'));
});


//technician register
app.get('/signupastechnicians', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'SignUpasTechnicians.html'))
})

//customer register
app.get('/signupascustomer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'SignupasCustomer.html'))
})


app.get('/User/:userName', async (req, res) => {
  const { userName } = req.params;

  try {
    const User = await prisma.User.findUnique({
      where: { userName: userName },
    });

    if (!User) {
      return res.status(404).send('Customer not found');
    }

    // Pass User and userType to the EJS template
    res.render('customerportfolio', { User, userType: 'User' });
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).send('Error fetching data');
  }
});


app.get('/editcustomer/:userType/:userName', async (req, res) => {
  const { userType, userName } = req.params;

  try {
    let User;
    if (userType === 'User') {
      User = await prisma.User.findUnique({
        where: { userName: userName },
      });
    } else if (userType === 'technician') {
      User = await prisma.technician.findUnique({
        where: { userName: userName },
      });
    }

    if (!User) {
      return res.status(404).send(`${userType} not found`);
    }

    // Pass User and userName to the EJS template
    res.render('editcustomer', { User, userName: User.userName, userType });
  } catch (err) {
    console.error('Error fetching data:', err);
    res.status(500).send('Error fetching data');
  }
});


app.get('/edittechnician/:userType/:userName', async (req, res) => {
  const { userType, userName } = req.params;

  try {
    let technician;

    // Check if userType is 'technician' and fetch technician data
    if (userType === 'technician') {
      technician = await prisma.technician.findUnique({
        where: { userName: userName },
      });
    }

    // Check if technician was found
    if (!technician) {
      return res.status(404).send(`${userType} not found`);
    }

    // Pass technician and userName to the EJS template
    res.render('edittechnician', { technician, userName: technician.userName, userType });
  } catch (err) {
    console.error('Error fetching data:', err.message); // Log the error message
    res.status(500).send('Error fetching data');
  }
});


app.post('/editcustomer/:userType/:userName', upload.single('profileImage'), async (req, res) => {
  const { fullName, phoneNumber, emailAddress, area, subArea, religion } = req.body;
  const userName = req.params.userName; 
  const profileImage = req.file ? req.file.buffer : null; // Access buffer directly

  try {
      // Find the existing user
      const existingUser = await prisma.User.findUnique({ where: { userName } });
      if (!existingUser) {
          return res.status(404).json({ message: 'User not found' });
      }

      // Validate phone number and email
      if (!isValidPhoneNumber(phoneNumber)) {
          return res.status(400).json({ error: 'Invalid phone number. It must start with one of the allowed prefixes (017, 013, 019, 018, 015, 016) and have 11 digits.' });
      }
      if (!isEmailWithPopularDomain(emailAddress)) {
          return res.status(400).json({ error: 'Invalid email or domain is not popular.' });
      }

      // Update the user information
      await prisma.User.update({
          where: { userName },
          data: {
              fullName: fullName || existingUser.fullName,
              phoneNumber: phoneNumber || existingUser.phoneNumber,
              emailAddress: emailAddress || existingUser.emailAddress,
              area: area || existingUser.area,
              subArea: subArea || existingUser.subArea,
              religion: religion || existingUser.religion,
              profileImage: profileImage || existingUser.profileImage,
          },
      });

      // Send success message
      res.json({ message: 'Profile updated successfully!' });
  } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ message: 'Error updating profile' });
  }
});


app.post('/edittechnician/:userType/:userName', upload.single('profileImage'), async (req, res) => {
  const { fullName, phoneNumber, emailAddress, area, subArea, religion } = req.body;
  const userName = req.params.userName; 
  const profileImage = req.file ? req.file.buffer : null; // Access buffer directly

  try {
      // Find the existing user
      const existingUser = await prisma.technician.findUnique({ where: { userName } });
      if (!existingUser) {
          return res.status(404).json({ message: 'User not found' });
      }

      // Validate phone number and email
      if (!isValidPhoneNumber(phoneNumber)) {
          return res.status(400).json({ error: 'Invalid phone number. It must start with one of the allowed prefixes (017, 013, 019, 018, 015, 016) and have 11 digits.' });
      }
      if (!isEmailWithPopularDomain(emailAddress)) {
          return res.status(400).json({ error: 'Invalid email or domain is not popular.' });
      }

      // Update the user information
      await prisma.technician.update({
          where: { userName: userName },
          data: {
              fullName: fullName || existingUser.fullName,
              phoneNumber: phoneNumber || existingUser.phoneNumber,
              emailAddress: emailAddress || existingUser.emailAddress,
              area: area || existingUser.area,
              subArea: subArea || existingUser.subArea,
              religion: religion || existingUser.religion,
              profileImage: profileImage || existingUser.profileImage 
          },
      });

      // Send success message
      res.json({ message: 'Profile updated successfully!' });
  } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ message: 'Error updating profile' });
  }
});


//search technicians
app.post('/search', async (req, res) => {
  let decoded;
  try {
      decoded = jwt.verify(req.headers.authorization, 'your_jwt_secret');
  } catch (err) {
      console.error('JWT verification error:', err);
      return res.status(401).send({ message: 'Invalid or expired token' });
  }

  if (!decoded.area || !decoded.subArea) {
      return res.status(400).send({ message: 'Area or SubArea is missing in JWT token' });
  }

  console.log('Service:', req.body.service, 'Area:', decoded.area, 'SubArea:', decoded.subArea);

  try {
      const data = await prisma.technician.findMany({
          where: {
              Profession: req.body.service,
              area: decoded.area,
              subArea: decoded.subArea,
          }
      });

      if (data.length === 0) {
          console.log('No technicians found for this service in the specified area and subarea.');
          return res.status(404).send({ message: 'No technicians found for this service in your area.' });
      }

      console.log('Fetched technicians:', data);
      res.send(data);
  } catch (error) {
      console.error('Error fetching technicians from the database:', error);
      res.status(500).send({ message: 'An error occurred while fetching technicians.' });
  }
});

//forget password test
app.get('/forgetpassword', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'forgetpass.html'))
})

//submit details of customer
app.post('/customerregister', upload.single('profileImage'), async (req, res) => {
  let { fullName, userName, phoneNumber, emailAddress, password, area, subArea, religion } = req.body;
  const profileImage = req.file;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { emailAddress } });
  if (existingUser) {
    return res.status(400).json({ message: 'User already exists' });
  }
  if (!isValidPhoneNumber(phoneNumber)) {
    return res.status(400).json({ error: 'Invalid phone number. It must start with one of the allowed prefixes (017, 013, 019, 018, 015, 016) and have 11 digits.' });
  }
  if (!isEmailWithPopularDomain(emailAddress)) {
    return res.status(400).json({ error: 'Invalid email or domain is not popular.' });
  }
  const profileImageData = profileImage.buffer; // Get binary data
  password = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      fullName,
      userName,
      phoneNumber,
      emailAddress,
      password,
      area,
      subArea,
      religion,
      profileImage: profileImageData,
    }
  });

  res.json({ message: 'Registration successful!' });
});

app.use(cors());
app.use(cors({
  origin: "https://fix-it-finder-seven.vercel.app",
}));

//submit details of technician
app.post('/technicianregister', upload.single('profileImage'), async (req, res) => {
  try {
      const { fullName, userName, phoneNumber, emailAddress, password, area, subArea, Profession, religion } = req.body;
      const profileImage = req.file;

      if (!profileImage) {
          return res.status(400).json({ error: 'Profile image is required.' });
      }

      const profileImageData = profileImage.buffer; // Get binary data
      const hashedPassword = await bcrypt.hash(password, 10);

      await prisma.technician.create({
          data: {
              fullName,
              userName,
              phoneNumber,
              emailAddress,
              password: hashedPassword,
              area,
              subArea,
              Profession,
              religion,
              profileImage: profileImageData, // Save binary data
          },
      });

      res.json({ message: 'Registration successful!' });
  } catch (error) {
      console.error('Error during registration:', error);
      res.status(500).json({ error: 'Internal server error.' });
  }
});

//log in 
app.post('/login', async (req, res) => {
  console.log(req.body)

  const { identifier, password } = req.body; // identifier can be email or phone number
  let user = await prisma.user.findUnique({ where: { emailAddress: identifier } });

  if (!user) {
    user = await prisma.user.findUnique({ where: { phoneNumber: identifier } });
  }

  if (!user) {
    let technician = await prisma.technician.findUnique({ where: { emailAddress: identifier } });

    if (!technician) {
      technician = await prisma.technician.findUnique({ where: { phoneNumber: identifier } });
    }

    if (!technician) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, technician.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: technician.id,area: technician.area, subArea: technician.subArea,userName:technician.userName, role: 'technician' }, 'your_jwt_secret', { expiresIn: '1h' });
    activeTokens.push(token);
    return res.json({ message: 'Login successful!', token, redirectTo: `/technician/${technician.userName}` });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, area: user.area, subArea: user.subArea, userName:user.userName,role: 'user' }, 'your_jwt_secret', { expiresIn: '1h' });
  activeTokens.push(token);
  res.json({ message: 'Login successful!', token, redirectTo: `/User/${user.userName}` });
});

//log out
app.post('/logout', (req, res) => {
  let token = req.headers['authorization'];
  if (!token) {
      return res.status(400).json({ message: 'No token provided' });
  }

  // Remove 'Bearer ' prefix if present
  if (token.startsWith('Bearer ')) {
      token = token.slice(7); // Extract the token after 'Bearer '
  }

  const tokenIndex = activeTokens.indexOf(token);
  if (tokenIndex > -1) {
      activeTokens.splice(tokenIndex, 1); // Remove token from activeTokens list
      return res.json({ message: 'Logout successful!' });
  }

  res.status(400).json({ message: 'Invalid token or already logged out' });
});

function authenticateToken(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) {
      return res.status(403).json({ message: 'No token provided' });
  }

  // Verify if token exists in activeTokens
  if (!activeTokens.includes(token)) {
      return res.status(403).json({ message: 'Invalid or expired token' });
  }

  // Decode and verify JWT
  jwt.verify(token, 'your_jwt_secret', (err, user) => {
      if (err) {
          return res.status(403).json({ message: 'Invalid or expired token' });
      }
      req.user = user;
      next();
  });
}


app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

let verificationCodes = {}; // Store codes temporarily for email_phone

// Configure nodemailer for sending emails
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'tulyrahmy@gmail.com',  // Your email
    pass: 'gqax aamy vkvm cpkk',      // Your app password
  },
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Step 1: Send verification code via email
app.post('/send-verification-code', async (req, res) => {
  const { email_phone } = req.body;

  // Generate a 6-digit random verification code
  const verificationCode = Math.floor(100000 + Math.random() * 900000);
  verificationCodes[email_phone] = verificationCode;

  try {
    // Send the verification code via email
    await transporter.sendMail({
      from: 'tulyrahmy@gmail.com',
      to: email_phone, // Always send to the email entered
      subject: 'FixItFinder Password Reset Verification Code',
      text: `Your verification code is ${verificationCode}.`
    });

    res.json({ message: 'Verification code sent successfully!' });
  } catch (error) {
    console.error('Error sending verification code:', error);
    res.status(500).json({ message: 'Error sending verification code', error: error.message });
  }
});

// Step 2: Submit and verify the code
app.post('/verify-code', (req, res) => {
  const { email_phone, verification_code } = req.body;

  if (verificationCodes[email_phone] && verificationCodes[email_phone] == verification_code) {
    res.json({ message: 'Verification code is correct!' });
  } else {
    res.status(400).json({ message: 'Verification code is incorrect!' });
  }
});

// Step 3: Reset the password
app.post('/reset-password', async (req, res) => {
  const { email_phone, new_password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update the password in the database (for both customer and technician)
    const user = await prisma.user.update({
      where: { emailAddress: email_phone },
      data: { password: hashedPassword }
    }).catch(async () => {
      return await prisma.technician.update({
        where: { emailAddress: email_phone },
        data: { password: hashedPassword }
      });
    });

    if (user) {
      res.json({ message: 'Password reset successfully!' });
    } else {
      res.status(404).json({ message: 'User not found!' });
    }
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Error resetting password', error: error.message });
  }
});

app.post('/rate-technician', async (req, res) => {
  const { technicianUserName, ratingValue } = req.body;

  // Extract the token from the Authorization header
  const token = req.headers['authorization'];
  if (!token) {
      return res.status(400).json({ message: 'User is not logged in or token is missing.' });
  }

  try {
      // Verify the JWT token and extract the logged-in user's info
      const decoded = jwt.verify(token, 'your_jwt_secret');
      const loged_user = decoded.userName; // Assuming 'id' is stored in the JWT token as the user's unique identifier

      // Check if the user has already rated this technician
      const existingRating = await prisma.rating.findFirst({
          where: {
              technicianId: technicianUserName,
              userId: loged_user,
          },
      });

      if (existingRating) {
          return res.status(400).json({ message: 'You have already rated this technician.' });
      }

      // Add the new rating
      await prisma.rating.create({
          data: {
              userId: loged_user,
              ratingValue: parseInt(ratingValue),
              tech: {
                  connect: { userName: technicianUserName }, // Connecting the technician by userName
              },
          },
      });

      // Update the technician's average rating and rating count
      const technician = await prisma.technician.findUnique({
          where: { userName: technicianUserName },
      });

      const newRatingCount = (technician.ratingCount || 0) + 1;
      const newRating = ((technician.ratings || 0) * technician.ratingCount + parseInt(ratingValue)) / newRatingCount;

      await prisma.technician.update({
          where: { userName: technicianUserName },
          data: {
              ratings: newRating,
              ratingCount: newRatingCount,
          },
      });

      res.json({ message: 'Rating submitted successfully.' });
  } catch (error) {
      console.error(error);
      if (error.name === 'JsonWebTokenError') {
          return res.status(400).json({ message: 'Invalid token.' });
      }
      res.status(500).json({ message: 'An error occurred while submitting your rating.' });
  }
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})

app.get('/profile-image/:userName', async (req, res) => {
  try {
      const { userName } = req.params;
      const technician = await prisma.technician.findUnique({
          where: { userName },
          select: { profileImage: true },
      });

      if (!technician || !technician.profileImage) {
          return res.status(404).json({ message: 'Image not found' });
      }

      res.set('Content-Type', 'image/jpeg'); // Update based on the actual image type
      res.send(technician.profileImage);
  } catch (error) {
      console.error('Error fetching image:', error);
      res.status(500).json({ message: 'Internal server error' });
  }
});

const { v4 } = require('uuid');

app.get('/api', (req, res) => {
  const path = `/api/item/${v4()}`;
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 's-max-age=1, stale-while-revalidate');
  res.end(`Hello! Go to item: <a href="${path}">${path}</a>`);
});

app.get('/api/item/:slug', (req, res) => {
  const { slug } = req.params;
  res.end(`Item: ${slug}`);
});

module.exports = app;


app.post('/admin/login', async (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    // Find the admin with the provided email
    const admin = await prisma.admin.findUnique({
      where: { emailAddress: identifier },
    });

    if (!admin) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Compare the provided password with the hashed password
    const isPasswordValid = await bcrypt.compare(password, admin.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Generate a JWT token
    const token = jwt.sign(
      { adminId: admin.id, userName: admin.userName },
      'your_jwt_secret',
      { expiresIn: '1h' }
    );

    activeTokens.push(token);
    res.json({ message: 'Login successful!', token, redirectTo: `/admin/dashboard/${admin.userName}` });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

// Admin Dashboard Endpoint
app.get('/admin/dashboard/:userName', async (req, res) => {
  const { userName } = req.params;

  try {
    const admin = await prisma.admin.findUnique({
      where: { userName: userName },
    });

    console.log('Admin fetched:', admin); // Debugging line

    if (!admin) {
      return res.status(404).send('Admin not found');
    }

    // Pass technician and userType to the EJS template
    res.render('admin-dashboard', { admin });
  } catch (err) {
    console.error('Error fetching data:', err); // Log the error details
    res.status(500).send('Error fetching data');
  }
});

app.get('/api/users', async (req, res) => {
  try {
      const users = await prisma.user.findMany();
      res.json(users);
  } catch (error) {
      console.error(error);
      res.status(500).send('Error fetching users');
  }
});
app.get('/api/technicians', async (req, res) => {
  try {
      const technicians = await prisma.technician.findMany();
      res.json(technicians);
  } catch (error) {
      console.error(error);
      res.status(500).send('Error fetching technicians');
  }
});

app.get('/api/top-technicians', async (req, res) => {
  try {
    const topTechnicians = await prisma.technician.findMany({
      where: {
        ratings: {
          not: null, 
        },
      },
      orderBy: { ratings: 'desc' },
      take: 10,
    });
    res.json(topTechnicians);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching top technicians');
  }
});

// Route to fetch the number of technicians for each profession in a given area and sub-area
app.get('/api/technicians/count-by-profession', async (req, res) => {
  const { area, subArea } = req.query;

  if (!area || !subArea) {
      return res.status(400).json({ error: "Area and sub-area are required." });
  }

  try {
      const counts = await prisma.technician.groupBy({
          by: ['Profession'],
          where: {
              area,
              subArea,
          },
          _count: {
              Profession: true,
          },
      });

      res.json(counts);
  } catch (error) {
      console.error(error);
      res.status(500).send('Error fetching technician count by profession.');
  }
});

app.get('/api/technicians/count-by-professionall', async (req, res) => {
  try {
      // Query to group technicians by profession and count them
      const professionCounts = await prisma.technician.groupBy({
          by: ['Profession'], // Group by the 'Profession' field
          _count: {
              Profession: true, // Count occurrences of each profession
          },
      });

      res.status(200).json(professionCounts); // Send the results as JSON
  } catch (error) {
      console.error('Error fetching profession counts:', error);
      res.status(500).json({ error: 'An error occurred while fetching the data.' });
  }
});
app.get('/api/technicians/filter', async (req, res) => {
  const { profession, area, subArea } = req.query;

  if (!profession || !area || !subArea) {
      return res.status(400).json({ error: 'Profession, area, and sub-area are required.' });
  }

  try {
      const technicians = await prisma.technician.findMany({
          where: {
              Profession: profession,
              area: area,
              subArea: subArea,
          },
      });

      if (technicians.length === 0) {
          return res.status(404).json({ message: 'No technicians found for the specified criteria.' });
      }

      res.status(200).json(technicians);
  } catch (error) {
      console.error('Error fetching technicians:', error);
      res.status(500).json({ error: 'An error occurred while fetching technicians.' });
  }
});

const filePath = path.join(__dirname, 'service.json');

const getServices = () => {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

const saveServices = (services) => {
  fs.writeFileSync(filePath, JSON.stringify(services, null, 2));
};

// Get services
app.get('/api/services', (req, res) => {
  const services = getServices();
  res.json(services);
});

// Add a new service
app.post('/api/services', (req, res) => {
  const newService = req.body.service;
  if (!newService) {
    return res.status(400).json({ message: 'Invalid service.' });
  }

  const services = getServices();
  if (!services.includes(newService)) {
    services.push(newService);
    saveServices(services);
    res.status(201).json({ message: 'Service added successfully.' });
  } else {
    res.status(400).json({ message: 'Service already exists.' });
  }
});

// Delete a service
app.delete('/api/services/:service', (req, res) => {
  const service = req.params.service;
    let services = getServices();
    if (services.includes(service)) {
        services = services.filter(s => s !== service);
        saveServices(services);
        res.json({ message: 'Service deleted successfully.' });
    } else {
        res.status(404).json({ message: 'Service not found.' });
    }
});

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html')); // admin login page
});


