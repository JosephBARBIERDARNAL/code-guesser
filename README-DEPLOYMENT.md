# Deployment Guide for Code Guesser with Backend

This guide will help you deploy your Code Guesser game with the secure backend to prevent cheating.

## Anti-Cheating Features Implemented

1. **Server-side Game Sessions**: Each game starts with a unique session ID and server-generated snippet order
2. **Answer Validation**: All answers are validated server-side against the original game session
3. **Time Validation**: Minimum time requirements prevent impossibly fast completion
4. **Session Security**: Sessions expire after use and cannot be reused
5. **Input Sanitization**: All user inputs are validated and sanitized
6. **Rate Limiting**: Prevents spam and automated attacks

## Deployment Options

### Option 1: Railway (Recommended - Free with Database)

1. **Sign up at [Railway](https://railway.app)**
2. **Connect your GitHub repository**
3. **Deploy the backend:**
   ```bash
   # Railway will automatically detect your Node.js app
   # No additional configuration needed
   ```
4. **Set environment variables:**

   - `FRONTEND_URL`: Your frontend URL (e.g., `https://yourusername.github.io/guess-the-code`)
   - `PORT`: Will be set automatically by Railway

5. **Update your frontend:**
   ```javascript
   // In script.js, replace:
   const API_BASE_URL = "http://localhost:3000/api";
   // With:
   const API_BASE_URL = "https://code-guesser-production.up.railway.app/api";
   ```

### Option 2: Vercel (Serverless)

1. **Install Vercel CLI:**

   ```bash
   npm install -g vercel
   ```

2. **Deploy:**

   ```bash
   vercel --prod
   ```

3. **Set environment variables in Vercel dashboard:**
   - `FRONTEND_URL`: Your frontend URL

### Option 3: Netlify Functions

1. **Create netlify/functions directory:**

   ```bash
   mkdir -p netlify/functions
   ```

2. **Move server.js to netlify/functions/server.js**

3. **Deploy to Netlify:**
   ```bash
   netlify deploy --prod
   ```

### Option 4: Traditional VPS/Cloud (DigitalOcean, AWS, etc.)

1. **Install Node.js 18+ on your server**
2. **Clone your repository**
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Set environment variables:**
   ```bash
   export FRONTEND_URL="https://yourdomain.com"
   export PORT="3000"
   ```
5. **Run with PM2:**
   ```bash
   npm install -g pm2
   pm2 start server.js --name "code-guesser"
   ```

## Frontend Deployment (GitHub Pages)

1. **Update API URL in script.js:**

   ```javascript
   const API_BASE_URL = "https://your-backend-domain.com/api";
   ```

2. **Commit and push to GitHub**

3. **Enable GitHub Pages in repository settings**

## Environment Variables

Set these in your backend deployment:

- `FRONTEND_URL`: Your frontend domain (required for CORS)
- `PORT`: Server port (usually set automatically)
- `NODE_ENV`: Set to "production" for production deployments

## Security Considerations

1. **HTTPS Only**: Always use HTTPS in production
2. **CORS Configuration**: Properly configure CORS to only allow your frontend domain
3. **Rate Limiting**: The backend includes rate limiting (100 requests per 15 minutes per IP)
4. **Input Validation**: All inputs are validated using express-validator
5. **Database Security**: SQLite database is local to the server instance

## Database

The backend uses SQLite which creates a local `game_results.db` file. For production:

- **Railway**: Provides persistent storage automatically
- **Vercel**: Consider using Vercel KV or external database for persistence
- **Netlify**: Consider using external database service
- **VPS**: SQLite file persists on the server

## Testing the Deployment

1. **Test game session creation**: Start a new game
2. **Test answer validation**: Complete a game and save results
3. **Test anti-cheating**: Try to submit invalid data (should be rejected)
4. **Test rate limiting**: Make many requests quickly (should be limited)

## Troubleshooting

- **CORS Errors**: Check that `FRONTEND_URL` environment variable is set correctly
- **Database Errors**: Ensure the server has write permissions for the database file
- **Connection Issues**: Verify the backend URL is correct in your frontend code

## Monitoring

Consider adding monitoring tools:

- **Railway**: Built-in monitoring dashboard
- **Vercel**: Analytics dashboard
- **Traditional VPS**: Consider using tools like PM2 monitoring or external services

Your game now has a secure backend that prevents cheating while maintaining a great user experience!
