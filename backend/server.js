require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const User = require('./models/User');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// Register Route
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, profilePhoto } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      profilePhoto: profilePhoto || ''
    });

    await newUser.save();

    // Create JWT
    const token = jwt.sign(
      { id: newUser._id, email: newUser.email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '30d' }
    );

    res.status(201).json({
      token,
      user: { id: newUser._id, name: newUser.name, email: newUser.email }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Login Route
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists (by email or username)
    // Front-end sends it as 'email' state even if it's a username
    const user = await User.findOne({ 
      $or: [
        { email: email },
        { name: new RegExp('^' + email + '$', 'i') } // Case-insensitive exact match for name
      ]
    });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Create JWT
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Last.fm Recommendations Route
app.get('/api/recommendations/lastfm', async (req, res) => {
  const { track, artist } = req.query;
  const LASTFM_API_KEY = process.env.LASTFM_API_KEY || 'ac09a781b56b0af27edd7961a6b67d8b';

  if (!track || !artist) {
    return res.status(400).json({ message: "Track and artist are required" });
  }

  try {
    const url = `http://ws.audioscrobbler.com/2.0/?method=track.getsimilar&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}&api_key=${LASTFM_API_KEY}&format=json&limit=10`;
    
    const response = await axios.get(url);
    
    if (response.data.error) {
       return res.status(400).json({ message: response.data.message });
    }

    // Extract the similar tracks
    const similarTracks = response.data.similartracks.track.map(t => ({
      name: t.name,
      artist: t.artist.name,
      image: t.image && t.image.length > 2 ? t.image[2]['#text'] : (t.image && t.image.length > 0 ? t.image[0]['#text'] : null)
    }));

    res.json(similarTracks);
  } catch (error) {
    console.error('Error fetching Last.fm recommendations:', error.message);
    res.status(500).json({ message: 'Failed to fetch recommendations' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
