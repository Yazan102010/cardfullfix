// Import necessary packages
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
require("dotenv").config(); // Load environment variables

// Declare the 'app' object
const app = express();

// Cloudinary configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Middleware
app.use(cors());
app.use(bodyParser.json());  // Ensure JSON parsing is enabled for POST requests

const PORT = process.env.PORT || 4000;

// Connect to MongoDB using environment variable for URI
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('MongoDB connected'))
    .catch((err) => console.log('MongoDB connection error:', err));

const ProfileSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    jobTitle: { type: String, required: true },
    profileImage: { type: String }, // Cloudinary URL saved here
    headerImage: { type: String },  // Cloudinary URL saved here
    phone: { type: String },
    email: { type: String },
    isVerified: { type: Boolean, default: false },
    isCompany: { type: Boolean, default: false },
    socialLinks: {
        website: { type: String },
        instagram: { type: String },
        facebook: { type: String },
        telegram: { type: String },
        tiktok: { type: String },
        youtube: { type: String },
        whatsapp: { type: String },
        maps: { type: String },
        snapchat: { type: String },
    },
});

// Define your model
const Profile = mongoose.model('Profile', ProfileSchema);

// Multer storage setup for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Routes

// Endpoint to create a new profile
// Endpoint to create a new profile
app.post("/api/save-profile", upload.fields([{ name: "profileImage" }, { name: "headerImage" }]), async (req, res) => {
    const { username, name, jobTitle, phone, email, isVerified, isCompany, socialLinks } = req.body;

    // Validation
    if (!username || username.trim().length < 3) {
        return res.status(400).json({ message: "Username must be at least 3 characters long." });
    }

    const profileKey = username.toLowerCase().replace(/\s+/g, "-");

    try {
        // Check for existing profile with the same username
        const existingProfile = await Profile.findOne({ username });
        if (existingProfile) {
            return res.status(400).json({ message: "Username is already taken." });
        }

        let profileImageUrl = "";
        let headerImageUrl = "";

        // Upload profile image to Cloudinary if it exists
        if (req.files && req.files.profileImage && req.files.profileImage[0]) {
            const profileImageBuffer = req.files.profileImage[0].buffer;
            profileImageUrl = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { resource_type: "auto" },
                    (error, result) => {
                        if (error) {
                            reject(error); // Reject if there's an error
                        } else {
                            resolve(result.secure_url); // Resolve with the image URL
                        }
                    }
                );
                stream.end(profileImageBuffer); // Ensure the file buffer is processed
            });
        }

        // Upload header image to Cloudinary if it exists
        if (req.files && req.files.headerImage && req.files.headerImage[0]) {
            const headerImageBuffer = req.files.headerImage[0].buffer;
            headerImageUrl = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { resource_type: "auto" },
                    (error, result) => {
                        if (error) {
                            reject(error); // Reject if there's an error
                        } else {
                            resolve(result.secure_url); // Resolve with the image URL
                        }
                    }
                );
                stream.end(headerImageBuffer); // Ensure the file buffer is processed
            });
        }

        // Save the profile to the database
        const newProfile = new Profile({
            username,
            name,
            jobTitle,
            profileImage: profileImageUrl,
            headerImage: headerImageUrl,
            phone,
            email,
            isVerified,
            isCompany,
            socialLinks,
        });

        const savedProfile = await newProfile.save();

        res.status(201).json({ message: "Profile saved successfully", profileKey, profile: savedProfile });
    } catch (err) {
        console.error("Server error:", err);
        if (err.code === 11000) {
            return res.status(400).json({ message: "Profile key or username already exists." });
        }
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

// Get a profile by unique name (profileKey)
app.get("/:profileKey", async (req, res) => {
    const profileKey = req.params.profileKey;

    try {
        const profile = await Profile.findOne({ username: profileKey });
        if (!profile) {
            return res.status(404).json({ message: "Profile not found" });
        }
        res.json(profile);
    } catch (error) {
        res.status(500).json({ message: "Error fetching profile", error });
    }
});

// Delete a profile by profileKey
app.delete("/api/profiles/:profileKey", async (req, res) => {
    const { profileKey } = req.params;

    try {
        const profile = await Profile.findOneAndDelete({
            username: new RegExp(`^${profileKey.replace('-', ' ')}$`, 'i')
        });

        if (!profile) {
            return res.status(404).json({ message: "Profile not found" });
        }

        res.status(200).json({ message: "Profile deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update an existing profile by profileKey
app.put("/api/update-profile/:profileKey", upload.fields([{ name: "profileImage" }, { name: "headerImage" }]), async (req, res) => {
    const profileKey = req.params.profileKey;
    const { username, name, jobTitle, phone, email, isVerified, isCompany, socialLinks } = req.body;

    let profileImageUrl = req.body.profileImage; // Use existing image URL if not updated
    let headerImageUrl = req.body.headerImage; // Use existing image URL if not updated

    // Parse socialLinks string into an object
    let parsedSocialLinks = {};
    if (socialLinks) {
        parsedSocialLinks = JSON.parse(socialLinks); // Parse the socialLinks string into an object
    }

    try {
        // Handle image upload for profile and header images if they exist
        if (req.files && req.files.profileImage) {
            const profileImageBuffer = req.files.profileImage[0].buffer;
            const profileImageResult = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream(
                    { resource_type: "image" },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result);
                    }
                ).end(profileImageBuffer);
            });
            profileImageUrl = profileImageResult.secure_url;
        }

        if (req.files && req.files.headerImage) {
            const headerImageBuffer = req.files.headerImage[0].buffer;
            const headerImageResult = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream(
                    { resource_type: "image" },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result);
                    }
                ).end(headerImageBuffer);
            });
            headerImageUrl = headerImageResult.secure_url;
        }

        // Update the profile in MongoDB
        const updatedProfile = await Profile.findOneAndUpdate(
            { username: new RegExp(`^${profileKey}$`, "i") }, // Match profileKey case-insensitively
            {
                username,
                name,
                jobTitle,
                profileImage: profileImageUrl,
                headerImage: headerImageUrl,
                phone,
                email,
                isVerified,
                isCompany,
                socialLinks: parsedSocialLinks,
            },
            { new: true } // Return the updated profile
        );

        if (!updatedProfile) {
            return res.status(404).json({ message: "Profile not found" });
        }

        res.status(200).json(updatedProfile);
    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ message: "Error updating profile", error });
    }
});
// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
