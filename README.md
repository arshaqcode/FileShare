# FileShare App

A modern, real-time file sharing application with device pairing and secure temporary links. Share files between devices instantly or generate expiring download links.

## Features

- **Real-time Device Pairing**: Connect devices via WebSocket for instant file transfers
- **Secure File Uploads**: Upload files with configurable expiry times
- **Multiple Storage Options**: Local storage or AWS S3 integration
- **Rate Limiting**: Built-in protection against abuse
- **Responsive UI**: Modern, dark-themed interface
- **Cross-Platform**: Works on any device with a web browser

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- (Optional) AWS account for S3 storage

## Installation

1. Clone or download the project files
2. Navigate to the project root directory

### Backend Setup

1. Go to the `backend` directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment file:
   ```bash
   cp .env.example .env
   ```

4. Configure your environment variables in `.env`:
   - `PORT`: Server port (default: 4000)
   - `STORAGE_MODE`: 'local' or 's3'
   - `UPLOAD_DIR`: Directory for local file storage (default: ./uploads)
   - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME`: For S3 storage
   - `DEFAULT_EXPIRY_MS`: Default file expiry time in milliseconds (default: 3600000 = 1 hour)
   - `CORS_ORIGIN`: Allowed origins for CORS (default: http://localhost:3000)

### Frontend Setup

The frontend is a static HTML file served by the backend. No additional setup required.

## Running the Application

1. Start the backend server:
   ```bash
   npm start
   ```
   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

2. Open your browser and navigate to `http://localhost:4000` (or your configured port)

## Usage

### Device Registration
- Enter a unique device name to register
- Your device will appear in the device list for other users

### File Upload
- Drag and drop files or click to select
- Choose target device for direct transfer or leave blank for link generation
- Set expiry time (1 hour to 7 days)
- Upload and get a shareable link

### Receiving Files
- When someone sends you a file, you'll receive a notification
- Click the download link to get the file

### API Endpoints

- `POST /api/upload`: Upload a file
- `GET /api/download/:fileId`: Download a file
- `GET /api/file/:fileId`: Get file metadata
- `GET /api/devices`: List connected devices

## Storage Options

### Local Storage (Default)
- Files stored in the `uploads/` directory
- Automatic cleanup on expiry
- Suitable for development and small deployments

### AWS S3 Storage
- Set `STORAGE_MODE=s3` in your `.env`
- Configure AWS credentials and bucket
- Files uploaded to S3 with automatic deletion on expiry
- Scalable for production use

## Troubleshooting

### Server won't start
- Check if the port is already in use
- Ensure all dependencies are installed (`npm install`)
- Verify environment variables are set correctly

### Files not uploading
- Check file size limits (default: 500MB)
- Ensure upload directory exists and is writable
- For S3: Verify AWS credentials and bucket permissions

### Devices not connecting
- Check WebSocket connection (port 4000)
- Ensure CORS_ORIGIN allows your frontend URL
- Check browser console for errors

### Files expiring too quickly
- Adjust `DEFAULT_EXPIRY_MS` in `.env`
- Expiry times are in milliseconds

## Development

- Backend: Node.js with Express and Socket.io
- Frontend: Vanilla HTML/CSS/JavaScript
- File handling: Multer for uploads
- Real-time communication: Socket.io

## License

This project is open source. Feel free to modify and distribute.</content>
<parameter name="filePath">c:\Users\arsha\OneDrive\Desktop\file sending app\README.md