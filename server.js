/*********************************
 *  SETUP & DEPENDENCIES
 *********************************/
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// For file uploads:
const multer = require('multer');
const path = require('path');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

/*********************************
 *  MONGOOSE CONNECTION
 *********************************/
mongoose
  .connect(
    'mongodb+srv://jeffersonchristian259:Ivh5vgdJAnd9Px2G@taysblog.ldkit.mongodb.net/Blog'
  )
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
    category: {
      type: String,
      enum: ['FAITH', 'FITNESS/WELLNESS', 'FLIGHTS'], // Allowed categories
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tay', // references the "Tay" model (User)
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
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
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
 *  MULTER SETUP (for file uploads)
 *********************************/
// 1. Configure the storage destination and filename
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Make sure you have an "uploads" folder in the same directory
    cb(null, 'uploads');
  },
  filename: (req, file, cb) => {
    // Use a unique filename
    const uniqueSuffix = Date.now() + '-' + file.originalname;
    cb(null, uniqueSuffix);
  },
});

// 2. Create the multer instance with that storage config
const upload = multer({ storage });

// 3. Serve images statically from /uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/*********************************
 *  ROUTES
 *********************************/

// 1) Basic test route
app.get('/', (req, res) => {
  res.send('Hello from the blog API!');
});
const test = "test"
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
 * 4) Upload an image (Only if logged in)
 *    - Expects a file named "image" in form-data
 *    - Requires valid token
 *    - Returns { filePath: 'uploads/...unique-filename.jpg' }
 */
app.post('/upload', authenticateUser, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const filePath = req.file.path; // e.g. "uploads/1677000000-myimage.jpg"
    return res.status(200).json({ filePath });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to upload image.' });
  }
});

/**
 * 5) Create a new blog post (Only if logged in)
 *    - Expects { title, blog, img, category } in req.body
 *    - "img" will be the file path if using /upload, e.g. "uploads/1677000000-myimage.jpg"
 */
app.post('/blogs', authenticateUser, async (req, res) => {
  try {
    const { title, blog, img, category } = req.body;

    const newBlog = new Blog({
      title,
      blog,
      img,
      category,
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
 * 6) Get all blog posts
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

app.delete('/blogs/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedBlog = await Blog.findByIdAndDelete(id);
    if (!deletedBlog) {
      return res.status(404).json({ error: 'Blog not found.' });
    }
    res.json({ message: 'Blog deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error deleting blog post.' });
  }
});

/*********************************
 *  START THE SERVER
 *********************************/
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
