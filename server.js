/*********************************
 *  SETUP & DEPENDENCIES
 *********************************/
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

/*********************************
 *  MONGOOSE CONNECTION
 *********************************/
mongoose.connect('mongodb+srv://<username>:<password>@taysblog.ldkit.mongodb.net/Blog')
  .then(() => {
    console.log('db connected!');
  })
  .catch((err) => {
    console.log('db connection error!', err);
  });

/*********************************
 *  SCHEMAS & MODELS
 *********************************/

// Blog schema
const BlogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    blog: {
      type: String,
      required: true,
    },
    img: {
      type: String,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tay',   // references the "Tay" model (User)
    },
  },
  { timestamps: true }
);

const Blog = mongoose.model('Blog', BlogSchema);

// User schema (Tay)
const TaySchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true
    },
    password: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

const Tay = mongoose.model('Tay', TaySchema);

/*********************************
 *  AUTH MIDDLEWARE
 *********************************/
function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Malformed token.' });
  }

  try {
    const decoded = jwt.verify(token, 'MY_SUPER_SECRET_KEY');
    req.user = decoded; // store user data in req
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/*********************************
 *  ROUTES
 *********************************/

// 1) Basic test route
app.get('/', (req, res) => {
  res.send('Hello from the blog API!');
});

/**
 * 2) Register a new user
 */
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const existingUser = await Tay.findOne({ username });

    if (existingUser) {
      return res.status(400).json({ error: 'Username already in use.' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = new Tay({ username, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: 'User registered successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

/**
 * 3) Login route
 */
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user
    const user = await Tay.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Compare password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Generate JWT
    const token = jwt.sign({ userId: user._id }, 'MY_SUPER_SECRET_KEY', {
      expiresIn: '1h',
    });

    res.json({
      message: 'Logged in successfully.',
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

/**
 * 4) Create a new blog post (Only if logged in)
 *    - Expects { title, blog, img } in req.body
 *    - Requires valid token in the Authorization header
 */
app.post('/blogs', authenticateUser, async (req, res) => {
  try {
    const { title, blog, img } = req.body;

    const newBlog = new Blog({
      title,
      blog,
      img,
      user: req.user.userId, // the currently logged-in user
    });

    const savedBlog = await newBlog.save();
    res.status(201).json(savedBlog);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error creating blog post.' });
  }
});

/**
 * 5) Get all blog posts
 */
app.get('/blogs', async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 }).populate('user');
    res.json(blogs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching blog posts.' });
  }
});

/*********************************
 *  START THE SERVER
 *********************************/
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
